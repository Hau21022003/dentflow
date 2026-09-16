import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  RoleAssignment,
  TenantRoleCode,
} from '../authorization/entities/role-assignment.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { BRANCH_MANAGEABLE_ROLE_CODES } from './dto/branch-staff-role-codes.dto';
import { CreateBranchStaffInvitationDto } from './dto/create-branch-staff-invitation.dto';
import { GrantBranchStaffRolesDto } from './dto/grant-branch-staff-roles.dto';
import { ListStaffQueryDto, StaffListStatus } from './dto/list-staff-query.dto';
import { StaffInvitationAssignment } from './entities/staff-invitation-assignment.entity';
import {
  StaffInvitation,
  StaffInvitationStatus,
} from './entities/staff-invitation.entity';
import {
  TenantUserMembership,
  TenantUserMembershipStatus,
} from './entities/tenant-user-membership.entity';
import {
  MaterializedStaffGrant,
  StaffOperationsService,
} from './staff-operations.service';

@Injectable()
export class BranchStaffService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly usersService: UsersService,
    private readonly operations: StaffOperationsService,
  ) {}

  async list(context: AuthorizationContext, query: ListStaffQueryDto) {
    const tenantId = context.tenant!.id;
    const branchId = context.branch!.id;
    const now = new Date();
    const [memberships, roleAssignments, invitations] = await Promise.all([
      this.dataSource.getRepository(TenantUserMembership).find({
        where: { tenantId },
        relations: { user: true },
        order: { createdAt: 'ASC' },
      }),
      this.dataSource.getRepository(RoleAssignment).find({
        where: { tenantId, branchId, revokedAt: IsNull() },
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
      memberships
        .filter((membership) => assignmentsByUser.has(membership.userId))
        .map(async (membership) => {
          const profile = await this.usersService.toProfile(membership.user);
          return {
            kind: 'MEMBER' as const,
            id: membership.userId,
            fullName: profile.fullName,
            email: profile.email,
            avatarUrl: profile.avatarUrl,
            status: membership.status,
            membership: this.operations.membershipResponse(membership),
            assignments: (assignmentsByUser.get(membership.userId) ?? []).map(
              (assignment) => this.operations.assignmentResponse(assignment),
            ),
          };
        }),
    );
    const items = [
      ...memberItems,
      ...invitations
        .filter(
          (invitation) =>
            invitation.expiresAt > now &&
            this.operations.isBranchManagedInvitation(
              invitation.proposedAssignments,
              branchId,
            ),
        )
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
    input: CreateBranchStaffInvitationDto,
  ) {
    const branchId = context.branch!.id;
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

      const existingUser = await manager.getRepository(User).findOneBy({
        emailNormalized,
      });
      if (existingUser) {
        await this.assertTargetIsManageable(
          manager,
          tenantId,
          existingUser.id,
          branchId,
          false,
        );
      }
      const grants = this.resolveGrants(branchId, input.roleCodes);
      const invitation = this.operations.newInvitation(
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
        actor: this.operations.auditActor(context),
        tenantId,
        branchId,
        resourceId: invitation.id,
        reason: input.reason,
        after: { status: invitation.status },
      });
      return invitation.id;
    });
    await this.operations.enqueueInvitation(invitationId);
    return this.operations.invitationResponse(invitationId);
  }

  async resendInvitation(context: AuthorizationContext, invitationId: string) {
    const branchId = context.branch!.id;
    const result = await this.dataSource.transaction(async (manager) => {
      const invitation = await this.operations.findInvitationForUpdate(
        manager,
        context.tenant!.id,
        invitationId,
      );
      const proposedAssignments =
        await this.operations.findInvitationAssignments(manager, invitation.id);
      this.assertManagedInvitation(proposedAssignments, branchId);
      if (invitation.status !== StaffInvitationStatus.PENDING) {
        throw new ConflictException(
          'Only pending staff invitations can be resent.',
        );
      }
      if (invitation.expiresAt <= new Date()) {
        return { expiredInvitationId: invitation.id };
      }
      invitation.status = StaffInvitationStatus.REVOKED;
      invitation.revokedAt = new Date();
      await manager.getRepository(StaffInvitation).save(invitation);
      const replacement = this.operations.newInvitation(
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
        actor: this.operations.auditActor(context),
        tenantId: invitation.tenantId,
        branchId,
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
    await this.operations.enqueueInvitation(result.replacementId);
    return this.operations.invitationResponse(result.replacementId);
  }

  async revokeInvitation(
    context: AuthorizationContext,
    invitationId: string,
    reason: string,
  ) {
    const branchId = context.branch!.id;
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.operations.findInvitationForUpdate(
        manager,
        context.tenant!.id,
        invitationId,
      );
      const proposedAssignments =
        await this.operations.findInvitationAssignments(manager, invitation.id);
      this.assertManagedInvitation(proposedAssignments, branchId);
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
        actor: this.operations.auditActor(context),
        tenantId: invitation.tenantId,
        branchId,
        resourceId: invitation.id,
        reason,
        before,
        after: { status: invitation.status },
      });
      return this.operations.invitationEntityResponse(invitation);
    });
  }

  async grantRoles(
    context: AuthorizationContext,
    userId: string,
    input: GrantBranchStaffRolesDto,
  ) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const tenantId = context.tenant!.id;
        const branchId = context.branch!.id;
        const membership = await this.operations.findMembershipForUpdate(
          manager,
          tenantId,
          userId,
        );
        await this.assertTargetIsManageable(
          manager,
          tenantId,
          userId,
          branchId,
        );
        if (membership.status !== TenantUserMembershipStatus.ACTIVE) {
          throw new ConflictException(
            'Enable the staff membership before granting roles.',
          );
        }
        const grants = this.resolveGrants(branchId, input.roleCodes);
        const savedAssignments = await this.operations.materializeGrants(
          manager,
          tenantId,
          userId,
          context.actor.userId,
          input.reason ?? null,
          grants,
        );
        for (const assignment of savedAssignments) {
          await this.operations.auditRoleGrant(
            manager,
            tenantId,
            assignment,
            context.actor,
            input.reason,
          );
        }
        return savedAssignments.map((assignment) =>
          this.operations.assignmentResponse(assignment),
        );
      });
    } catch (error) {
      if (this.operations.isActiveGrantConflict(error)) {
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
      const branchId = context.branch!.id;
      await this.operations.findMembershipForUpdate(manager, tenantId, userId);
      await this.assertTargetIsManageable(manager, tenantId, userId, branchId);
      const assignment = await manager
        .getRepository(RoleAssignment)
        .createQueryBuilder('assignment')
        .setLock('pessimistic_write')
        .where('assignment.id = :assignmentId', { assignmentId })
        .andWhere('assignment.tenant_id = :tenantId', { tenantId })
        .andWhere('assignment.user_id = :userId', { userId })
        .andWhere('assignment.branch_id = :branchId', { branchId })
        .andWhere('assignment.role_code IN (:...roleCodes)', {
          roleCodes: BRANCH_MANAGEABLE_ROLE_CODES,
        })
        .andWhere('assignment.revoked_at IS NULL')
        .getOne();
      if (!assignment) {
        throw new NotFoundException('Role assignment was not found.');
      }
      const saved = await this.operations.revokeAssignment(
        manager,
        tenantId,
        assignment,
        context,
        reason,
      );
      return this.operations.assignmentResponse(saved);
    });
  }

  async remove(context: AuthorizationContext, userId: string, reason: string) {
    return this.dataSource.transaction(async (manager) => {
      const tenantId = context.tenant!.id;
      const branchId = context.branch!.id;
      await this.operations.findMembershipForUpdate(manager, tenantId, userId);
      await this.assertTargetIsManageable(manager, tenantId, userId, branchId);
      const assignments = await manager
        .getRepository(RoleAssignment)
        .createQueryBuilder('assignment')
        .setLock('pessimistic_write')
        .where('assignment.tenant_id = :tenantId', { tenantId })
        .andWhere('assignment.user_id = :userId', { userId })
        .andWhere('assignment.branch_id = :branchId', { branchId })
        .andWhere('assignment.role_code IN (:...roleCodes)', {
          roleCodes: BRANCH_MANAGEABLE_ROLE_CODES,
        })
        .andWhere('assignment.revoked_at IS NULL')
        .getMany();
      if (assignments.length === 0) {
        throw new NotFoundException(
          'Branch staff role assignments were not found.',
        );
      }
      const revokedAssignments: RoleAssignment[] = [];
      for (const assignment of assignments) {
        revokedAssignments.push(
          await this.operations.revokeAssignment(
            manager,
            tenantId,
            assignment,
            context,
            reason,
          ),
        );
      }
      return revokedAssignments.map((assignment) =>
        this.operations.assignmentResponse(assignment),
      );
    });
  }

  private resolveGrants(
    branchId: string,
    roleCodes: readonly TenantRoleCode[],
  ): MaterializedStaffGrant[] {
    if (roleCodes.length === 0) {
      throw new BadRequestException(
        'At least one role assignment is required.',
      );
    }
    if (
      roleCodes.some(
        (roleCode) =>
          !BRANCH_MANAGEABLE_ROLE_CODES.includes(
            roleCode as (typeof BRANCH_MANAGEABLE_ROLE_CODES)[number],
          ),
      )
    ) {
      throw new BadRequestException(
        'Branch staff management only allows Receptionist or Dentist roles.',
      );
    }
    if (new Set(roleCodes).size !== roleCodes.length) {
      throw new BadRequestException('Duplicate proposed role assignment.');
    }
    return roleCodes.map((roleCode) => ({ roleCode, branchId }));
  }

  private assertManagedInvitation(
    assignments: readonly StaffInvitationAssignment[],
    branchId: string,
  ): void {
    if (!this.operations.isBranchManagedInvitation(assignments, branchId)) {
      throw new NotFoundException('Staff invitation was not found.');
    }
  }

  private async assertTargetIsManageable(
    manager: EntityManager,
    tenantId: string,
    userId: string,
    branchId: string,
    requireBranchAssignment = true,
  ): Promise<void> {
    const hasAdminRole = await manager.getRepository(RoleAssignment).exists({
      where: {
        tenantId,
        userId,
        roleCode: In([
          TenantRoleCode.TENANT_ADMIN,
          TenantRoleCode.BRANCH_ADMIN,
        ]),
        revokedAt: IsNull(),
      },
    });
    if (hasAdminRole) {
      throw new ForbiddenException(
        'Administrative staff cannot be managed here.',
      );
    }
    if (!requireBranchAssignment) return;
    const hasBranchAssignment = await manager
      .getRepository(RoleAssignment)
      .exists({
        where: { tenantId, userId, branchId, revokedAt: IsNull() },
      });
    if (!hasBranchAssignment) {
      throw new NotFoundException('Staff member was not found.');
    }
  }
}
