import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, In } from 'typeorm';
import { treatmentPlanCode } from '../../common/database/tenant-display-number';
import {
  applyOffsetPagination,
  toPageMeta,
} from '../../common/database/query-builder-list.util';
import { SortOrder } from '../../common/dto/page-list-query.dto';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import {
  TreatmentItem,
  TreatmentItemStatus,
} from '../treatment-plans/entities/treatment-item.entity';
import {
  TreatmentPlan,
  TreatmentPlanStatus,
} from '../treatment-plans/entities/treatment-plan.entity';
import { User } from '../users/entities/user.entity';
import { Visit } from '../visits/entities/visit.entity';
import type { ListPatientTreatmentPlansQueryDto } from './dto/list-patient-treatment-plans-query.dto';
import {
  PatientAlertsService,
  type PatientAlertResponse,
} from './patient-alerts.service';
import { PatientsService, type PatientResponse } from './patients.service';

const UPCOMING_APPOINTMENT_STATUSES = [
  AppointmentStatus.BOOKED,
  AppointmentStatus.CONFIRMED,
] as const;

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatus.BOOKED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

const ACTIVE_PLAN_STATUSES = [
  TreatmentPlanStatus.DRAFT,
  TreatmentPlanStatus.PROPOSED,
  TreatmentPlanStatus.ACCEPTED,
  TreatmentPlanStatus.PARTIALLY_COMPLETED,
];

export type PatientOverviewResponse = {
  patient: PatientResponse;
  activityStatus: 'ACTIVE' | 'INACTIVE';
  activeAlerts: PatientAlertResponse[];
  nextAppointment: {
    id: string;
    status: AppointmentStatus;
    startAt: Date;
    endAt: Date;
    serviceName: string | null;
    visitReason: string | null;
    assignedDentist: { id: string; fullName: string } | null;
    operatory: { id: string; code: string; name: string } | null;
  } | null;
  treatmentSummary: {
    activePlanCount: number;
    totalItems: number;
    completedItems: number;
    pendingItems: number;
    featuredPlan: {
      id: string;
      code: string;
      status: TreatmentPlanStatus;
      createdAt: Date;
      updatedAt: Date;
      serviceName: string | null;
      totalItems: number;
      completedItems: number;
      pendingItems: number;
    } | null;
  };
};

