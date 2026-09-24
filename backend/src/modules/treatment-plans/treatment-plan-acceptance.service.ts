import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  applyOffsetPagination,
  toPageMeta,
} from '../../common/database/query-builder-list.util';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Patient } from '../patients/entities/patient.entity';
import { ListTreatmentPlanAcceptancesQueryDto } from './dto/list-treatment-plan-acceptances-query.dto';
import { TreatmentPlanStatus } from './entities/treatment-plan.entity';
import { TreatmentPlansRepository } from './treatment-plans.repository';

export type TreatmentPlanAcceptanceQueueItem = {
  id: string;
  patient: { fullName: string; phone: string };
  status: TreatmentPlanStatus.PROPOSED;
  createdAt: Date;
  updatedAt: Date;
};

export type TreatmentPlanAcceptanceReceipt = {
  id: string;
  status: TreatmentPlanStatus.ACCEPTED;
  acceptedByUserId: string;
  acceptedAt: Date;
};

@Injectable()
export class TreatmentPlanAcceptanceService {
  constructor(
    private readonly repository: TreatmentPlansRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditLogService,
  ) {}

  async list(context: AuthorizationContext, query: ListTreatmentPlanAcceptancesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const qb = this.repository.plans
      .createQueryBuilder('plan')
      .innerJoin(Patient, 'patient', 'patient.id = plan.patientId AND patient.tenantId = plan.tenantId')
      .select([
        'plan.id AS id',
        'plan.status AS status',
        'plan.created_at AS "createdAt"',
        'plan.updated_at AS "updatedAt"',
        'patient.full_name AS "fullName"',
        'patient.phone AS phone',
      ])
      .where('plan.tenantId = :tenantId', { tenantId: context.tenant!.id })
      .andWhere('plan.branchId = :branchId', { branchId: context.branch!.id })
      .andWhere('plan.status = :status', { status: TreatmentPlanStatus.PROPOSED })
      .orderBy('plan.createdAt', 'DESC')
      .addOrderBy('plan.id', 'DESC');
    applyOffsetPagination(qb, { page, limit });
    const [plans, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

    return {
      items: plans.map((plan) => this.toQueueItem(plan)),
      meta: toPageMeta({ page, limit }, total),
    };
  }

  async accept(context: AuthorizationContext, planId: string): Promise<TreatmentPlanAcceptanceReceipt> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.repository.findPlanForUpdate(
        manager,
        context.tenant!.id,
        context.branch!.id,
        planId,
      );
      if (!plan) throw new NotFoundException('Treatment Plan was not found.');
      if (plan.status !== TreatmentPlanStatus.PROPOSED) {
        throw new ConflictException('Only Proposed Treatment Plans may be accepted.');
      }

      const before = plan.status;
      plan.status = TreatmentPlanStatus.ACCEPTED;
      plan.acceptedByUserId = context.actor.userId;
      plan.acceptedAt = new Date();
      await manager.save(plan);
      await this.audit.record(manager, {
        action: AuditAction.TREATMENT_PLAN_STATE_CHANGED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
        resourceId: plan.id,
        before: { status: before },
        after: { status: plan.status },
      });
      await this.audit.record(manager, {
        action: AuditAction.TREATMENT_PLAN_ACCEPTED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
        resourceId: plan.id,
        after: { status: plan.status },
      });

      return {
        id: plan.id,
        status: TreatmentPlanStatus.ACCEPTED,
        acceptedByUserId: plan.acceptedByUserId,
        acceptedAt: plan.acceptedAt,
      };
    });
  }

  /** This mapper is intentionally acceptance-only and never receives items. */
  private toQueueItem(plan: {
    id: string;
    status: TreatmentPlanStatus.PROPOSED;
    createdAt: Date;
    updatedAt: Date;
    fullName: string;
    phone: string;
  }): TreatmentPlanAcceptanceQueueItem {
    return {
      id: plan.id,
      patient: { fullName: plan.fullName, phone: plan.phone },
      status: TreatmentPlanStatus.PROPOSED,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
