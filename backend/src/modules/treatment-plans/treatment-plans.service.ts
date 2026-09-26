import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  applyOffsetPagination,
  toPageMeta,
} from '../../common/database/query-builder-list.util';
import { RequestFieldValidationException } from '../../common/exceptions/request-field-validation.exception';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import { AppointmentsRepository } from '../appointments/appointments.repository';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  RoleAssignment,
  TenantRoleCode,
} from '../authorization/entities/role-assignment.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Service } from '../services/entities/service.entity';
import { TenantUserMembershipStatus } from '../staff/entities/tenant-user-membership.entity';
import { Visit, VisitStatus } from '../visits/entities/visit.entity';
import { ListTreatmentItemEventsDto } from './dto/list-treatment-item-events.dto';
import { ListTreatmentPlansQueryDto } from './dto/list-treatment-plans-query.dto';
import { RecordTreatmentItemEventDto } from './dto/record-treatment-item-event.dto';
import {
  SyncTreatmentPlanDto,
  TreatmentPlanItemInputDto,
} from './dto/sync-treatment-plan.dto';
import { TreatmentReasonDto } from './dto/treatment-reason.dto';
import {
  TreatmentItemEvent,
  TreatmentItemEventType,
} from './entities/treatment-item-event.entity';
import {
  TreatmentItem,
  TreatmentItemStatus,
} from './entities/treatment-item.entity';
import {
  TreatmentPlan,
  TreatmentPlanStatus,
} from './entities/treatment-plan.entity';
import { TreatmentPlansRepository } from './treatment-plans.repository';

type CurrentCase = { appointment: Appointment; visit: Visit };
export interface TreatmentPlanResponse {
  id: string;
  originVisitId: string;
  patientId: string;
  status: TreatmentPlanStatus;
  acceptedByUserId: string | null;
  acceptedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    serviceId: string;
    serviceCode: string;
    serviceName: string;
    listUnitAmount: number;
    currency: string;
    quantity: number;
    discountAmount: number;
    finalUnitAmount: number;
    toothPosition: string | null;
    indication: string | null;
    plannedDentistUserId: string;
    status: TreatmentItemStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

@Injectable()
export class TreatmentPlansService {
  constructor(
    private readonly repository: TreatmentPlansRepository,
    private readonly appointments: AppointmentsRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditLogService,
  ) {}

  async list(
    context: AuthorizationContext,
    visitId: string,
    query: ListTreatmentPlansQueryDto,
  ) {
    const current = await this.resolveCurrentCase(context, visitId);
    const page = query.page ?? 1,
      limit = query.limit ?? 10;
    const qb = this.repository.plans
      .createQueryBuilder('plan')
      .where('plan.tenantId=:tenantId', { tenantId: context.tenant!.id })
      .andWhere('plan.branchId=:branchId', { branchId: context.branch!.id })
      .andWhere('plan.patientId=:patientId', {
        patientId: current.appointment.patientId,
      })
      .orderBy('plan.createdAt', 'DESC')
      .addOrderBy('plan.id', 'DESC');
    applyOffsetPagination(qb, { page, limit });
    const [plans, total] = await qb.getManyAndCount();
    const items = await Promise.all(
      plans.map((plan) =>
        this.toResponse(
          plan,
          this.repository.items.find({
            where: { treatmentPlanId: plan.id },
            order: { id: 'ASC' },
          }),
        ),
      ),
    );
    return { items, meta: toPageMeta({ page, limit }, total) };
  }

