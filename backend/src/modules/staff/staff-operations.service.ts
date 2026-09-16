import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
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
import { BRANCH_MANAGEABLE_ROLE_CODES } from './dto/branch-staff-role-codes.dto';
import { StaffInvitationAssignment } from './entities/staff-invitation-assignment.entity';
import {
  StaffInvitation,
  StaffInvitationDeliveryStatus,
  StaffInvitationStatus,
} from './entities/staff-invitation.entity';
import { TenantUserMembership } from './entities/tenant-user-membership.entity';
import { StaffInvitationProducer } from './jobs/staff-invitation.producer';
import { StaffInvitationTokenService } from './staff-invitation-token.service';

export type MaterializedStaffGrant = {
  roleCode: TenantRoleCode;
  branchId: string | null;
};

export type StaffAssignmentResponse = {
  id: string;
  roleCode: TenantRoleCode;
  branchId: string | null;
  assignedAt: Date;
};

@Injectable()
export class StaffOperationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly appConfig: AppConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly tokenService: StaffInvitationTokenService,
    private readonly invitationJobs: StaffInvitationProducer,
  ) {}

  newInvitation(
    tenantId: string,
    email: string,
    emailNormalized: string,
    fullName: string,
    createdByUserId: string,
    now: Date,
  ): StaffInvitation {
    const invitation = this.dataSource.manager.create(StaffInvitation, {
      id: randomUUID(),
      tenantId,
      email,
      emailNormalized,
      fullName,
      tokenHash: '',
      status: StaffInvitationStatus.PENDING,
      expiresAt: new Date(
        now.getTime() + this.appConfig.tenantInvitationConfig.ttlMs,
      ),
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
      deliveryStatus: StaffInvitationDeliveryStatus.PENDING,
      lastSentAt: null,
      lastDeliveryErrorCode: null,
      createdByUserId,
    });
    invitation.tokenHash = this.tokenService.hashToken(
      this.tokenService.createToken(invitation),
    );
    return invitation;
  }

  async materializeGrants(
    manager: EntityManager,
    tenantId: string,
    userId: string,
    assignedByUserId: string,
    reason: string | null,
    grants: MaterializedStaffGrant[],
  ): Promise<RoleAssignment[]> {
    return manager.getRepository(RoleAssignment).save(
      grants.map((grant) =>
        manager.create(RoleAssignment, {
          userId,
          tenantId,
          branchId: grant.branchId,
          roleCode: grant.roleCode,
          assignedByUserId,
          assignmentReason: reason,
          revokedByUserId: null,
          revokedAt: null,
          revocationReason: null,
        }),
      ),
    );
  }

  async findMembershipForUpdate(
    manager: EntityManager,
    tenantId: string,
    userId: string,
  ): Promise<TenantUserMembership> {
    const membership = await manager
      .getRepository(TenantUserMembership)
      .createQueryBuilder('membership')
      .setLock('pessimistic_write')
      .where('membership.tenant_id = :tenantId', { tenantId })
      .andWhere('membership.user_id = :userId', { userId })
      .getOne();
    if (!membership) throw new NotFoundException('Staff member was not found.');
    return membership;
  }

  async findInvitationForUpdate(
    manager: EntityManager,
    tenantId: string,
    invitationId: string,
  ): Promise<StaffInvitation> {
    const invitation = await manager
      .getRepository(StaffInvitation)
      .createQueryBuilder('invitation')
      .setLock('pessimistic_write')
      .where('invitation.id = :invitationId', { invitationId })
      .andWhere('invitation.tenant_id = :tenantId', { tenantId })
      .getOne();
    if (!invitation)
      throw new NotFoundException('Staff invitation was not found.');
    return invitation;
  }

  async findInvitationAssignments(
    manager: EntityManager,
    invitationId: string,
  ): Promise<StaffInvitationAssignment[]> {
    return manager.getRepository(StaffInvitationAssignment).find({
      where: { staffInvitationId: invitationId },
    });
  }

  isBranchManagedInvitation(
    assignments: readonly StaffInvitationAssignment[],
    branchId: string,
  ): boolean {
    return (
      assignments.length > 0 &&
      assignments.every(
        (assignment) =>
          assignment.branchId === branchId &&
          BRANCH_MANAGEABLE_ROLE_CODES.includes(
            assignment.roleCode as (typeof BRANCH_MANAGEABLE_ROLE_CODES)[number],
          ),
      )
    );
  }

  async assertGrantBranchesAreActive(
    manager: EntityManager,
    tenantId: string,
    assignments: readonly StaffInvitationAssignment[],
  ): Promise<void> {
    const branchIds = assignments.flatMap((assignment) =>
      assignment.branchId ? [assignment.branchId] : [],
    );
    if (branchIds.length === 0) return;
    const activeBranchCount = await manager.getRepository(Branch).count({
      where: {
        id: In(branchIds),
        tenantId,
        status: BranchStatus.ACTIVE,
      },
    });
    if (activeBranchCount !== branchIds.length) {
      throw new UnprocessableEntityException(
        'Every proposed branch must still be active before accepting the invitation.',
      );
    }
  }

  async auditRoleGrant(
    manager: EntityManager,
    tenantId: string,
    assignment: RoleAssignment,
    actor: { userId: string; sessionId?: string },
    reason?: string | null,
  ): Promise<void> {
    await this.auditLogService.record(manager, {
      action: AuditAction.ROLE_GRANTED,
      actor: {
        type: AuditActorType.USER,
        userId: actor.userId,
        sessionId: actor.sessionId,
      },
      tenantId,
      branchId: assignment.branchId ?? undefined,
      resourceId: assignment.id,
      reason: reason ?? undefined,
      after: this.assignmentAuditSnapshot(assignment),
    });
  }

  async revokeAssignment(
    manager: EntityManager,
    tenantId: string,
    assignment: RoleAssignment,
    context: AuthorizationContext,
    reason: string,
  ): Promise<RoleAssignment> {
    const before = this.assignmentAuditSnapshot(assignment);
    assignment.revokedAt = new Date();
    assignment.revokedByUserId = context.actor.userId;
    assignment.revocationReason = reason;
    const saved = await manager.getRepository(RoleAssignment).save(assignment);
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
    return saved;
  }

  auditActor(context: AuthorizationContext) {
    return {
      type: AuditActorType.USER,
      userId: context.actor.userId,
      sessionId: context.actor.sessionId,
    };
  }

  assignmentAuditSnapshot(assignment: RoleAssignment) {
    return {
      roleCode: assignment.roleCode,
      branchId: assignment.branchId,
      revokedAt: assignment.revokedAt?.toISOString() ?? null,
    };
  }

  assignmentResponse(assignment: RoleAssignment): StaffAssignmentResponse {
    return {
      id: assignment.id,
      roleCode: assignment.roleCode,
      branchId: assignment.branchId,
      assignedAt: assignment.assignedAt,
    };
  }

  membershipResponse(membership: TenantUserMembership) {
    return {
      id: membership.id,
      userId: membership.userId,
      status: membership.status,
      disabledAt: membership.disabledAt,
      updatedAt: membership.updatedAt,
    };
  }

  async invitationResponse(invitationId: string) {
    const invitation = await this.dataSource
      .getRepository(StaffInvitation)
      .findOne({
        where: { id: invitationId },
        relations: { proposedAssignments: true },
      });
    if (!invitation)
      throw new NotFoundException('Staff invitation was not found.');
    return this.invitationEntityResponse(invitation);
  }

  invitationEntityResponse(invitation: StaffInvitation) {
    return {
      id: invitation.id,
      email: invitation.email,
      fullName: invitation.fullName,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      deliveryStatus: invitation.deliveryStatus,
      lastSentAt: invitation.lastSentAt,
      proposedAssignments: (invitation.proposedAssignments ?? []).map(
        (assignment) => ({
          roleCode: assignment.roleCode,
          branchId: assignment.branchId,
        }),
      ),
    };
  }

  async enqueueInvitation(invitationId: string): Promise<void> {
    try {
      await this.invitationJobs.enqueueStaffInvitation(invitationId);
    } catch {
      await this.dataSource
        .getRepository(StaffInvitation)
        .update(invitationId, {
          deliveryStatus: StaffInvitationDeliveryStatus.FAILED,
          lastDeliveryErrorCode: 'ENQUEUE_FAILED',
        });
    }
  }

  isActiveGrantConflict(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      [
        'uq_active_tenant_wide_role_assignment',
        'uq_active_branch_role_assignment',
      ].includes(
        (error.driverError as { constraint?: string } | undefined)
          ?.constraint ?? '',
      )
    );
  }
}
