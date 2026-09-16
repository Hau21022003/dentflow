import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { hash } from 'bcrypt';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  RoleAssignment,
  TenantRoleCode,
} from '../authorization/entities/role-assignment.entity';
import { Branch, BranchStatus } from '../branches/entities/branch.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AcceptStaffInvitationDto } from './dto/accept-staff-invitation.dto';
import { CreateStaffInvitationDto } from './dto/create-staff-invitation.dto';
import { GrantRoleAssignmentsDto } from './dto/grant-role-assignments.dto';
import { ListStaffQueryDto, StaffListStatus } from './dto/list-staff-query.dto';
import { ProposedRoleAssignmentDto } from './dto/proposed-role-assignment.dto';
import { StaffInvitationAssignment } from './entities/staff-invitation-assignment.entity';
import {
  StaffInvitation,
  StaffInvitationStatus,
} from './entities/staff-invitation.entity';
import {
  TenantUserMembership,
  TenantUserMembershipStatus,
} from './entities/tenant-user-membership.entity';
import { StaffInvitationTokenService } from './staff-invitation-token.service';
import {
  MaterializedStaffGrant,
  StaffOperationsService,
} from './staff-operations.service';

@Injectable()
export class StaffService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly appConfig: AppConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly tokenService: StaffInvitationTokenService,
    private readonly usersService: UsersService,
    private readonly operations: StaffOperationsService,
  ) {}

  async list(context: AuthorizationContext, query: ListStaffQueryDto) {
    const tenantId = context.tenant!.id;
    const now = new Date();
    const [memberships, roleAssignments, invitations] = await Promise.all([
      this.dataSource.getRepository(TenantUserMembership).find({
        where: { tenantId },
        relations: { user: true },
        order: { createdAt: 'ASC' },
      }),
      this.dataSource.getRepository(RoleAssignment).find({
        where: { tenantId, revokedAt: IsNull() },
        order: { assignedAt: 'ASC' },
      }),
      this.dataSource.getRepository(StaffInvitation).find({
        where: { tenantId, status: StaffInvitationStatus.PENDING },
        relations: { proposedAssignments: true },
        order: { createdAt: 'ASC' },
      }),
    ]);
    const assignmentsByUser = new Map<string, RoleAssignment[]>();
    roleAssignments.forEach((assignment) => {
      const assignments = assignmentsByUser.get(assignment.userId) ?? [];
      assignments.push(assignment);
      assignmentsByUser.set(assignment.userId, assignments);
    });
    const memberItems = await Promise.all(
      memberships.map(async (membership) => {
        const profile = await this.usersService.toProfile(membership.user);
        return {
          kind: 'MEMBER' as const,
          id: membership.userId,
          fullName: profile.fullName,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
          status: membership.status,
          membership: this.membershipResponse(membership),
          assignments: (assignmentsByUser.get(membership.userId) ?? []).map(
            (assignment) => this.assignmentResponse(assignment),
          ),
        };
      }),
    );
    const items = [
      ...memberItems,
      ...invitations
        .filter((invitation) => invitation.expiresAt > now)
        .map((invitation) => ({
          kind: 'INVITATION' as const,
          id: invitation.id,
          fullName: invitation.fullName,
          email: invitation.email,
          status: StaffListStatus.INVITED,
          invitation: {
            id: invitation.id,
            expiresAt: invitation.expiresAt,
            deliveryStatus: invitation.deliveryStatus,
            lastSentAt: invitation.lastSentAt,
            proposedAssignments: invitation.proposedAssignments.map(
              (assignment) => ({
                roleCode: assignment.roleCode,
                branchId: assignment.branchId,
              }),
            ),
          },
          assignments: [],
        })),
    ]
      .filter((item) => !query.status || item.status === query.status)
      .filter((item) => {
        if (!query.search) return true;
        const needle = query.search.trim().toLocaleLowerCase();
        return (
          item.fullName.toLocaleLowerCase().includes(needle) ||
          item.email.toLocaleLowerCase().includes(needle)
        );
      })
      .sort(
        (left, right) =>
          left.fullName.localeCompare(right.fullName) ||
          left.email.localeCompare(right.email) ||
          left.id.localeCompare(right.id),
      );
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const total = items.length;
    return {
      items: items.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createInvitation(
    context: AuthorizationContext,
    input: CreateStaffInvitationDto,
  ) {
    const invitationId = await this.dataSource.transaction(async (manager) => {
      const tenantId = context.tenant!.id;
      const emailNormalized = input.email.toLocaleLowerCase();
      const current = await manager
        .getRepository(StaffInvitation)
        .createQueryBuilder('invitation')
        .setLock('pessimistic_write')
        .where('invitation.tenant_id = :tenantId', { tenantId })
        .andWhere('invitation.email_normalized = :emailNormalized', {
          emailNormalized,
        })
        .andWhere('invitation.status = :status', {
          status: StaffInvitationStatus.PENDING,
        })
        .getOne();
      if (current) {
        if (current.expiresAt > new Date()) {
          throw new ConflictException(
            'A pending staff invitation already exists.',
          );
        }
        current.status = StaffInvitationStatus.EXPIRED;
        await manager.getRepository(StaffInvitation).save(current);
      }

      const grants = await this.resolveGrants(
        manager,
        tenantId,
        input.assignments,
      );
      const invitation = this.newInvitation(
        tenantId,
        input.email,
        emailNormalized,
        input.fullName,
        context.actor.userId,
        new Date(),
      );
      await manager.getRepository(StaffInvitation).save(invitation);
      await manager.getRepository(StaffInvitationAssignment).save(
        grants.map((grant) =>
          manager.create(StaffInvitationAssignment, {
            staffInvitationId: invitation.id,
            tenantId,
            roleCode: grant.roleCode,
            branchId: grant.branchId,
          }),
        ),
      );
      await this.auditLogService.record(manager, {
        action: AuditAction.STAFF_INVITATION_CREATED,
        actor: this.auditActor(context),
        tenantId,
        resourceId: invitation.id,
        reason: input.reason,
        after: { status: invitation.status },
      });
      return invitation.id;
    });
    await this.enqueueInvitation(invitationId);
    return this.invitationResponse(invitationId);
  }

  async resendInvitation(context: AuthorizationContext, invitationId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const invitation = await this.findInvitationForUpdate(
        manager,
        context.tenant!.id,
        invitationId,
      );
      if (invitation.status !== StaffInvitationStatus.PENDING) {
        throw new ConflictException(
          'Only pending staff invitations can be resent.',
        );
      }
      if (invitation.expiresAt <= new Date()) {
        return { expiredInvitationId: invitation.id };
      }
      const proposedAssignments = await manager
        .getRepository(StaffInvitationAssignment)
        .find({ where: { staffInvitationId: invitation.id } });
      invitation.status = StaffInvitationStatus.REVOKED;
      invitation.revokedAt = new Date();
      await manager.getRepository(StaffInvitation).save(invitation);
      const replacement = this.newInvitation(
        invitation.tenantId,
        invitation.email,
        invitation.emailNormalized,
        invitation.fullName,
        context.actor.userId,
        new Date(),
      );
      await manager.getRepository(StaffInvitation).save(replacement);
      await manager.getRepository(StaffInvitationAssignment).save(
        proposedAssignments.map((assignment) =>
          manager.create(StaffInvitationAssignment, {
            staffInvitationId: replacement.id,
            tenantId: replacement.tenantId,
            roleCode: assignment.roleCode,
            branchId: assignment.branchId,
          }),
        ),
      );
      await this.auditLogService.record(manager, {
        action: AuditAction.STAFF_INVITATION_RESENT,
        actor: this.auditActor(context),
        tenantId: invitation.tenantId,
        resourceId: replacement.id,
        before: { status: StaffInvitationStatus.PENDING },
        after: { status: StaffInvitationStatus.PENDING },
      });
      return { replacementId: replacement.id };
    });
    if ('expiredInvitationId' in result) {
      await this.dataSource.getRepository(StaffInvitation).update(
        {
          id: result.expiredInvitationId,
          status: StaffInvitationStatus.PENDING,
        },
        { status: StaffInvitationStatus.EXPIRED },
      );
      throw new ConflictException('The staff invitation has expired.');
    }
    await this.enqueueInvitation(result.replacementId);
    return this.invitationResponse(result.replacementId);
  }

  async revokeInvitation(
    context: AuthorizationContext,
    invitationId: string,
    reason: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.findInvitationForUpdate(
        manager,
        context.tenant!.id,
        invitationId,
      );
      if (invitation.status !== StaffInvitationStatus.PENDING) {
        throw new ConflictException(
          'Only pending staff invitations can be revoked.',
        );
      }
      const before = { status: invitation.status };
      invitation.status = StaffInvitationStatus.REVOKED;
      invitation.revokedAt = new Date();
      await manager.getRepository(StaffInvitation).save(invitation);
      await this.auditLogService.record(manager, {
        action: AuditAction.STAFF_INVITATION_REVOKED,
        actor: this.auditActor(context),
        tenantId: invitation.tenantId,
        resourceId: invitation.id,
        reason,
        before,
        after: { status: invitation.status },
      });
      return this.invitationEntityResponse(invitation);
    });
  }

  async acceptInvitation(
    input: AcceptStaffInvitationDto,
    currentUserId?: string,
  ) {
    const invitationId = this.tokenService.getInvitationId(input.token);
    if (!invitationId)
      throw new NotFoundException('Staff invitation was not found.');

    const result = await this.dataSource.transaction(async (manager) => {
      const invitation = await manager
        .getRepository(StaffInvitation)
        .createQueryBuilder('invitation')
        .addSelect('invitation.tokenHash')
        .setLock('pessimistic_write')
        .where('invitation.id = :invitationId', { invitationId })
        .getOne();
      if (!invitation || !this.tokenService.matches(invitation, input.token)) {
        throw new NotFoundException('Staff invitation was not found.');
      }
      if (invitation.status === StaffInvitationStatus.ACCEPTED) {
        if (currentUserId && invitation.acceptedByUserId === currentUserId) {
          return this.acceptedInvitationResponse(manager, invitation);
        }
        throw new ConflictException(
          'This staff invitation has already been accepted.',
        );
      }
      if (invitation.status !== StaffInvitationStatus.PENDING) {
        throw new NotFoundException('Staff invitation was not found.');
      }
      if (invitation.expiresAt <= new Date()) {
        return { expiredInvitationId: invitation.id };
      }

      const proposedAssignments = await manager
        .getRepository(StaffInvitationAssignment)
        .find({ where: { staffInvitationId: invitation.id } });
      const branchInvitationId = proposedAssignments[0]?.branchId;
      const auditBranchId =
        branchInvitationId &&
        this.operations.isBranchManagedInvitation(
          proposedAssignments,
          branchInvitationId,
        )
          ? branchInvitationId
          : undefined;
      await this.operations.assertGrantBranchesAreActive(
        manager,
        invitation.tenantId,
        proposedAssignments,
      );

      const user = await this.resolveInvitationUser(
        manager,
        invitation,
        input,
        currentUserId,
      );
      const membership = await manager
        .getRepository(TenantUserMembership)
        .createQueryBuilder('membership')
        .setLock('pessimistic_write')
        .where('membership.tenant_id = :tenantId', {
          tenantId: invitation.tenantId,
        })
        .andWhere('membership.user_id = :userId', { userId: user.id })
        .getOne();
      const membershipWasDisabled =
        membership?.status === TenantUserMembershipStatus.DISABLED;
      const savedMembership = await manager
        .getRepository(TenantUserMembership)
        .save(
          membership
            ? Object.assign(membership, {
                status: TenantUserMembershipStatus.ACTIVE,
                disabledAt: null,
                disabledByUserId: null,
                disabledReason: null,
              })
            : manager.create(TenantUserMembership, {
                tenantId: invitation.tenantId,
                userId: user.id,
                status: TenantUserMembershipStatus.ACTIVE,
                disabledAt: null,
                disabledByUserId: null,
                disabledReason: null,
              }),
        );
      const existingAssignments = await manager
        .getRepository(RoleAssignment)
        .find({
          where: {
            tenantId: invitation.tenantId,
            userId: user.id,
            revokedAt: IsNull(),
          },
        });
      const existingGrantKeys = new Set(
        existingAssignments.map(
          (assignment) =>
            `${assignment.roleCode}:${assignment.branchId ?? 'tenant'}`,
        ),
      );
      if (
        proposedAssignments.some((assignment) =>
          existingGrantKeys.has(
            `${assignment.roleCode}:${assignment.branchId ?? 'tenant'}`,
          ),
        )
      ) {
        throw new ConflictException(
          'The invited user already has one of the proposed active grants.',
        );
      }
      const savedAssignments = await this.materializeGrants(
        manager,
        invitation.tenantId,
        user.id,
        invitation.createdByUserId,
        'STAFF_INVITATION_ACCEPTED',
        proposedAssignments.map((assignment) => ({
          roleCode: assignment.roleCode,
          branchId: assignment.branchId,
        })),
      );
      invitation.status = StaffInvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      invitation.acceptedByUserId = user.id;
      await manager.getRepository(StaffInvitation).save(invitation);
      await this.auditLogService.record(manager, {
        action: AuditAction.STAFF_INVITATION_ACCEPTED,
        actor: { type: AuditActorType.USER, userId: user.id },
        tenantId: invitation.tenantId,
        branchId: auditBranchId,
        resourceId: invitation.id,
        before: { status: StaffInvitationStatus.PENDING },
        after: { status: StaffInvitationStatus.ACCEPTED },
      });
      if (membershipWasDisabled) {
        await this.auditLogService.record(manager, {
          action: AuditAction.USER_ENABLED,
          actor: { type: AuditActorType.USER, userId: user.id },
          tenantId: invitation.tenantId,
          resourceId: user.id,
          before: { status: TenantUserMembershipStatus.DISABLED },
          after: { status: TenantUserMembershipStatus.ACTIVE },
        });
      }
      for (const assignment of savedAssignments) {
        await this.auditRoleGrant(
          manager,
          invitation.tenantId,
          assignment,
          { userId: user.id },
          'STAFF_INVITATION_ACCEPTED',
        );
      }
      return this.acceptedInvitationResponse(
        manager,
        invitation,
        savedMembership.id,
      );
    });
    if ('expiredInvitationId' in result) {
      await this.dataSource.getRepository(StaffInvitation).update(
        {
          id: result.expiredInvitationId,
          status: StaffInvitationStatus.PENDING,
        },
        { status: StaffInvitationStatus.EXPIRED },
      );
      throw new NotFoundException('Staff invitation has expired.');
    }
    return result;
  }

  async disable(context: AuthorizationContext, userId: string, reason: string) {
    return this.setMembershipStatus(
      context,
      userId,
      TenantUserMembershipStatus.DISABLED,
      reason,
    );
  }

  async enable(context: AuthorizationContext, userId: string, reason: string) {
    return this.setMembershipStatus(
      context,
      userId,
      TenantUserMembershipStatus.ACTIVE,
      reason,
    );
  }

  async grantRoles(
    context: AuthorizationContext,
    userId: string,
    input: GrantRoleAssignmentsDto,
  ) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const tenantId = context.tenant!.id;
        const membership = await this.findMembershipForUpdate(
          manager,
          tenantId,
          userId,
        );
        if (membership.status !== TenantUserMembershipStatus.ACTIVE) {
          throw new ConflictException(
            'Enable the staff membership before granting roles.',
          );
        }
        const grants = await this.resolveGrants(
          manager,
          tenantId,
          input.assignments,
        );
        const savedAssignments = await this.materializeGrants(
          manager,
          tenantId,
          userId,
          context.actor.userId,
          input.reason ?? null,
          grants,
        );
        for (const assignment of savedAssignments) {
          await this.auditRoleGrant(
            manager,
            tenantId,
            assignment,
            context.actor,
            input.reason,
          );
        }
        return savedAssignments.map((assignment) =>
          this.assignmentResponse(assignment),
        );
      });
    } catch (error) {
      if (this.isActiveGrantConflict(error)) {
        throw new ConflictException(
          'The staff member already has one of these active grants.',
        );
      }
      throw error;
    }
  }

  async revokeRole(
    context: AuthorizationContext,
    userId: string,
    assignmentId: string,
    reason: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const tenantId = context.tenant!.id;
      await this.findMembershipForUpdate(manager, tenantId, userId);
      const assignment = await manager
        .getRepository(RoleAssignment)
        .createQueryBuilder('assignment')
        .setLock('pessimistic_write')
        .where('assignment.id = :assignmentId', { assignmentId })
        .andWhere('assignment.tenant_id = :tenantId', { tenantId })
        .andWhere('assignment.user_id = :userId', { userId })
        .andWhere('assignment.revoked_at IS NULL')
        .getOne();
      if (!assignment)
        throw new NotFoundException('Role assignment was not found.');
      if (assignment.roleCode === TenantRoleCode.TENANT_ADMIN) {
        await this.assertNotLastTenantAdmin(manager, tenantId);
      }
      const before = this.assignmentAuditSnapshot(assignment);
      assignment.revokedAt = new Date();
      assignment.revokedByUserId = context.actor.userId;
      assignment.revocationReason = reason;
      const saved = await manager
        .getRepository(RoleAssignment)
        .save(assignment);
      await this.auditLogService.record(manager, {
        action: AuditAction.ROLE_REVOKED,
        actor: this.auditActor(context),
        tenantId,
        branchId: saved.branchId ?? undefined,
        resourceId: saved.id,
        reason,
        before,
        after: this.assignmentAuditSnapshot(saved),
      });
      return this.assignmentResponse(saved);
    });
  }

  private async setMembershipStatus(
    context: AuthorizationContext,
    userId: string,
    status: TenantUserMembershipStatus,
    reason: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const tenantId = context.tenant!.id;
      const membership = await this.findMembershipForUpdate(
        manager,
        tenantId,
        userId,
      );
      if (membership.status === status)
        return this.membershipResponse(membership);
      if (status === TenantUserMembershipStatus.DISABLED) {
        const isTenantAdmin = await manager
          .getRepository(RoleAssignment)
          .exists({
            where: {
              tenantId,
              userId,
              roleCode: TenantRoleCode.TENANT_ADMIN,
              revokedAt: IsNull(),
            },
          });
        if (isTenantAdmin) {
          await this.assertNotLastTenantAdmin(manager, tenantId);
        }
        membership.status = TenantUserMembershipStatus.DISABLED;
        membership.disabledAt = new Date();
        membership.disabledByUserId = context.actor.userId;
        membership.disabledReason = reason;
      } else {
        membership.status = TenantUserMembershipStatus.ACTIVE;
        membership.disabledAt = null;
        membership.disabledByUserId = null;
        membership.disabledReason = null;
      }
      const saved = await manager
        .getRepository(TenantUserMembership)
        .save(membership);
      await this.auditLogService.record(manager, {
        action:
          status === TenantUserMembershipStatus.DISABLED
            ? AuditAction.USER_DISABLED
            : AuditAction.USER_ENABLED,
        actor: this.auditActor(context),
        tenantId,
        resourceId: userId,
        reason,
        before: {
          status:
            status === TenantUserMembershipStatus.DISABLED
              ? 'ACTIVE'
              : 'DISABLED',
        },
        after: { status: saved.status },
      });
      return this.membershipResponse(saved);
    });
  }

  private async resolveGrants(
    manager: EntityManager,
    tenantId: string,
    input: ProposedRoleAssignmentDto[],
  ): Promise<MaterializedStaffGrant[]> {
    if (input.length === 0) {
      throw new BadRequestException(
        'At least one role assignment is required.',
      );
    }
    const grants: MaterializedStaffGrant[] = [];
    for (const assignment of input) {
      const branchSlugs = assignment.branchSlugs ?? [];
      if (assignment.roleCode === TenantRoleCode.TENANT_ADMIN) {
        if (branchSlugs.length !== 0) {
          throw new BadRequestException(
            'TENANT_ADMIN cannot have branch scope.',
          );
        }
        grants.push({ roleCode: assignment.roleCode, branchId: null });
        continue;
      }
      if (branchSlugs.length === 0) {
        throw new BadRequestException(
          'Branch-scoped roles require at least one branch.',
        );
      }
      const branches = await manager.getRepository(Branch).find({
        where: {
          tenantId,
          slug: In(branchSlugs),
          status: BranchStatus.ACTIVE,
        },
      });
      if (branches.length !== branchSlugs.length) {
        throw new UnprocessableEntityException(
          'Every assigned branch must exist in this tenant and be active.',
        );
      }
      branches.forEach((branch) =>
        grants.push({ roleCode: assignment.roleCode, branchId: branch.id }),
      );
    }
    const unique = new Set(
      grants.map((grant) => `${grant.roleCode}:${grant.branchId ?? 'tenant'}`),
    );
    if (unique.size !== grants.length) {
      throw new BadRequestException('Duplicate proposed role assignment.');
    }
    return grants;
  }

  private newInvitation(
    tenantId: string,
    email: string,
    emailNormalized: string,
    fullName: string,
    createdByUserId: string,
    now: Date,
  ): StaffInvitation {
    return this.operations.newInvitation(
      tenantId,
      email,
      emailNormalized,
      fullName,
      createdByUserId,
      now,
    );
  }

  private async resolveInvitationUser(
    manager: EntityManager,
    invitation: StaffInvitation,
    input: AcceptStaffInvitationDto,
    currentUserId?: string,
  ): Promise<User> {
    const users = manager.getRepository(User);
    if (currentUserId) {
      const user = await users.findOneBy({ id: currentUserId });
      if (
        !user ||
        user.status !== UserStatus.ACTIVE ||
        user.emailNormalized !== invitation.emailNormalized
      ) {
        throw new ConflictException(
          'The signed-in account does not match this staff invitation.',
        );
      }
      return user;
    }
    const existing = await users.findOneBy({
      emailNormalized: invitation.emailNormalized,
    });
    if (existing) {
      throw new ConflictException(
        'Sign in with the invited email before accepting this invitation.',
      );
    }
    if (!input.password) {
      throw new UnprocessableEntityException(
        'password is required for a new staff account.',
      );
    }
    return users.save(
      users.create({
        email: invitation.email,
        emailNormalized: invitation.emailNormalized,
        fullName: invitation.fullName,
        status: UserStatus.ACTIVE,
        passwordHash: await hash(
          input.password,
          this.appConfig.securityConfig.bcryptSaltRounds,
        ),
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        emailVerifiedAt: new Date(),
      }),
    );
  }

  private async materializeGrants(
    manager: EntityManager,
    tenantId: string,
    userId: string,
    assignedByUserId: string,
    reason: string | null,
    grants: MaterializedStaffGrant[],
  ): Promise<RoleAssignment[]> {
    return this.operations.materializeGrants(
      manager,
      tenantId,
      userId,
      assignedByUserId,
      reason,
      grants,
    );
  }

  private async findMembershipForUpdate(
    manager: EntityManager,
    tenantId: string,
    userId: string,
  ): Promise<TenantUserMembership> {
    return this.operations.findMembershipForUpdate(manager, tenantId, userId);
  }

  private async findInvitationForUpdate(
    manager: EntityManager,
    tenantId: string,
    invitationId: string,
  ): Promise<StaffInvitation> {
    return this.operations.findInvitationForUpdate(
      manager,
      tenantId,
      invitationId,
    );
  }

  private async assertNotLastTenantAdmin(
    manager: EntityManager,
    tenantId: string,
  ): Promise<void> {
    const tenant = await manager
      .getRepository(Tenant)
      .createQueryBuilder('tenant')
      .setLock('pessimistic_write')
      .where('tenant.id = :tenantId', { tenantId })
      .getOne();
    if (!tenant) throw new NotFoundException('Tenant was not found.');
    const count = await manager
      .getRepository(RoleAssignment)
      .createQueryBuilder('assignment')
      .innerJoin(
        'tenant_user_memberships',
        'membership',
        'membership.user_id = assignment.user_id AND membership.tenant_id = assignment.tenant_id',
      )
      .where('assignment.tenant_id = :tenantId', { tenantId })
      .andWhere('assignment.role_code = :roleCode', {
        roleCode: TenantRoleCode.TENANT_ADMIN,
      })
      .andWhere('assignment.revoked_at IS NULL')
      .andWhere('membership.status = :status', {
        status: TenantUserMembershipStatus.ACTIVE,
      })
      .getCount();
    if (count <= 1) {
      throw new ConflictException(
        'A tenant must retain at least one active Tenant Admin.',
      );
    }
  }

  private async auditRoleGrant(
    manager: EntityManager,
    tenantId: string,
    assignment: RoleAssignment,
    actor: { userId: string; sessionId?: string },
    reason?: string | null,
  ): Promise<void> {
    await this.operations.auditRoleGrant(
      manager,
      tenantId,
      assignment,
      actor,
      reason,
    );
  }

  private auditActor(context: AuthorizationContext) {
    return this.operations.auditActor(context);
  }

  private assignmentAuditSnapshot(assignment: RoleAssignment) {
    return this.operations.assignmentAuditSnapshot(assignment);
  }

  private assignmentResponse(assignment: RoleAssignment) {
    return this.operations.assignmentResponse(assignment);
  }

  private membershipResponse(membership: TenantUserMembership) {
    return this.operations.membershipResponse(membership);
  }

  private async invitationResponse(invitationId: string) {
    return this.operations.invitationResponse(invitationId);
  }

  private invitationEntityResponse(invitation: StaffInvitation) {
    return this.operations.invitationEntityResponse(invitation);
  }

  private async acceptedInvitationResponse(
    manager: EntityManager,
    invitation: StaffInvitation,
    membershipId?: string,
  ) {
    const membership = membershipId
      ? undefined
      : await manager.getRepository(TenantUserMembership).findOneBy({
          tenantId: invitation.tenantId,
          userId: invitation.acceptedByUserId!,
        });
    if (!membershipId && !membership) {
      throw new ConflictException(
        'The accepted invitation has no tenant membership.',
      );
    }
    return {
      tenantId: invitation.tenantId,
      userId: invitation.acceptedByUserId,
      membershipId: membershipId ?? membership!.id,
    };
  }

  private async enqueueInvitation(invitationId: string): Promise<void> {
    return this.operations.enqueueInvitation(invitationId);
  }

  private isActiveGrantConflict(error: unknown): boolean {
    return this.operations.isActiveGrantConflict(error);
  }
}