export type PatientTreatmentPlanListResponse = {
  items: Array<{
    id: string;
    code: string;
    status: TreatmentPlanStatus;
    createdAt: Date;
    updatedAt: Date;
    originVisit: { id: string; startedAt: Date };
    primaryItem: {
      serviceName: string;
      indication: string | null;
      toothPosition: string | null;
    } | null;
    plannedDentists: Array<{ id: string; fullName: string }>;
    progress: { completedItems: number; totalItems: number };
    totals: Array<{ currency: string; amount: number }>;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filterOptions: {
    dentists: Array<{ id: string; fullName: string }>;
  };
};

@Injectable()
export class PatientDetailsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly patientsService: PatientsService,
    private readonly patientAlertsService: PatientAlertsService,
  ) {}

  async getOverview(
    context: AuthorizationContext,
    patientId: string,
  ): Promise<PatientOverviewResponse> {
    const patient = await this.patientsService.get(context, patientId);

    const appointmentRepository = this.dataSource.getRepository(Appointment);
    const nextAppointment = await appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.assignedDentist', 'assignedDentist')
      .leftJoinAndSelect('appointment.operatory', 'operatory')
      .where('appointment.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('appointment.branchId = :branchId', {
        branchId: context.branch!.id,
      })
      .andWhere('appointment.patientId = :patientId', { patientId })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: UPCOMING_APPOINTMENT_STATUSES,
      })
      .andWhere('appointment.startAt > NOW()')
      .orderBy('appointment.startAt', 'ASC')
      .addOrderBy('appointment.id', 'ASC')
      .getOne();
    const activeAppointmentCount = await appointmentRepository.count({
      where: {
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
        patientId,
        status: In(ACTIVE_APPOINTMENT_STATUSES),
      },
    });
    const activePlans = await this.dataSource
      .getRepository(TreatmentPlan)
      .find({
        where: {
          tenantId: context.tenant!.id,
          branchId: context.branch!.id,
          patientId,
          status: In(ACTIVE_PLAN_STATUSES),
        },
        order: { updatedAt: 'DESC', id: 'DESC' },
      });
    const planIds = activePlans.map((plan) => plan.id);
    const items = planIds.length
      ? await this.dataSource.getRepository(TreatmentItem).find({
          where: { treatmentPlanId: In(planIds) },
          order: { createdAt: 'ASC', id: 'ASC' },
        })
      : [];
    const relevantItems = items.filter(
      (item) => item.status !== TreatmentItemStatus.CANCELLED,
    );
    const completedItems = relevantItems.filter(
      (item) => item.status === TreatmentItemStatus.COMPLETED,
    ).length;
    const pendingItems = relevantItems.filter(
      (item) =>
        item.status === TreatmentItemStatus.PENDING ||
        item.status === TreatmentItemStatus.IN_PROGRESS,
    ).length;
    const featuredPlan = activePlans[0] ?? null;
    const featuredItems = featuredPlan
      ? relevantItems.filter((item) => item.treatmentPlanId === featuredPlan.id)
      : [];
    const featuredCompleted = featuredItems.filter(
      (item) => item.status === TreatmentItemStatus.COMPLETED,
    ).length;
    const featuredPending = featuredItems.filter(
      (item) =>
        item.status === TreatmentItemStatus.PENDING ||
        item.status === TreatmentItemStatus.IN_PROGRESS,
    ).length;
    const activeAlerts = await this.patientAlertsService.listActive(
      context,
      patientId,
    );

    return {
      patient,
      activityStatus:
        activeAppointmentCount > 0 || activePlans.length > 0
          ? 'ACTIVE'
          : 'INACTIVE',
      activeAlerts,
      nextAppointment: nextAppointment
        ? {
            id: nextAppointment.id,
            status: nextAppointment.status,
            startAt: nextAppointment.startAt,
            endAt: nextAppointment.endAt,
            serviceName: nextAppointment.serviceName,
            visitReason: nextAppointment.visitReason,
            assignedDentist: nextAppointment.assignedDentist
              ? {
                  id: nextAppointment.assignedDentist.id,
                  fullName: nextAppointment.assignedDentist.fullName,
                }
              : null,
            operatory: nextAppointment.operatory
              ? {
                  id: nextAppointment.operatory.id,
                  code: nextAppointment.operatory.code,
                  name: nextAppointment.operatory.name,
                }
              : null,
          }
        : null,
      treatmentSummary: {
        activePlanCount: activePlans.length,
        totalItems: relevantItems.length,
        completedItems,
        pendingItems,
        featuredPlan: featuredPlan
          ? {
              id: featuredPlan.id,
              code: treatmentPlanCode(Number(featuredPlan.displayNumber)),
              status: featuredPlan.status,
              createdAt: featuredPlan.createdAt,
              updatedAt: featuredPlan.updatedAt,
              serviceName: featuredItems[0]?.serviceName ?? null,
              totalItems: featuredItems.length,
              completedItems: featuredCompleted,
              pendingItems: featuredPending,
            }
          : null,
      },
    };
  }

  async listTreatmentPlans(
    context: AuthorizationContext,
    patientId: string,
    query: ListPatientTreatmentPlansQueryDto,
  ): Promise<PatientTreatmentPlanListResponse> {
    await this.patientsService.get(context, patientId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortOrder = query.sortOrder ?? SortOrder.DESC;
    const tenantId = context.tenant!.id;
    const branchId = context.branch!.id;
    const plansRepository = this.dataSource.getRepository(TreatmentPlan);
    const itemsRepository = this.dataSource.getRepository(TreatmentItem);
    const usersRepository = this.dataSource.getRepository(User);
    const visitsRepository = this.dataSource.getRepository(Visit);
    const plansQuery = plansRepository
      .createQueryBuilder('plan')
      .where('plan.tenantId = :tenantId', { tenantId })
      .andWhere('plan.branchId = :branchId', { branchId })
      .andWhere('plan.patientId = :patientId', { patientId });

    const search = query.search?.trim();
    if (search) {
      plansQuery.andWhere(
        new Brackets((searchQuery) => {
          searchQuery
            .where(
              "('TP-' || LPAD(CAST(plan.displayNumber AS text), 4, '0')) ILIKE :planSearch",
              { planSearch: `%${search}%` },
            )
            .orWhere(
              `EXISTS (
                SELECT 1
                FROM treatment_items search_item
                WHERE search_item.treatment_plan_id = plan.id
                  AND (
                    search_item.service_code ILIKE :planSearch
                    OR search_item.service_name ILIKE :planSearch
                    OR search_item.indication ILIKE :planSearch
                    OR search_item.tooth_position ILIKE :planSearch
                  )
              )`,
            );
        }),
      );
    }
    if (query.status) {
      plansQuery.andWhere('plan.status = :planStatus', {
        planStatus: query.status,
      });
    }
    if (query.dentistUserId) {
      plansQuery.andWhere(
        `EXISTS (
          SELECT 1
          FROM treatment_items dentist_item
          WHERE dentist_item.treatment_plan_id = plan.id
            AND dentist_item.planned_dentist_user_id = :dentistUserId
        )`,
        { dentistUserId: query.dentistUserId },
      );
    }
    plansQuery
      .orderBy('plan.createdAt', sortOrder)
      .addOrderBy('plan.id', sortOrder);
    applyOffsetPagination(plansQuery, { page, limit });

    const dentistOptionsQuery = usersRepository
      .createQueryBuilder('dentist')
      .innerJoin(
        TreatmentItem,
        'filter_item',
        'filter_item.plannedDentistUserId = dentist.id',
      )
      .innerJoin(
        TreatmentPlan,
        'filter_plan',
        'filter_plan.id = filter_item.treatmentPlanId',
      )
      .where('filter_plan.tenantId = :tenantId', { tenantId })
      .andWhere('filter_plan.branchId = :branchId', { branchId })
      .andWhere('filter_plan.patientId = :patientId', { patientId })
      .select('dentist.id', 'id')
      .addSelect('dentist.fullName', 'fullName')
      .distinct(true)
      .orderBy('dentist.fullName', 'ASC')
      .addOrderBy('dentist.id', 'ASC');

    const [[plans, total], dentistRows] = await Promise.all([
      plansQuery.getManyAndCount(),
      dentistOptionsQuery.getRawMany<{ id: string; fullName: string }>(),
    ]);
    const planIds = plans.map((plan) => plan.id);
    const visitIds = plans.map((plan) => plan.originVisitId);
    const items = planIds.length
      ? await itemsRepository.find({
          where: { treatmentPlanId: In(planIds) },
          order: { createdAt: 'ASC', id: 'ASC' },
        })
      : [];
    const dentistIds = [
      ...new Set(items.map((item) => item.plannedDentistUserId)),
    ];
    const [dentists, visits] = await Promise.all([
      dentistIds.length
        ? usersRepository.find({ where: { id: In(dentistIds) } })
        : Promise.resolve([]),
      visitIds.length
        ? visitsRepository.find({ where: { id: In(visitIds) } })
        : Promise.resolve([]),
    ]);
    const itemsByPlan = new Map<string, TreatmentItem[]>();
    for (const item of items) {
      const planItems = itemsByPlan.get(item.treatmentPlanId) ?? [];
      planItems.push(item);
      itemsByPlan.set(item.treatmentPlanId, planItems);
    }
    const dentistById = new Map(
      dentists.map((dentist) => [dentist.id, dentist]),
    );
    const visitById = new Map(visits.map((visit) => [visit.id, visit]));

    return {
      items: plans.map((plan) => {
        const planItems = itemsByPlan.get(plan.id) ?? [];
        const primaryItem = planItems[0] ?? null;
        const plannedDentists: Array<{ id: string; fullName: string }> = [];
        const seenDentists = new Set<string>();
        const totalsByCurrency = new Map<string, number>();
        for (const item of planItems) {
          const dentist = dentistById.get(item.plannedDentistUserId);
          if (dentist && !seenDentists.has(dentist.id)) {
            seenDentists.add(dentist.id);
            plannedDentists.push({
              id: dentist.id,
              fullName: dentist.fullName,
            });
          }
          totalsByCurrency.set(
            item.currency,
            (totalsByCurrency.get(item.currency) ?? 0) +
              item.finalUnitAmount * item.quantity,
          );
        }
        const originVisit = visitById.get(plan.originVisitId)!;
        return {
          id: plan.id,
          code: treatmentPlanCode(Number(plan.displayNumber)),
          status: plan.status,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          originVisit: {
            id: plan.originVisitId,
            startedAt: originVisit.createdAt,
          },
          primaryItem: primaryItem
            ? {
                serviceName: primaryItem.serviceName,
                indication: primaryItem.indication,
                toothPosition: primaryItem.toothPosition,
              }
            : null,
          plannedDentists,
          progress: {
            completedItems: planItems.filter(
              (item) => item.status === TreatmentItemStatus.COMPLETED,
            ).length,
            totalItems: planItems.length,
          },
          totals: [...totalsByCurrency.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([currency, amount]) => ({ currency, amount })),
        };
      }),
      meta: toPageMeta({ page, limit }, total),
      filterOptions: {
        dentists: dentistRows,
      },
    };
  }

  async getTreatmentPlan(
    context: AuthorizationContext,
    patientId: string,
    planId: string,
  ) {
    await this.patientsService.get(context, patientId);
    const plan = await this.dataSource.getRepository(TreatmentPlan).findOne({
      where: {
        id: planId,
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
        patientId,
      },
    });
    if (!plan) throw new NotFoundException('Treatment Plan was not found.');
    const items = await this.dataSource.getRepository(TreatmentItem).find({
      where: { treatmentPlanId: plan.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const dentistIds = [
      ...new Set(items.map((item) => item.plannedDentistUserId)),
    ];
    const dentists = dentistIds.length
      ? await this.dataSource.getRepository(User).find({
          where: { id: In(dentistIds) },
        })
      : [];
    const dentistById = new Map(
      dentists.map((dentist) => [dentist.id, dentist]),
    );
    return {
      id: plan.id,
      code: treatmentPlanCode(Number(plan.displayNumber)),
      patientId: plan.patientId,
      originVisitId: plan.originVisitId,
      status: plan.status,
      acceptedAt: plan.acceptedAt,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      items: items.map((item) => ({
        id: item.id,
        service: {
          id: item.serviceId,
          code: item.serviceCode,
          name: item.serviceName,
        },
        listUnitAmount: item.listUnitAmount,
        finalUnitAmount: item.finalUnitAmount,
        discountAmount: item.discountAmount,
        currency: item.currency,
        quantity: item.quantity,
        toothPosition: item.toothPosition,
        indication: item.indication,
        status: item.status,
        plannedDentist: dentistById.get(item.plannedDentistUserId)
          ? {
              id: item.plannedDentistUserId,
              fullName: dentistById.get(item.plannedDentistUserId)!.fullName,
            }
          : null,
      })),
    };
  }
}
