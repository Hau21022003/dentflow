import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/entities/subscription.entity';
import { Tenant, TenantStatus } from './entities/tenant.entity';

@Injectable()
export class TenantLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async suspend(
    context: AuthorizationContext,
    tenantId: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const tenant = await this.findTenantForUpdate(manager, tenantId);
      if (tenant.adminSuspendedAt) {
        return;
      }

      const before = this.tenantSnapshot(tenant);
      tenant.adminSuspendedAt = new Date();
      tenant.adminSuspendedByUserId = context.actor.userId;
      tenant.status = TenantStatus.SUSPENDED;
      await manager.getRepository(Tenant).save(tenant);

      await this.auditLogService.record(manager, {
        action: AuditAction.TENANT_SUSPENDED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: tenant.id,
        resourceId: tenant.id,
        reason,
        before,
        after: this.tenantSnapshot(tenant),
      });
    });
  }

  async reactivate(
    context: AuthorizationContext,
    tenantId: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const tenant = await this.findTenantForUpdate(manager, tenantId);
      if (!tenant.adminSuspendedAt) {
        return;
      }

      const subscription = await this.findOpenSubscriptionForUpdate(
        manager,
        tenant.id,
      );
      const restoredStatus = this.deriveSubscriptionStatus(
        subscription,
        new Date(),
      );
      if (
        restoredStatus !== TenantStatus.ACTIVE &&
        restoredStatus !== TenantStatus.TRIAL
      ) {
        throw new ConflictException(
          'Tenant can only be reactivated with an active or valid trial subscription.',
        );
      }

      const before = this.tenantSnapshot(tenant);
      tenant.adminSuspendedAt = null;
      tenant.adminSuspendedByUserId = null;
      tenant.status = restoredStatus;
      await manager.getRepository(Tenant).save(tenant);

      await this.auditLogService.record(manager, {
        action: AuditAction.TENANT_REACTIVATED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: tenant.id,
        resourceId: tenant.id,
        reason,
        before,
        after: this.tenantSnapshot(tenant),
      });
    });
  }

  async extendTrial(
    context: AuthorizationContext,
    tenantId: string,
    days: number,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const tenant = await this.findTenantForUpdate(manager, tenantId);
      if (
        tenant.status !== TenantStatus.TRIAL &&
        tenant.status !== TenantStatus.PAST_DUE
      ) {
        throw new ConflictException(
          'Trials can only be extended for TRIAL or PAST_DUE tenants.',
        );
      }

      const subscription = await this.findOpenSubscriptionForUpdate(
        manager,
        tenant.id,
      );
      if (
        subscription.status !== SubscriptionStatus.TRIAL &&
        subscription.status !== SubscriptionStatus.PAST_DUE
      ) {
        throw new ConflictException(
          'The current subscription is not eligible for a trial extension.',
        );
      }

      const now = new Date();
      const base =
        subscription.currentPeriodEnd && subscription.currentPeriodEnd > now
          ? subscription.currentPeriodEnd
          : now;
      const trialEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      const tenantBefore = this.tenantSnapshot(tenant);
      const subscriptionBefore = this.subscriptionSnapshot(subscription);

      subscription.status = SubscriptionStatus.TRIAL;
      subscription.currentPeriodStart ??= now;
      subscription.currentPeriodEnd = trialEnd;
      await manager.getRepository(Subscription).save(subscription);

      tenant.status = TenantStatus.TRIAL;
      await manager.getRepository(Tenant).save(tenant);

      await this.auditLogService.record(manager, {
        action: AuditAction.TENANT_TRIAL_EXTENDED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: tenant.id,
        resourceId: tenant.id,
        reason,
        before: tenantBefore,
        after: { ...this.tenantSnapshot(tenant), trialDays: days },
      });
      await this.auditLogService.record(manager, {
        action: AuditAction.SAAS_SUBSCRIPTION_UPDATED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: tenant.id,
        resourceId: subscription.id,
        before: subscriptionBefore,
        after: this.subscriptionSnapshot(subscription),
        metadata: { reasonCode: 'TRIAL_EXTENDED_BY_PLATFORM' },
      });
    });
  }

  private async findTenantForUpdate(
    manager: EntityManager,
    tenantId: string,
  ): Promise<Tenant> {
    const tenant = await manager
      .getRepository(Tenant)
      .createQueryBuilder('tenant')
      .setLock('pessimistic_write')
      .where('tenant.id = :tenantId', { tenantId })
      .getOne();
    if (!tenant) {
      throw new NotFoundException('Tenant was not found.');
    }
    return tenant;
  }

  private async findOpenSubscriptionForUpdate(
    manager: EntityManager,
    tenantId: string,
  ): Promise<Subscription> {
    const subscription = await manager
      .getRepository(Subscription)
      .createQueryBuilder('subscription')
      .setLock('pessimistic_write')
      .where('subscription.tenantId = :tenantId', { tenantId })
      .andWhere('subscription.canceledAt IS NULL')
      .getOne();
    if (!subscription) {
      throw new ConflictException('Tenant has no current subscription.');
    }
    return subscription;
  }

  private deriveSubscriptionStatus(
    subscription: Subscription,
    now: Date,
  ): TenantStatus {
    if (
      (subscription.status === SubscriptionStatus.TRIAL ||
        subscription.status === SubscriptionStatus.ACTIVE) &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd <= now
    ) {
      return TenantStatus.PAST_DUE;
    }

    switch (subscription.status) {
      case SubscriptionStatus.TRIAL:
        return TenantStatus.TRIAL;
      case SubscriptionStatus.ACTIVE:
        return TenantStatus.ACTIVE;
      case SubscriptionStatus.PAST_DUE:
        return TenantStatus.PAST_DUE;
      case SubscriptionStatus.CANCELED:
        return TenantStatus.CANCELED;
      case SubscriptionStatus.SUSPENDED:
        return TenantStatus.SUSPENDED;
    }
  }

  private tenantSnapshot(tenant: Tenant): Record<string, unknown> {
    return { status: tenant.status };
  }

  private subscriptionSnapshot(
    subscription: Subscription,
  ): Record<string, unknown> {
    return {
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    };
  }
}
