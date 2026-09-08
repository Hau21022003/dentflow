import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { RequestFieldValidationException } from 'src/common/exceptions/request-field-validation.exception';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { SubscriptionPlansRepository } from './subscription-plans.repository';

const PLAN_EDITABLE_FIELDS = [
  'name',
  'description',
  'billingInterval',
  'amount',
  'currency',
  'providerPlanId',
  'trialDays',
  'entitlements',
  'isActive',
] as const;

type PlanEditableField = (typeof PLAN_EDITABLE_FIELDS)[number];

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly subscriptionPlansRepository: SubscriptionPlansRepository,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  list(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlansRepository.findAll();
  }

  async create(
    context: AuthorizationContext,
    input: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const plan = manager.create(SubscriptionPlan, {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          billingInterval: input.billingInterval,
          amount: input.amount,
          currency: input.currency,
          providerPlanId: input.providerPlanId ?? null,
          trialDays: input.trialDays ?? null,
          entitlements: input.entitlements ?? {},
          isActive: true,
        });
        const savedPlan = await manager.save(plan);

        await this.auditLogService.record(manager, {
          action: AuditAction.PLAN_CREATED,
          actor: {
            type: AuditActorType.USER,
            userId: context.actor.userId,
            sessionId: context.actor.sessionId,
          },
          resourceId: savedPlan.id,
          after: this.toAuditSnapshot(savedPlan, PLAN_EDITABLE_FIELDS),
        });

        return savedPlan;
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }

  async update(
    context: AuthorizationContext,
    planId: string,
    input: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const plan = await this.findByIdOrFail(manager, planId);

        const requestedValues = this.toRequestedValues(input);
        const changedFields = PLAN_EDITABLE_FIELDS.filter(
          (field) =>
            requestedValues[field] !== undefined &&
            !isDeepStrictEqual(plan[field], requestedValues[field]),
        );

        if (changedFields.length === 0) {
          return plan;
        }

        const availabilityChanged = changedFields.includes('isActive');
        if (availabilityChanged && !input.reason) {
          this.throwMissingAvailabilityReason();
        }

        const commercialFields = changedFields.filter(
          (field) => field !== 'isActive',
        );
        if (
          commercialFields.length > 0 &&
          (await this.subscriptionPlansRepository.hasSubscriptionHistory(
            manager,
            plan.id,
          ))
        ) {
          throw new ConflictException(
            'A subscription plan with subscription history can only change availability.',
          );
        }

        const before = this.toAuditSnapshot(plan, changedFields);
        changedFields.forEach((field) => {
          (plan as unknown as Record<string, unknown>)[field] =
            requestedValues[field];
        });
        const savedPlan = await manager.save(plan);
        const action = availabilityChanged
          ? savedPlan.isActive
            ? AuditAction.PLAN_ACTIVATED
            : AuditAction.PLAN_DEACTIVATED
          : AuditAction.PLAN_UPDATED;

        await this.auditLogService.record(manager, {
          action,
          actor: {
            type: AuditActorType.USER,
            userId: context.actor.userId,
            sessionId: context.actor.sessionId,
          },
          resourceId: savedPlan.id,
          ...(availabilityChanged ? { reason: input.reason } : {}),
          before,
          after: this.toAuditSnapshot(savedPlan, changedFields),
        });

        return savedPlan;
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }

  private toRequestedValues(
    input: UpdateSubscriptionPlanDto,
  ): Record<PlanEditableField, unknown> {
    return {
      name: input.name,
      description: input.description,
      billingInterval: input.billingInterval,
      amount: input.amount,
      currency: input.currency,
      providerPlanId: input.providerPlanId,
      trialDays: input.trialDays,
      entitlements: input.entitlements,
      isActive: input.isActive,
    };
  }

  private async findByIdOrFail(
    manager: EntityManager,
    planId: string,
  ): Promise<SubscriptionPlan> {
    const plan = await this.subscriptionPlansRepository.findById(
      manager,
      planId,
    );
    if (!plan) {
      throw new NotFoundException('Subscription plan was not found.');
    }

    return plan;
  }

  private toAuditSnapshot(
    plan: SubscriptionPlan,
    changedFields: readonly PlanEditableField[],
  ): Record<string, unknown> {
    return {
      changedFields: [...changedFields],
      isActive: plan.isActive,
      amount: plan.amount,
      currency: plan.currency,
    };
  }

  private throwMissingAvailabilityReason(): never {
    throw new RequestFieldValidationException(
      'reason',
      'reason is required when plan availability changes.',
    );
  }

  private throwIfUniqueConstraint(error: unknown): void {
    const driverError =
      error instanceof QueryFailedError
        ? (error as { driverError: unknown }).driverError
        : undefined;

    if (
      typeof driverError === 'object' &&
      driverError !== null &&
      (driverError as { code?: unknown }).code === '23505'
    ) {
      throw new ConflictException(
        'Subscription plan code or provider plan ID already exists.',
      );
    }
  }
}
