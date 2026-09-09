import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  IsNull,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  applyIlikeSearch,
  applyOffsetPagination,
  applySafeSort,
  toPageMeta,
} from '../../common/database/query-builder-list.util';
import { SortOrder } from '../../common/dto/page-list-query.dto';
import { hash } from '../../common/utils/hash.util';
import { AppConfigService } from '../../config/app-config.service';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  RoleAssignment,
  TenantRoleCode,
} from '../authorization/entities/role-assignment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { SubscriptionPlan } from '../subscription-plans/entities/subscription-plan.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/entities/subscription.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { AcceptTenantOwnerInvitationDto } from './dto/accept-tenant-owner-invitation.dto';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';
import {
  ListPlatformTenantsQueryDto,
  PlatformTenantSortBy,
} from './dto/list-platform-tenants-query.dto';
import { UpdatePlatformTenantDto } from './dto/update-platform-tenant.dto';
import {
  TenantOwnerInvitation,
  TenantOwnerInvitationDeliveryStatus,
  TenantOwnerInvitationStatus,
} from './entities/tenant-owner-invitation.entity';
import { Tenant, TenantStatus } from './entities/tenant.entity';
import { TenantInvitationTokenService } from './tenant-invitation-token.service';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantOwnerInvitationProducer } from './jobs/tenant-owner-invitation.producer';

const TENANT_EDITABLE_FIELDS = [
  'legalName',
  'displayName',
  'billingEmail',
  'contactEmail',
  'contactPhone',
  'logoUrl',
  'defaultLocale',
  'defaultTimezone',
] as const;

type TenantEditableField = (typeof TENANT_EDITABLE_FIELDS)[number];

const PLATFORM_TENANT_BRANCH_COUNT_EXPRESSION = `(
  SELECT COUNT(*)
  FROM branches branch_count
  WHERE branch_count.tenant_id = tenant.id
)`;

const PLATFORM_TENANT_SORT_FIELDS: Readonly<
  Record<PlatformTenantSortBy, string>