  async create(
    context: AuthorizationContext,
    visitId: string,
  ): Promise<TreatmentPlanResponse> {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.resolveCurrentCase(context, visitId, manager);
      const plan = await manager.save(
        manager.create(TreatmentPlan, {
          tenantId: context.tenant!.id,
          branchId: context.branch!.id,
          patientId: current.appointment.patientId,
          originVisitId: current.visit.id,
          createdByUserId: context.actor.userId,
          status: TreatmentPlanStatus.DRAFT,
          acceptedByUserId: null,
          acceptedAt: null,
        }),
      );
      await this.recordPlanState(manager, context, plan, undefined, undefined);
      return this.toResponse(plan, []);
    });
  }

  async get(
    context: AuthorizationContext,
    visitId: string,
    planId: string,
  ): Promise<TreatmentPlanResponse> {
    const current = await this.resolveCurrentCase(context, visitId);
    const plan = await this.findPlanForCaseOrFail(context, current, planId);
    return this.toResponse(
      plan,
      this.repository.items.find({
        where: { treatmentPlanId: plan.id },
        order: { id: 'ASC' },
      }),
    );
  }

  async sync(
    context: AuthorizationContext,
    visitId: string,
    planId: string,
    input: SyncTreatmentPlanDto,
  ): Promise<TreatmentPlanResponse> {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.resolveCurrentCase(context, visitId, manager);
      const plan = await this.findPlanForCaseOrFail(
        context,
        current,
        planId,
        manager,
      );
      if (plan.status !== TreatmentPlanStatus.DRAFT)
        throw new ConflictException(
          'Only Draft Treatment Plans may be synchronized.',
        );
      const ids = input.items.flatMap((item) => (item.id ? [item.id] : []));
      if (new Set(ids).size !== ids.length)
        throw new RequestFieldValidationException(
          'items',
          'Item IDs must be unique.',
        );
      const existing = await this.repository.findItems(manager, plan.id, true);
      const byId = new Map(existing.map((i) => [i.id, i]));
      for (const id of ids)
        if (!byId.has(id))
          throw new NotFoundException('Treatment Item was not found.');
      const next: TreatmentItem[] = [];
      for (const inputItem of input.items)
        next.push(
          await this.materializeItem(
            manager,
            context,
            plan,
            inputItem,
            byId.get(inputItem.id ?? ''),
          ),
        );
      const submitted = new Set(ids);
      const deleted = existing.filter((item) => !submitted.has(item.id));
      if (deleted.length) await manager.remove(deleted);
      if (next.length) await manager.save(next);
      return this.toResponse(
        plan,
        next.sort((a, b) => a.id.localeCompare(b.id)),
      );
    });
  }

  async propose(
    context: AuthorizationContext,
    visitId: string,
    planId: string,
  ): Promise<TreatmentPlanResponse> {
    return this.transitionPlan(
      context,
      visitId,
      planId,
      TreatmentPlanStatus.DRAFT,
      TreatmentPlanStatus.PROPOSED,
    );
  }
  async reopen(
    context: AuthorizationContext,
    visitId: string,
    planId: string,
    input: TreatmentReasonDto,
  ): Promise<TreatmentPlanResponse> {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.resolveCurrentCase(context, visitId, manager);
      const plan = await this.findPlanForCaseOrFail(
        context,
        current,
        planId,
        manager,
      );
      if (plan.status !== TreatmentPlanStatus.PROPOSED)
        throw new ConflictException(
          'Only Proposed Treatment Plans may be reopened.',
        );
      const before = plan.status;
      plan.status = TreatmentPlanStatus.DRAFT;
      plan.acceptedAt = null;
      plan.acceptedByUserId = null;
      await manager.save(plan);
      await this.recordPlanState(
        manager,
        context,
        plan,
        before,
        input.reasonCode,
      );
      await this.record(
        manager,
        context,
        AuditAction.TREATMENT_PLAN_REOPENED,
        plan.id,
        {
          after: { status: plan.status },
          metadata: { reasonCode: input.reasonCode },
        },
      );
      return this.toResponse(
        plan,
        await this.repository.findItems(manager, plan.id),
      );
    });
  }
  async cancel(
    context: AuthorizationContext,
    visitId: string,
    planId: string,
    input: TreatmentReasonDto,
  ): Promise<TreatmentPlanResponse> {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.resolveCurrentCase(context, visitId, manager);
      const plan = await this.findPlanForCaseOrFail(
        context,
        current,
        planId,
        manager,
      );
      if (
        ![
          TreatmentPlanStatus.DRAFT,
          TreatmentPlanStatus.PROPOSED,
          TreatmentPlanStatus.ACCEPTED,
        ].includes(plan.status)
      )
        throw new ConflictException(
          'Treatment Plan cannot be cancelled from its current state.',
        );
      const events = await manager
        .getRepository(TreatmentItemEvent)
        .countBy({ treatmentPlanId: plan.id });
      if (events)
        throw new ConflictException(
          'Treatment Plans with execution events cannot be directly cancelled.',
        );
      const items = await this.repository.findItems(manager, plan.id, true);
      for (const item of items.filter(
        (i) => i.status === TreatmentItemStatus.PENDING,
      )) {
        const before = item.status;
        item.status = TreatmentItemStatus.CANCELLED;
        await manager.save(item);
        await this.recordItemState(
          manager,
          context,
          item,
          before,
          input.reasonCode,
        );
      }
      const before = plan.status;
      plan.status = TreatmentPlanStatus.CANCELLED;
      await manager.save(plan);
      await this.recordPlanState(
        manager,
        context,
        plan,
        before,
        input.reasonCode,
      );
      return this.toResponse(plan, items);
    });
  }
  async listEvents(
    context: AuthorizationContext,
    visitId: string,
    planId: string,
    itemId: string,
    query: ListTreatmentItemEventsDto,
  ) {
    const current = await this.resolveCurrentCase(context, visitId);
    await this.findPlanForCaseOrFail(context, current, planId);
    const item = await this.repository.items.findOneBy({
      id: itemId,
      treatmentPlanId: planId,
    });
    if (!item) throw new NotFoundException('Treatment Item was not found.');
    const records = await this.repository.findEventsPage(
      planId,
      itemId,
      query.cursor ? this.decodeCursor(query.cursor) : undefined,
    );
    const page = records.length > 50 ? records.slice(0, 50) : records;
    const last = page.at(-1);
    return {
      items: page.map((e) => ({
        id: e.id,
        visitId: e.visitId,
        performedByUserId: e.performedByUserId,
        eventType: e.eventType,
        createdAt: e.createdAt,
      })),
      nextCursor:
        records.length > 50 && last
          ? this.encodeCursor(last.createdAt, last.id)
          : null,
    };
  }
  async recordEvent(
    context: AuthorizationContext,
    visitId: string,
    planId: string,
    itemId: string,
    input: RecordTreatmentItemEventDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.resolveCurrentCase(context, visitId, manager);
      const plan = await this.findPlanForCaseOrFail(
        context,
        current,
        planId,
        manager,
      );
      if (
        ![
          TreatmentPlanStatus.ACCEPTED,
          TreatmentPlanStatus.PARTIALLY_COMPLETED,
        ].includes(plan.status)
      )
        throw new ConflictException(
          'Treatment Plan is not eligible for execution.',
        );
      const item = await this.repository.findItemForUpdate(
        manager,
        plan.id,
        itemId,
      );
      if (!item) throw new NotFoundException('Treatment Item was not found.');
      const prior = item.status;
      this.assertEventTransition(item, input);
      const event = await manager.save(
        manager.create(TreatmentItemEvent, {
          treatmentItemId: item.id,
          treatmentPlanId: plan.id,
          visitId: current.visit.id,
          performedByUserId: context.actor.userId,
          eventType: input.eventType,
        }),
      );
      if (
        input.eventType === TreatmentItemEventType.IN_PROGRESS &&
        item.status === TreatmentItemStatus.PENDING
      )
        item.status = TreatmentItemStatus.IN_PROGRESS;
      if (input.eventType === TreatmentItemEventType.COMPLETED)
        item.status = TreatmentItemStatus.COMPLETED;
      if (input.eventType === TreatmentItemEventType.CANCELLED)
        item.status = TreatmentItemStatus.CANCELLED;
      if (prior !== item.status) {
        await manager.save(item);
        await this.recordItemState(
          manager,
          context,
          item,
          prior,
          input.reasonCode,
        );
      }
      const all = await this.repository.findItems(manager, plan.id, true);
      const derived = this.derivePlanStatus(all);
      if (derived && derived !== plan.status) {
        const before = plan.status;
        plan.status = derived;
        await manager.save(plan);
        await this.recordPlanState(
          manager,
          context,
          plan,
          before,
          input.reasonCode,
        );
      }
      await this.record(
        manager,
        context,
        AuditAction.TREATMENT_ITEM_EVENT_RECORDED,
        event.id,
        {
          after: { status: item.status, visitId: event.visitId },
          ...(input.reasonCode
            ? { metadata: { reasonCode: input.reasonCode } }
            : {}),
        },
      );
      return {
        id: event.id,
        eventType: event.eventType,
        visitId: event.visitId,
        performedByUserId: event.performedByUserId,
        createdAt: event.createdAt,
        itemStatus: item.status,
        planStatus: plan.status,
      };
    });
  }

  private async transitionPlan(
    context: AuthorizationContext,
    visitId: string,
    planId: string,
    from: TreatmentPlanStatus,
    to: TreatmentPlanStatus,
  ): Promise<TreatmentPlanResponse> {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.resolveCurrentCase(context, visitId, manager);
      const plan = await this.findPlanForCaseOrFail(
        context,
        current,
        planId,
        manager,
      );
      if (plan.status !== from)
        throw new ConflictException(
          'Treatment Plan cannot transition from its current state.',
        );
      const items = await this.repository.findItems(manager, plan.id, true);
      if (to === TreatmentPlanStatus.PROPOSED && !items.length)
        throw new ConflictException(
          'A Treatment Plan needs at least one item before proposal.',
        );
      plan.status = to;
      await manager.save(plan);
      await this.recordPlanState(manager, context, plan, from, undefined);
      return this.toResponse(plan, items);
    });
  }
  private async resolveCurrentCase(
    context: AuthorizationContext,
    visitId: string,
    manager?: EntityManager,
  ): Promise<CurrentCase> {
    const appointments = manager
      ? manager.getRepository(Appointment)
      : this.appointments.ormRepository;
    const aq = appointments
      .createQueryBuilder('appointment')
      .where('appointment.tenantId=:tenantId', { tenantId: context.tenant!.id })
      .andWhere('appointment.branchId=:branchId', {
        branchId: context.branch!.id,
      });
    if (manager) aq.setLock('pessimistic_write');
    const visitRepo = manager
      ? manager.getRepository(Visit)
      : this.dataSource.getRepository(Visit);
    const vq = visitRepo
      .createQueryBuilder('visit')
      .where('visit.id=:visitId', { visitId })
      .andWhere('visit.tenantId=:tenantId', { tenantId: context.tenant!.id })
      .andWhere('visit.branchId=:branchId', { branchId: context.branch!.id });
    const discoveredVisit = await vq.getOne();
    if (!discoveredVisit) throw new NotFoundException('Visit was not found.');
    const appointment = await aq
      .andWhere('appointment.id=:appointmentId', {
        appointmentId: discoveredVisit.appointmentId,
      })
      .getOne();
    if (!appointment) throw new NotFoundException('Visit was not found.');
    if (manager) vq.setLock('pessimistic_write');
    const visit = manager ? await vq.getOne() : discoveredVisit;
    if (!visit) throw new NotFoundException('Visit was not found.');
    if (
      visit.status !== VisitStatus.OPEN ||
      appointment.status !== AppointmentStatus.IN_PROGRESS
    )
      throw new ConflictException(
        'Current Visit must be open and its Appointment in progress.',
      );
    if (appointment.assignedDentistUserId !== context.actor.userId)
      throw new ForbiddenException(
        'Only the assigned Dentist may access this Treatment Plan.',
      );
    return { appointment, visit };
  }
  private async findPlanForCaseOrFail(
    context: AuthorizationContext,
    current: CurrentCase,
    planId: string,
    manager?: EntityManager,
  ) {
    const plan = manager
      ? await this.repository.findPlanForUpdate(
          manager,
          context.tenant!.id,
          context.branch!.id,
          planId,
        )
      : await this.repository.findPlan(
          context.tenant!.id,
          context.branch!.id,
          planId,
        );
    if (!plan || plan.patientId !== current.appointment.patientId)
      throw new NotFoundException('Treatment Plan was not found.');
    return plan;
  }
  private async materializeItem(
    manager: EntityManager,
    context: AuthorizationContext,
    plan: TreatmentPlan,
    input: TreatmentPlanItemInputDto,
    existing?: TreatmentItem,
  ) {
    const service = await manager.getRepository(Service).findOneBy({
      id: input.serviceId,
      tenantId: context.tenant!.id,
      isActive: true,
    });
    if (!service)
      throw new RequestFieldValidationException(
        'items',
        'Service must be active in this tenant.',
      );
    const dentist = await manager
      .getRepository(RoleAssignment)
      .createQueryBuilder('assignment')
      .innerJoin(
        'tenant_user_memberships',
        'membership',
        'membership.user_id=assignment.user_id AND membership.tenant_id=assignment.tenant_id AND membership.status=:status',
        { status: TenantUserMembershipStatus.ACTIVE },
      )
      .where('assignment.userId=:userId', {
        userId: input.plannedDentistUserId,
      })
      .andWhere('assignment.tenantId=:tenantId', { tenantId: plan.tenantId })
      .andWhere('assignment.branchId=:branchId', { branchId: plan.branchId })
      .andWhere('assignment.roleCode=:role', { role: TenantRoleCode.DENTIST })
      .andWhere('assignment.revokedAt IS NULL')
      .getOne();
    if (!dentist)
      throw new RequestFieldValidationException(
        'items',
        'Planned Dentist must have an active Dentist grant in this branch.',
      );
    const values = {
      treatmentPlanId: plan.id,
      serviceId: service.id,
      serviceCode: service.code,
      serviceName: service.name,
      listUnitAmount: service.amount,
      currency: service.currency,
      quantity: input.quantity,
      discountAmount: input.discountAmount,
      finalUnitAmount: service.amount - input.discountAmount,
      toothPosition: input.toothPosition?.trim() || null,
      indication: input.indication?.trim() || null,
      plannedDentistUserId: input.plannedDentistUserId,
      status: existing?.status ?? TreatmentItemStatus.PENDING,
    };
    if (values.finalUnitAmount < 0)
      throw new RequestFieldValidationException(
        'items.discountAmount',
        'Discount cannot exceed the service list amount.',
      );
    return existing
      ? Object.assign(existing, values)
      : manager.create(TreatmentItem, values);
  }
  private assertEventTransition(
    item: TreatmentItem,
    input: RecordTreatmentItemEventDto,
  ) {
    if (
      input.eventType === TreatmentItemEventType.IN_PROGRESS &&
      ![TreatmentItemStatus.PENDING, TreatmentItemStatus.IN_PROGRESS].includes(
        item.status,
      )
    )
      throw new ConflictException(
        'Item cannot be started from its current state.',
      );
    if (
      input.eventType === TreatmentItemEventType.COMPLETED &&
      item.status !== TreatmentItemStatus.IN_PROGRESS
    )
      throw new ConflictException('Only in-progress Items may be completed.');
    if (
      input.eventType === TreatmentItemEventType.CANCELLED &&
      ![TreatmentItemStatus.PENDING, TreatmentItemStatus.IN_PROGRESS].includes(
        item.status,
      )
    )
      throw new ConflictException(
        'Item cannot be cancelled from its current state.',
      );
    if (
      input.eventType === TreatmentItemEventType.CANCELLED &&
      !input.reasonCode
    )
      throw new BadRequestException('Cancellation requires a reason code.');
  }
  private derivePlanStatus(
    items: TreatmentItem[],
  ): TreatmentPlanStatus | undefined {
    if (!items.length) return undefined;
    const allTerminal = items.every((i) =>
      [TreatmentItemStatus.COMPLETED, TreatmentItemStatus.CANCELLED].includes(
        i.status,
      ),
    );
    const completed = items.some(
      (i) => i.status === TreatmentItemStatus.COMPLETED,
    );
    if (allTerminal)
      return completed
        ? TreatmentPlanStatus.COMPLETED
        : TreatmentPlanStatus.CANCELLED;
    if (completed) return TreatmentPlanStatus.PARTIALLY_COMPLETED;
    return undefined;
  }
  private async recordPlanState(
    manager: EntityManager,
    context: AuthorizationContext,
    plan: TreatmentPlan,
    before: TreatmentPlanStatus | undefined,
    reasonCode: string | undefined,
  ) {
    await this.record(
      manager,
      context,
      AuditAction.TREATMENT_PLAN_STATE_CHANGED,
      plan.id,
      {
        ...(before ? { before: { status: before } } : {}),
        after: { status: plan.status },
        ...(reasonCode ? { metadata: { reasonCode } } : {}),
      },
    );
  }
  private async recordItemState(
    manager: EntityManager,
    context: AuthorizationContext,
    item: TreatmentItem,
    before: TreatmentItemStatus,
    reasonCode: string | undefined,
  ) {
    await this.record(
      manager,
      context,
      AuditAction.TREATMENT_ITEM_STATE_CHANGED,
      item.id,
      {
        before: { status: before },
        after: { status: item.status },
        ...(reasonCode ? { metadata: { reasonCode } } : {}),
      },
    );
  }
  private record(
    manager: EntityManager,
    context: AuthorizationContext,
    action: AuditAction,
    resourceId: string,
    payload: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.audit.record(manager, {
      action,
      actor: {
        type: AuditActorType.USER,
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
      },
      tenantId: context.tenant!.id,
      branchId: context.branch!.id,
      resourceId,
      ...payload,
    });
  }
  private async toResponse(
    plan: TreatmentPlan,
    items: TreatmentItem[] | Promise<TreatmentItem[]>,
  ): Promise<TreatmentPlanResponse> {
    const resolved = await items;
    return {
      id: plan.id,
      originVisitId: plan.originVisitId,
      patientId: plan.patientId,
      status: plan.status,
      acceptedByUserId: plan.acceptedByUserId,
      acceptedAt: plan.acceptedAt,
      createdByUserId: plan.createdByUserId,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      items: resolved.map((i) => ({
        id: i.id,
        serviceId: i.serviceId,
        serviceCode: i.serviceCode,
        serviceName: i.serviceName,
        listUnitAmount: i.listUnitAmount,
        currency: i.currency,
        quantity: i.quantity,
        discountAmount: i.discountAmount,
        finalUnitAmount: i.finalUnitAmount,
        toothPosition: i.toothPosition,
        indication: i.indication,
        plannedDentistUserId: i.plannedDentistUserId,
        status: i.status,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
    };
  }
  private encodeCursor(createdAt: Date, id: string) {
    return Buffer.from(
      JSON.stringify({ createdAt: createdAt.toISOString(), id }),
    ).toString('base64url');
  }
  private decodeCursor(value: string) {
    try {
      const x = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as { createdAt?: string; id?: string };
      const createdAt = x.createdAt ? new Date(x.createdAt) : undefined;
      if (
        !createdAt ||
        Number.isNaN(createdAt.getTime()) ||
        !x.id ||
        !/^[0-9a-f-]{36}$/i.test(x.id)
      )
        throw new Error();
      return { createdAt, id: x.id };
    } catch {
      throw new BadRequestException('Invalid event cursor.');
    }
  }
}