> = {
  [PlatformTenantSortBy.DISPLAY_NAME]: 'tenant.display_name',
  [PlatformTenantSortBy.PLAN_NAME]: 'plan.name',
  [PlatformTenantSortBy.BRANCH_COUNT]: 'branch_count',
  [PlatformTenantSortBy.STATUS]: 'tenant.status',
  [PlatformTenantSortBy.CREATED_AT]: 'tenant.created_at',
};

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    @InjectRepository(TenantOwnerInvitation)
    private readonly invitationsRepository: Repository<TenantOwnerInvitation>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly appConfig: AppConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly invitationTokenService: TenantInvitationTokenService,
    private readonly invitationJobs: TenantOwnerInvitationProducer,
    private readonly lifecycleService: TenantLifecycleService,
  ) {}

  async list(query: ListPlatformTenantsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const queryBuilder = this.tenantsRepository
      .createQueryBuilder('tenant')
      .leftJoin(
        Subscription,
        'subscription',
        'subscription.tenant_id = tenant.id AND subscription.canceled_at IS NULL',
      )
      .leftJoin(SubscriptionPlan, 'plan', 'plan.id = subscription.plan_id')
      .where('1 = 1');

    if (query.status) {
      queryBuilder.andWhere('tenant.status = :status', {
        status: query.status,
      });
    }
    if (query.planId) {
      queryBuilder.andWhere('subscription.plan_id = :planId', {
        planId: query.planId,
      });
    }
    if (query.trialEndingBefore) {
      queryBuilder
        .andWhere('subscription.status = :trialStatus', {
          trialStatus: SubscriptionStatus.TRIAL,
        })
        .andWhere('subscription.current_period_end <= :trialEndingBefore', {
          trialEndingBefore: new Date(query.trialEndingBefore),
        });
    }
    applyIlikeSearch(queryBuilder, query.search, [
      'tenant.display_name',
      'tenant.legal_name',
      'tenant.slug',
      'plan.name',
    ]);
    if (query.sortBy === PlatformTenantSortBy.PLAN_NAME) {
      queryBuilder.addSelect('plan.name');
    }
    if (query.sortBy === PlatformTenantSortBy.BRANCH_COUNT) {
      queryBuilder.addSelect(
        PLATFORM_TENANT_BRANCH_COUNT_EXPRESSION,
        'branch_count',
      );
    }
    applySafeSort(queryBuilder, {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      fields: PLATFORM_TENANT_SORT_FIELDS,
      defaultField:
        PLATFORM_TENANT_SORT_FIELDS[PlatformTenantSortBy.CREATED_AT],
      defaultOrder: SortOrder.DESC,
      tieBreaker: 'tenant.id',
    });
    applyOffsetPagination(queryBuilder, { page, limit });

    const [tenants, total] = await queryBuilder.getManyAndCount();
    const items = await Promise.all(
      tenants.map((tenant) => this.getPlatformDetail(tenant.id)),
    );
    return {
      items,
      meta: toPageMeta({ page, limit }, total),
    };
  }

  async getPlatformDetail(tenantId: string) {
    const tenant = await this.tenantsRepository.findOne({
      where: { id: tenantId },
      relations: { ownerUser: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant was not found.');
    }

    const [subscription, invitation, branchCount, userCount] =
      await Promise.all([
        this.findCurrentSubscription(this.dataSource.manager, tenant.id),
        this.invitationsRepository.findOne({
          where: {
            tenantId: tenant.id,
            status: TenantOwnerInvitationStatus.PENDING,
          },
          order: { createdAt: 'DESC' },
        }),
        this.dataSource.getRepository(Branch).count({
          where: { tenantId: tenant.id },
        }),
        this.countActiveTenantUsers(tenant.id),
      ]);

    return {
      id: tenant.id,
      legalName: tenant.legalName,
      displayName: tenant.displayName,
      slug: tenant.slug,
      billingEmail: tenant.billingEmail,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      logoUrl: tenant.logoUrl,
      defaultLocale: tenant.defaultLocale,
      defaultTimezone: tenant.defaultTimezone,
      status: tenant.status,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            plan: {
              id: subscription.plan.id,
              code: subscription.plan.code,
              name: subscription.plan.name,
              billingInterval: subscription.plan.billingInterval,
              amount: subscription.plan.amount,
              currency: subscription.plan.currency,
            },
          }
        : null,
      owner: this.ownerResponse(tenant, invitation),
      usage: { branchCount, userCount },
    };
  }

  async create(context: AuthorizationContext, input: CreatePlatformTenantDto) {
    let invitationId: string;
    try {
      invitationId = await this.dataSource.transaction(async (manager) => {
        const plan = await manager.getRepository(SubscriptionPlan).findOne({
          where: { id: input.planId, isActive: true },
        });
        if (!plan) {
          throw new UnprocessableEntityException(
            'The selected subscription plan is not active.',
          );
        }
        const trialDays = input.trialDays ?? plan.trialDays;
        if (!trialDays) {
          throw new UnprocessableEntityException(
            'trialDays is required when the selected plan has no default trial.',
          );
        }

        const now = new Date();
        const tenant = manager.create(Tenant, {
          legalName: input.legalName,
          displayName: input.displayName,
          slug: input.slug,
          billingEmail: input.billingEmail,
          contactEmail: null,
          contactPhone: null,
          logoUrl: null,
          defaultLocale: input.defaultLocale ?? 'vi',
          defaultTimezone: input.defaultTimezone ?? 'Asia/Ho_Chi_Minh',
          status: TenantStatus.PROVISIONING,
          ownerUserId: null,
          adminSuspendedAt: null,
          adminSuspendedByUserId: null,
        });
        const savedTenant = await manager.getRepository(Tenant).save(tenant);
        const subscription = manager.create(Subscription, {
          tenantId: savedTenant.id,
          planId: plan.id,
          providerCustomerId: null,
          providerSubscriptionId: null,
          status: SubscriptionStatus.TRIAL,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(
            now.getTime() + trialDays * 24 * 60 * 60 * 1000,
          ),
          canceledAt: null,
        });
        await manager.getRepository(Subscription).save(subscription);

        const invitation = await this.createInvitation(
          manager,
          savedTenant.id,
          input,
          context.actor.userId,
          now,
        );
        await manager.getRepository(TenantOwnerInvitation).save(invitation);
        savedTenant.status = TenantStatus.TRIAL;
        await manager.getRepository(Tenant).save(savedTenant);

        await this.auditLogService.record(manager, {
          action: AuditAction.TENANT_CREATED,
          actor: {
            type: AuditActorType.USER,
            userId: context.actor.userId,
            sessionId: context.actor.sessionId,
          },
          tenantId: savedTenant.id,
          resourceId: savedTenant.id,
          after: {
            status: savedTenant.status,
            changedFields: [
              'legalName',
              'displayName',
              'slug',
              'billingEmail',
              'defaultLocale',
              'defaultTimezone',
            ],
            trialDays,
          },
        });
        await this.auditLogService.record(manager, {
          action: AuditAction.TENANT_OWNER_INVITATION_CREATED,
          actor: {
            type: AuditActorType.USER,
            userId: context.actor.userId,
            sessionId: context.actor.sessionId,
          },
          tenantId: savedTenant.id,
          resourceId: invitation.id,
          after: { status: invitation.status },
        });
        return invitation.id;
      });
    } catch (error) {
      this.throwIfTenantUniqueConstraint(error);
      throw error;
    }

    await this.enqueueInvitation(invitationId);
    const invitation = await this.invitationsRepository.findOneByOrFail({
      id: invitationId,
    });
    return this.getPlatformDetail(invitation.tenantId);
  }

  async update(
    context: AuthorizationContext,
    tenantId: string,
    input: UpdatePlatformTenantDto,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const tenant = await manager
        .getRepository(Tenant)
        .createQueryBuilder('tenant')
        .setLock('pessimistic_write')
        .where('tenant.id = :tenantId', { tenantId })
        .getOne();
      if (!tenant) throw new NotFoundException('Tenant was not found.');

      const changedFields = TENANT_EDITABLE_FIELDS.filter(
        (field) => input[field] !== undefined && tenant[field] !== input[field],
      );
      if (changedFields.length === 0) return;

      const before = this.tenantAuditSnapshot(tenant, changedFields);
      changedFields.forEach((field) => {
        tenant[field] = input[field] as never;
      });
      const savedTenant = await manager.getRepository(Tenant).save(tenant);
      await this.auditLogService.record(manager, {
        action: AuditAction.TENANT_UPDATED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: savedTenant.id,
        resourceId: savedTenant.id,
        before,
        after: this.tenantAuditSnapshot(savedTenant, changedFields),
      });
    });
    return this.getPlatformDetail(tenantId);
  }

  async resendOwnerInvitation(context: AuthorizationContext, tenantId: string) {
    const invitationId = await this.dataSource.transaction(async (manager) => {
      const tenant = await manager
        .getRepository(Tenant)
        .createQueryBuilder('tenant')
        .setLock('pessimistic_write')
        .where('tenant.id = :tenantId', { tenantId })
        .getOne();
      if (!tenant) throw new NotFoundException('Tenant was not found.');
      if (tenant.ownerUserId) {
        throw new ConflictException('The tenant owner has already accepted.');
      }

      const invitations = manager.getRepository(TenantOwnerInvitation);
      const current = await invitations
        .createQueryBuilder('invitation')
        .setLock('pessimistic_write')
        .where('invitation.tenantId = :tenantId', { tenantId })
        .andWhere('invitation.status = :status', {
          status: TenantOwnerInvitationStatus.PENDING,
        })
        .getOne();
      if (!current) {
        throw new ConflictException('No pending owner invitation was found.');
      }

      current.status = TenantOwnerInvitationStatus.REVOKED;
      current.revokedAt = new Date();
      await invitations.save(current);
      const replacement = await this.createInvitation(
        manager,
        tenant.id,
        {
          ownerEmail: current.ownerEmail,
          ownerFullName: current.ownerFullName,
        },
        context.actor.userId,
        new Date(),
      );
      await invitations.save(replacement);
      await this.auditLogService.record(manager, {
        action: AuditAction.TENANT_OWNER_INVITATION_RESENT,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: tenant.id,
        resourceId: replacement.id,
        before: { status: TenantOwnerInvitationStatus.PENDING },
        after: { status: TenantOwnerInvitationStatus.PENDING },
      });
      return replacement.id;
    });
    await this.enqueueInvitation(invitationId);
    const invitation = await this.invitationsRepository.findOneByOrFail({
      id: invitationId,
    });
    return this.getPlatformDetail(invitation.tenantId);
  }

  async acceptOwnerInvitation(
    input: AcceptTenantOwnerInvitationDto,
    currentUserId?: string,
  ) {
    const invitationId = this.invitationTokenService.getInvitationId(
      input.token,
    );
    if (!invitationId) throw new NotFoundException('Invitation was not found.');

    return this.dataSource.transaction(async (manager) => {
      const invitation = await manager
        .getRepository(TenantOwnerInvitation)
        .createQueryBuilder('invitation')
        .addSelect('invitation.tokenHash')
        .setLock('pessimistic_write')
        .where('invitation.id = :invitationId', { invitationId })
        .getOne();
      if (
        !invitation ||
        !this.invitationTokenService.matches(invitation, input.token)
      ) {
        throw new NotFoundException('Invitation was not found.');
      }

      const tenant = await manager
        .getRepository(Tenant)
        .createQueryBuilder('tenant')
        .setLock('pessimistic_write')
        .where('tenant.id = :tenantId', { tenantId: invitation.tenantId })
        .getOneOrFail();
      if (
        invitation.status === TenantOwnerInvitationStatus.ACCEPTED &&
        invitation.acceptedByUserId
      ) {
        return {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          ownerUserId: invitation.acceptedByUserId,
        };
      }
      if (
        invitation.status !== TenantOwnerInvitationStatus.PENDING ||
        invitation.expiresAt <= new Date()
      ) {
        throw new NotFoundException('Invitation was not found or has expired.');
      }
      if (tenant.ownerUserId) {
        throw new ConflictException('The tenant already has an owner.');
      }

      const user = await this.resolveInvitationUser(
        manager,
        invitation,
        input,
        currentUserId,
      );
      const assignment = manager.create(RoleAssignment, {
        userId: user.id,
        tenantId: tenant.id,
        branchId: null,
        roleCode: TenantRoleCode.TENANT_ADMIN,
        assignedByUserId: invitation.createdByUserId,
        assignmentReason: 'TENANT_OWNER_INVITATION_ACCEPTED',
        revokedByUserId: null,
        revokedAt: null,
        revocationReason: null,
      });
      const savedAssignment = await manager
        .getRepository(RoleAssignment)
        .save(assignment);
      tenant.ownerUserId = user.id;
      await manager.getRepository(Tenant).save(tenant);
      invitation.status = TenantOwnerInvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      invitation.acceptedByUserId = user.id;
      await manager.getRepository(TenantOwnerInvitation).save(invitation);

      await this.auditLogService.record(manager, {
        action: AuditAction.TENANT_OWNER_INVITATION_ACCEPTED,
        actor: { type: AuditActorType.USER, userId: user.id },
        tenantId: tenant.id,
        resourceId: invitation.id,
        before: { status: TenantOwnerInvitationStatus.PENDING },
        after: { status: TenantOwnerInvitationStatus.ACCEPTED },
      });
      await this.auditLogService.record(manager, {
        action: AuditAction.ROLE_GRANTED,
        actor: { type: AuditActorType.USER, userId: user.id },
        tenantId: tenant.id,
        resourceId: savedAssignment.id,
        reason: 'TENANT_OWNER_INVITATION_ACCEPTED',
        after: {
          roleCode: TenantRoleCode.TENANT_ADMIN,
          branchId: null,
          revokedAt: null,
        },
      });
      return {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        ownerUserId: user.id,
      };
    });
  }

  async suspend(
    context: AuthorizationContext,
    tenantId: string,
    reason: string,
  ) {
    await this.lifecycleService.suspend(context, tenantId, reason);
    return this.getPlatformDetail(tenantId);
  }

  async reactivate(
    context: AuthorizationContext,
    tenantId: string,
    reason: string,
  ) {
    await this.lifecycleService.reactivate(context, tenantId, reason);
    return this.getPlatformDetail(tenantId);
  }

  async extendTrial(
    context: AuthorizationContext,
    tenantId: string,
    days: number,
    reason: string,
  ) {
    await this.lifecycleService.extendTrial(context, tenantId, days, reason);
    return this.getPlatformDetail(tenantId);
  }

  private async createInvitation(
    manager: EntityManager,
    tenantId: string,
    input: Pick<CreatePlatformTenantDto, 'ownerEmail' | 'ownerFullName'>,
    createdByUserId: string,
    now: Date,
  ): Promise<TenantOwnerInvitation> {
    const invitation = manager.create(TenantOwnerInvitation, {
      id: randomUUID(),
      tenantId,
      ownerEmail: input.ownerEmail,
      ownerEmailNormalized: input.ownerEmail.toLowerCase(),
      ownerFullName: input.ownerFullName,
      tokenHash: '',
      status: TenantOwnerInvitationStatus.PENDING,
      expiresAt: new Date(
        now.getTime() + this.appConfig.tenantInvitationConfig.ttlMs,
      ),
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
      deliveryStatus: TenantOwnerInvitationDeliveryStatus.PENDING,
      lastSentAt: null,
      lastDeliveryErrorCode: null,
      createdByUserId,
    });
    invitation.tokenHash = this.invitationTokenService.hashToken(
      this.invitationTokenService.createToken(invitation),
    );
    return invitation;
  }

  private async resolveInvitationUser(
    manager: EntityManager,
    invitation: TenantOwnerInvitation,
    input: AcceptTenantOwnerInvitationDto,
    currentUserId?: string,
  ): Promise<User> {
    const users = manager.getRepository(User);
    if (currentUserId) {
      const user = await users.findOneBy({ id: currentUserId });
      if (
        !user ||
        user.status !== UserStatus.ACTIVE ||
        user.emailNormalized !== invitation.ownerEmailNormalized
      ) {
        throw new ConflictException(
          'The signed-in account does not match this owner invitation.',
        );
      }
      return user;
    }
    const existing = await users.findOneBy({
      emailNormalized: invitation.ownerEmailNormalized,
    });
    if (existing) {
      throw new ConflictException(
        'Sign in with the invited email before accepting this invitation.',
      );
    }
    if (!input.fullName || !input.password) {
      throw new UnprocessableEntityException(
        'fullName and password are required for a new owner account.',
      );
    }
    return users.save(
      users.create({
        email: invitation.ownerEmail,
        emailNormalized: invitation.ownerEmailNormalized,
        fullName: input.fullName,
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

  private async findCurrentSubscription(
    manager: EntityManager,
    tenantId: string,
  ): Promise<Subscription | null> {
    return manager.getRepository(Subscription).findOne({
      where: { tenantId, canceledAt: IsNull() },
      relations: { plan: true },
    });
  }

  private async countActiveTenantUsers(tenantId: string): Promise<number> {
    const row = await this.dataSource
      .getRepository(RoleAssignment)
      .createQueryBuilder('assignment')
      .select('COUNT(DISTINCT assignment.user_id)', 'count')
      .where('assignment.tenant_id = :tenantId', { tenantId })
      .andWhere('assignment.revoked_at IS NULL')
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private ownerResponse(
    tenant: Tenant,
    invitation: TenantOwnerInvitation | null,
  ) {
    if (tenant.ownerUser) {
      return {
        state: 'ACCEPTED' as const,
        userId: tenant.ownerUser.id,
        fullName: tenant.ownerUser.fullName,
        email: tenant.ownerUser.email,
      };
    }
    if (!invitation) return null;
    return {
      state:
        invitation.expiresAt <= new Date()
          ? ('EXPIRED' as const)
          : ('PENDING' as const),
      fullName: invitation.ownerFullName,
      email: invitation.ownerEmail,
      invitation: {
        id: invitation.id,
        expiresAt: invitation.expiresAt,
        deliveryStatus: invitation.deliveryStatus,
        lastSentAt: invitation.lastSentAt,
      },
    };
  }

  private tenantAuditSnapshot(
    tenant: Tenant,
    changedFields: readonly TenantEditableField[],
  ): Record<string, unknown> {
    return { status: tenant.status, changedFields: [...changedFields] };
  }

  private async enqueueInvitation(invitationId: string): Promise<void> {
    try {
      await this.invitationJobs.enqueueOwnerInvitation(invitationId);
    } catch {
      await this.invitationsRepository.update(invitationId, {
        deliveryStatus: TenantOwnerInvitationDeliveryStatus.FAILED,
        lastDeliveryErrorCode: 'ENQUEUE_FAILED',
      });
    }
  }

  private throwIfTenantUniqueConstraint(error: unknown): void {
    const driverError =
      error instanceof QueryFailedError
        ? (error as { driverError: unknown }).driverError
        : undefined;
    if (
      typeof driverError === 'object' &&
      driverError !== null &&
      (driverError as { code?: unknown }).code === '23505'
    ) {
      throw new ConflictException('Tenant slug already exists.');
    }
  }
}
