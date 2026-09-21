import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import {
  applyIlikeSearch,
  applyOffsetPagination,
  toPageMeta,
} from '../../common/database/query-builder-list.util';
import { RequestFieldValidationException } from '../../common/exceptions/request-field-validation.exception';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { TenantRoleCode } from '../authorization/entities/role-assignment.entity';
import { RoleAssignment } from '../authorization/entities/role-assignment.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Service } from '../services/entities/service.entity';
import {
  TenantUserMembership,
  TenantUserMembershipStatus,
} from '../staff/entities/tenant-user-membership.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AssignAppointmentDto } from './dto/assign-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { ListAppointmentBookingOptionsQueryDto } from './dto/list-appointment-booking-options-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { AppointmentStatusTransition } from './entities/appointment-status-transition.entity';
import { AppointmentsRepository } from './appointments.repository';

const MAX_LIST_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
const SCHEDULING_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.BOOKED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
]);
const TERMINAL_REASON_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.BOOKED,
  AppointmentStatus.CONFIRMED,
]);

type AppointmentDetails = Appointment & {
  patient: Patient;
  assignedDentist: User | null;
};

type AppointmentSnapshot = {
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  assignedDentistUserId: string | null;
};

export interface AppointmentResponse {
  id: string;
  status: AppointmentStatus;
  source: Appointment['source'];
  startAt: Date;
  endAt: Date;
  patient: { id: string; fullName: string; phone: string };
  assignedDentist: { id: string; fullName: string } | null;
  service: {
    id: string;
    code: string;
    name: string;
    amount: number;
    currency: string;
    durationMinutes: number;
  } | null;
  visitReason: string | null;
  operationalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentDetailResponse extends Omit<
  AppointmentResponse,
  'patient'
> {
  patient: {
    id: string;
    fullName: string;
    phone: string;
    gender: Patient['gender'];
    dateOfBirth: string | null;
  };
}

export interface AssignedAppointmentResponse {
  id: string;
  status: AppointmentStatus;
  startAt: Date;
  endAt: Date;
  patient: { id: string; fullName: string };
  service: { id: string; code: string; name: string } | null;
}

export interface AppointmentDentistOptionResponse {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface AppointmentCalendarSummaryResponse {
  month: string;
  timeZone: string;
  days: Array<{
    date: string;
    total: number;
    statuses: Record<AppointmentStatus, number>;
  }>;
}

type AppointmentCalendarSummaryRow = {
  date: string;
  status: AppointmentStatus;
  total: string;
};

export interface AppointmentServiceOptionResponse {
  id: string;
  code: string;
  name: string;
  amount: number;
  currency: string;
  durationMinutes: number;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly usersService: UsersService,
  ) {}

  async list(
    context: AuthorizationContext,
    query: ListAppointmentsQueryDto,
  ): Promise<{
    items: AppointmentResponse[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { from, to } = this.parseListWindow(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const queryBuilder = this.appointmentsRepository
      .detailsQuery()
      .where('appointment.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('appointment.branchId = :branchId', {
        branchId: context.branch!.id,
      })
      .andWhere('appointment.startAt < :to', { to })
      .andWhere('appointment.endAt > :from', { from });

    if (query.status) {
      queryBuilder.andWhere('appointment.status = :status', {
        status: query.status,
      });
    }
    if (query.patientId) {
      queryBuilder.andWhere('appointment.patientId = :patientId', {
        patientId: query.patientId,
      });
    }
    if (query.dentistUserId) {
      queryBuilder.andWhere(
        'appointment.assignedDentistUserId = :dentistUserId',
        { dentistUserId: query.dentistUserId },
      );
    }
    applyIlikeSearch(queryBuilder, query.search, [
      'patient.fullName',
      'patient.phone',
    ]);

    queryBuilder
      .orderBy('appointment.start_at', 'ASC')
      .addOrderBy('appointment.id', 'ASC');
    applyOffsetPagination(queryBuilder, { page, limit });

    const [appointments, total] = await queryBuilder.getManyAndCount();
    return {
      items: appointments.map((appointment) =>
        this.toManagementResponse(appointment as AppointmentDetails),
      ),
      meta: toPageMeta({ page, limit }, total),
    };
  }

  async listAssigned(
    context: AuthorizationContext,
    query: ListAppointmentsQueryDto,
  ): Promise<{
    items: AssignedAppointmentResponse[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { from, to } = this.parseListWindow(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const queryBuilder = this.appointmentsRepository
      .detailsQuery()
      .where('appointment.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('appointment.branchId = :branchId', {
        branchId: context.branch!.id,
      })
      .andWhere('appointment.assignedDentistUserId = :dentistUserId', {
        dentistUserId: context.actor.userId,
      })
      .andWhere('appointment.startAt < :to', { to })
      .andWhere('appointment.endAt > :from', { from });

    if (query.status) {
      queryBuilder.andWhere('appointment.status = :status', {
        status: query.status,
      });
    }
    if (query.patientId) {
      queryBuilder.andWhere('appointment.patientId = :patientId', {
        patientId: query.patientId,
      });
    }

    queryBuilder
      .orderBy('appointment.start_at', 'ASC')
      .addOrderBy('appointment.id', 'ASC');
    applyOffsetPagination(queryBuilder, { page, limit });

    const [appointments, total] = await queryBuilder.getManyAndCount();
    return {
      items: appointments.map((appointment) =>
        this.toAssignedResponse(appointment as AppointmentDetails),
      ),
      meta: toPageMeta({ page, limit }, total),
    };
  }

  async calendarSummary(
    context: AuthorizationContext,
    month: string,
  ): Promise<AppointmentCalendarSummaryResponse> {
    const timeZone = context.branch!.timezone;
    const { monthStart, nextMonthStart } = this.parseCalendarMonth(month);
    const rows = await this.appointmentsRepository.ormRepository
      .createQueryBuilder('appointment')
      .select(
        `TO_CHAR(appointment.start_at AT TIME ZONE :timeZone, 'YYYY-MM-DD')`,
        'date',
      )
      .addSelect('appointment.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('appointment.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('appointment.branchId = :branchId', {
        branchId: context.branch!.id,
      })
      .andWhere(
        `appointment.start_at >= (CAST(:monthStart AS date)::timestamp AT TIME ZONE :timeZone)`,
      )
      .andWhere(
        `appointment.start_at < (CAST(:nextMonthStart AS date)::timestamp AT TIME ZONE :timeZone)`,
      )
      .setParameters({ monthStart, nextMonthStart, timeZone })
      .groupBy(
        `TO_CHAR(appointment.start_at AT TIME ZONE :timeZone, 'YYYY-MM-DD')`,
      )
      .addGroupBy('appointment.status')
      .orderBy(
        `TO_CHAR(appointment.start_at AT TIME ZONE :timeZone, 'YYYY-MM-DD')`,
        'ASC',
      )
      .addOrderBy('appointment.status', 'ASC')
      .getRawMany<AppointmentCalendarSummaryRow>();

    const days = new Map<
      string,
      {
        date: string;
        total: number;
        statuses: Record<AppointmentStatus, number>;
      }
    >();
    for (const row of rows) {
      const day = days.get(row.date) ?? {
        date: row.date,
        total: 0,
        statuses: this.emptyStatusCounts(),
      };
      const count = Number(row.total);
      day.total += count;
      day.statuses[row.status] = count;
      days.set(row.date, day);
    }

    return { month, timeZone, days: [...days.values()] };
  }

  async get(
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<AppointmentDetailResponse> {
    const appointment =
      await this.appointmentsRepository.findByTenantBranchAndId(
        context.tenant!.id,
        context.branch!.id,
        appointmentId,
      );
    if (!appointment) {
      throw new NotFoundException('Appointment was not found.');
    }
    return this.toDetailResponse(appointment);
  }

  async listBookingDentists(
    context: AuthorizationContext,
    query: ListAppointmentBookingOptionsQueryDto,
  ): Promise<{
    items: AppointmentDentistOptionResponse[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.dataSource
      .getRepository(RoleAssignment)
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.user', 'user')
      .innerJoin(
        TenantUserMembership,
        'membership',
        'membership.user_id = assignment.user_id AND membership.tenant_id = assignment.tenant_id AND membership.status = :membershipStatus',
        { membershipStatus: TenantUserMembershipStatus.ACTIVE },
      )
      .where('assignment.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('assignment.branchId = :branchId', {
        branchId: context.branch!.id,
      })
      .andWhere('assignment.roleCode = :roleCode', {
        roleCode: TenantRoleCode.DENTIST,
      })
      .andWhere('assignment.revokedAt IS NULL');

    applyIlikeSearch(queryBuilder, query.search, ['user.fullName']);
    queryBuilder
      .orderBy('user.fullName', 'ASC')
      .addOrderBy('assignment.userId', 'ASC');
    applyOffsetPagination(queryBuilder, { page, limit });

    const [assignments, total] = await queryBuilder.getManyAndCount();
    const dentistsById = new Map<
      string,
      Pick<User, 'id' | 'avatarObjectKey'>
    >();
    for (const assignment of assignments) {
      dentistsById.set(assignment.userId, assignment.user);
    }
    const avatarUrls = await this.usersService.avatarUrlsFor(
      dentistsById.values(),
    );

    return {
      items: assignments.map((assignment) => ({
        id: assignment.userId,
        fullName: assignment.user.fullName,
        avatarUrl: avatarUrls.get(assignment.userId) ?? null,
      })),
      meta: toPageMeta({ page, limit }, total),
    };
  }

  async listBookingServices(
    context: AuthorizationContext,
    query: ListAppointmentBookingOptionsQueryDto,
  ): Promise<{
    items: AppointmentServiceOptionResponse[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.dataSource
      .getRepository(Service)
      .createQueryBuilder('service')
      .where('service.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('service.isActive = true');

    applyIlikeSearch(queryBuilder, query.search, [
      'service.code',
      'service.name',
    ]);
    queryBuilder.orderBy('service.name', 'ASC').addOrderBy('service.id', 'ASC');
    applyOffsetPagination(queryBuilder, { page, limit });

    const [services, total] = await queryBuilder.getManyAndCount();
    return {
      items: services.map((service) => ({
        id: service.id,
        code: service.code,
        name: service.name,
        amount: service.amount,
        currency: service.currency,
        durationMinutes: service.durationMinutes,
      })),
      meta: toPageMeta({ page, limit }, total),
    };
  }

  async create(
    context: AuthorizationContext,
    input: CreateAppointmentDto,
  ): Promise<AppointmentResponse> {
    const { startAt, endAt } = this.parseAppointmentRange(
      input.startAt,
      input.endAt,
    );
    this.requireReasonWithoutService(
      input.serviceId ?? null,
      input.visitReason,
    );

    try {
      return await this.dataSource.transaction(async (manager) => {
        const patient = await this.findPatientOrFail(
          manager,
          context.tenant!.id,
          input.patientId,
        );
        const service = await this.resolveServiceOrFail(
          manager,
          context.tenant!.id,
          input.serviceId ?? null,
        );
        const dentist = await this.resolveDentistOrFail(
          manager,
          context,
          input.assignedDentistUserId ?? null,
        );
        const appointment = manager.create(Appointment, {
          tenantId: context.tenant!.id,
          branchId: context.branch!.id,
          patientId: patient.id,
          status: AppointmentStatus.BOOKED,
          source: input.source,
          startAt,
          endAt,
          assignedDentistUserId: dentist?.id ?? null,
          serviceId: service?.id ?? null,
          serviceCode: service?.code ?? null,
          serviceName: service?.name ?? null,
          serviceAmount: service?.amount ?? null,
          serviceCurrency: service?.currency ?? null,
          serviceDurationMinutes: service?.durationMinutes ?? null,
          visitReason: input.visitReason ?? null,
          operationalNote: input.operationalNote ?? null,
        });
        const saved = await manager.save(appointment);
        await this.recordTransition(
          manager,
          context,
          saved,
          null,
          saved.status,
        );
        await this.recordAudit(
          manager,
          context,
          AuditAction.APPOINTMENT_CREATED,
          {
            appointment: saved,
            after: this.snapshot(saved),
          },
        );
        return this.toManagementResponse({
          ...saved,
          patient,
          assignedDentist: dentist,
        });
      });
    } catch (error) {
      this.throwIfDentistScheduleOverlaps(error);
      throw error;
    }
  }

  async update(
    context: AuthorizationContext,
    appointmentId: string,
    input: UpdateAppointmentDto,
  ): Promise<AppointmentResponse> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const appointment = await this.findForUpdateOrFail(
          manager,
          context,
          appointmentId,
        );
        this.assertSchedulingStatus(appointment);

        const nextStartAt =
          input.startAt === undefined
            ? appointment.startAt
            : this.parseTimestamp(input.startAt, 'startAt');
        const nextEndAt =
          input.endAt === undefined
            ? appointment.endAt
            : this.parseTimestamp(input.endAt, 'endAt');
        this.assertValidRange(nextStartAt, nextEndAt);

        const timeChanged =
          nextStartAt.getTime() !== appointment.startAt.getTime() ||
          nextEndAt.getTime() !== appointment.endAt.getTime();
        if (appointment.status === AppointmentStatus.CONFIRMED && timeChanged) {
          if (!input.reasonCode) {
            throw new RequestFieldValidationException(
              'reasonCode',
              'reasonCode is required when rescheduling a confirmed appointment.',
            );
          }
        } else if (input.reasonCode) {
          throw new RequestFieldValidationException(
            'reasonCode',
            'reasonCode is only allowed when rescheduling a confirmed appointment.',
          );
        }

        const service =
          input.serviceId === undefined
            ? undefined
            : await this.resolveServiceOrFail(
                manager,
                context.tenant!.id,
                input.serviceId,
              );
        const nextServiceId =
          service === undefined ? appointment.serviceId : (service?.id ?? null);
        const nextVisitReason =
          input.visitReason === undefined
            ? appointment.visitReason
            : input.visitReason;
        this.requireReasonWithoutService(nextServiceId, nextVisitReason);

        const changedFields = this.getChangedFields(appointment, input, {
          startAt: nextStartAt,
          endAt: nextEndAt,
          service,
        });
        if (changedFields.length === 0) {
          const details = await this.loadDetailsOrFail(
            manager,
            context,
            appointment.id,
          );
          return this.toManagementResponse(details);
        }

        const before = this.snapshot(appointment);
        appointment.source = input.source ?? appointment.source;
        appointment.startAt = nextStartAt;
        appointment.endAt = nextEndAt;
        if (service !== undefined) {
          appointment.serviceId = service?.id ?? null;
          appointment.serviceCode = service?.code ?? null;
          appointment.serviceName = service?.name ?? null;
          appointment.serviceAmount = service?.amount ?? null;
          appointment.serviceCurrency = service?.currency ?? null;
          appointment.serviceDurationMinutes = service?.durationMinutes ?? null;
        }
        if (input.visitReason !== undefined) {
          appointment.visitReason = input.visitReason;
        }
        if (input.operationalNote !== undefined) {
          appointment.operationalNote = input.operationalNote;
        }

        if (appointment.status === AppointmentStatus.CONFIRMED && timeChanged) {
          appointment.status = AppointmentStatus.BOOKED;
        }
        const saved = await manager.save(appointment);
        if (saved.status !== before.status) {
          await this.recordTransition(
            manager,
            context,
            saved,
            before.status,
            saved.status,
            input.reasonCode,
          );
          await this.recordAudit(
            manager,
            context,
            AuditAction.APPOINTMENT_STATE_CHANGED,
            {
              appointment: saved,
              before,
              after: this.snapshot(saved),
              reasonCode: input.reasonCode,
            },
          );
        } else {
          await this.recordAudit(
            manager,
            context,
            AuditAction.APPOINTMENT_UPDATED,
            {
              appointment: saved,
              before: { ...before, changedFields },
              after: { ...this.snapshot(saved), changedFields },
            },
          );
        }

        return this.toManagementResponse(
          await this.loadDetailsOrFail(manager, context, saved.id),
        );
      });
    } catch (error) {
      this.throwIfDentistScheduleOverlaps(error);
      throw error;
    }
  }

  async confirm(
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<AppointmentResponse> {
    return this.changeStatus(
      context,
      appointmentId,
      AppointmentStatus.BOOKED,
      AppointmentStatus.CONFIRMED,
    );
  }

  async checkIn(
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<AppointmentResponse> {
    return this.changeStatus(
      context,
      appointmentId,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CHECKED_IN,
    );
  }

  async assign(
    context: AuthorizationContext,
    appointmentId: string,
    input: AssignAppointmentDto,
  ): Promise<AppointmentResponse> {
    this.assertBranchAdmin(context);
    if (input.assignedDentistUserId === undefined) {
      throw new RequestFieldValidationException(
        'assignedDentistUserId',
        'assignedDentistUserId is required and may be null to unassign.',
      );
    }
    try {
      return await this.dataSource.transaction(async (manager) => {
        const appointment = await this.findForUpdateOrFail(
          manager,
          context,
          appointmentId,
        );
        this.assertSchedulingStatus(appointment);
        if (appointment.assignedDentistUserId === input.assignedDentistUserId) {
          return this.toManagementResponse(
            await this.loadDetailsOrFail(manager, context, appointment.id),
          );
        }

        const dentist = await this.resolveDentistOrFail(
          manager,
          context,
          input.assignedDentistUserId,
        );
        const before = this.snapshot(appointment);
        appointment.assignedDentistUserId = dentist?.id ?? null;
        const saved = await manager.save(appointment);
        await this.recordAudit(
          manager,
          context,
          AuditAction.APPOINTMENT_ASSIGNMENT_CHANGED,
          {
            appointment: saved,
            before,
            after: this.snapshot(saved),
          },
        );
        return this.toManagementResponse(
          await this.loadDetailsOrFail(manager, context, saved.id),
        );
      });
    } catch (error) {
      this.throwIfDentistScheduleOverlaps(error);
      throw error;
    }
  }

  async cancel(
    context: AuthorizationContext,
    appointmentId: string,
    reasonCode: string,
  ): Promise<AppointmentResponse> {
    return this.changeTerminalStatus(
      context,
      appointmentId,
      AppointmentStatus.CANCELLED,
      reasonCode,
    );
  }

  async noShow(
    context: AuthorizationContext,
    appointmentId: string,
    reasonCode: string,
  ): Promise<AppointmentResponse> {
    return this.changeTerminalStatus(
      context,
      appointmentId,
      AppointmentStatus.NO_SHOW,
      reasonCode,
    );
  }

  private async changeTerminalStatus(
    context: AuthorizationContext,
    appointmentId: string,
    targetStatus: AppointmentStatus.CANCELLED | AppointmentStatus.NO_SHOW,
    reasonCode: string,
  ): Promise<AppointmentResponse> {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.findForUpdateOrFail(
        manager,
        context,
        appointmentId,
      );
      if (!TERMINAL_REASON_STATUSES.has(appointment.status)) {
        throw new ConflictException(
          'Appointment cannot be cancelled or marked as no-show in its current status.',
        );
      }
      return this.persistStatusChange(
        manager,
        context,
        appointment,
        targetStatus,
        reasonCode,
      );
    });
  }

  private async changeStatus(
    context: AuthorizationContext,
    appointmentId: string,
    expectedStatus: AppointmentStatus,
    targetStatus: AppointmentStatus,
  ): Promise<AppointmentResponse> {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.findForUpdateOrFail(
        manager,
        context,
        appointmentId,
      );
      if (appointment.status !== expectedStatus) {
        throw new ConflictException('Appointment transition is not allowed.');
      }
      return this.persistStatusChange(
        manager,
        context,
        appointment,
        targetStatus,
      );
    });
  }

  private async persistStatusChange(
    manager: EntityManager,
    context: AuthorizationContext,
    appointment: Appointment,
    targetStatus: AppointmentStatus,
    reasonCode?: string,
  ): Promise<AppointmentResponse> {
    const before = this.snapshot(appointment);
    const fromStatus = appointment.status;
    appointment.status = targetStatus;
    const saved = await manager.save(appointment);
    await this.recordTransition(
      manager,
      context,
      saved,
      fromStatus,
      targetStatus,
      reasonCode,
    );
    await this.recordAudit(
      manager,
      context,
      AuditAction.APPOINTMENT_STATE_CHANGED,
      {
        appointment: saved,
        before,
        after: this.snapshot(saved),
        reasonCode,
      },
    );
    return this.toManagementResponse(
      await this.loadDetailsOrFail(manager, context, saved.id),
    );
  }

  private async findForUpdateOrFail(
    manager: EntityManager,
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<Appointment> {
    const appointment =
      await this.appointmentsRepository.findByTenantBranchAndIdForUpdate(
        manager,
        context.tenant!.id,
        context.branch!.id,
        appointmentId,
      );
    if (!appointment) {
      throw new NotFoundException('Appointment was not found.');
    }
    return appointment;
  }

  private async loadDetailsOrFail(
    manager: EntityManager,
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<AppointmentDetails> {
    const appointment =
      await this.appointmentsRepository.findDetailsByTenantBranchAndId(
        manager,
        context.tenant!.id,
        context.branch!.id,
        appointmentId,
      );
    if (!appointment) {
      throw new NotFoundException('Appointment was not found.');
    }
    return appointment;
  }

  private async findPatientOrFail(
    manager: EntityManager,
    tenantId: string,
    patientId: string,
  ): Promise<Patient> {
    const patient = await manager.getRepository(Patient).findOne({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Patient was not found.');
    }
    return patient;
  }

  private async resolveServiceOrFail(
    manager: EntityManager,
    tenantId: string,
    serviceId: string | null | undefined,
  ): Promise<Service | null> {
    if (!serviceId) {
      return null;
    }
    const service = await manager.getRepository(Service).findOne({
      where: { id: serviceId, tenantId, isActive: true },
    });
    if (!service) {
      throw new RequestFieldValidationException(
        'serviceId',
        'serviceId must reference an active service in the tenant.',
      );
    }
    return service;
  }

  private async resolveDentistOrFail(
    manager: EntityManager,
    context: AuthorizationContext,
    dentistUserId: string | null,
  ): Promise<User | null> {
    if (!dentistUserId) {
      return null;
    }
    const assignment = await manager
      .getRepository(RoleAssignment)
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.user', 'user')
      .innerJoin(
        TenantUserMembership,
        'membership',
        'membership.user_id = assignment.user_id AND membership.tenant_id = assignment.tenant_id AND membership.status = :membershipStatus',
        { membershipStatus: TenantUserMembershipStatus.ACTIVE },
      )
      .where('assignment.userId = :dentistUserId', { dentistUserId })
      .andWhere('assignment.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('assignment.branchId = :branchId', {
        branchId: context.branch!.id,
      })
      .andWhere('assignment.roleCode = :roleCode', {
        roleCode: TenantRoleCode.DENTIST,
      })
      .andWhere('assignment.revokedAt IS NULL')
      .getOne();
    if (!assignment) {
      throw new RequestFieldValidationException(
        'assignedDentistUserId',
        'assignedDentistUserId must reference an active Dentist in this branch.',
      );
    }
    return assignment.user;
  }

  private getChangedFields(
    appointment: Appointment,
    input: UpdateAppointmentDto,
    values: { startAt: Date; endAt: Date; service: Service | null | undefined },
  ): string[] {
    const fields: string[] = [];
    if (input.source !== undefined && input.source !== appointment.source) {
      fields.push('source');
    }
    if (values.startAt.getTime() !== appointment.startAt.getTime()) {
      fields.push('startAt');
    }
    if (values.endAt.getTime() !== appointment.endAt.getTime()) {
      fields.push('endAt');
    }
    if (
      values.service !== undefined &&
      (values.service?.id ?? null) !== appointment.serviceId
    ) {
      fields.push('service');
    }
    if (
      input.visitReason !== undefined &&
      input.visitReason !== appointment.visitReason
    ) {
      fields.push('visitReason');
    }
    if (
      input.operationalNote !== undefined &&
      input.operationalNote !== appointment.operationalNote
    ) {
      fields.push('operationalNote');
    }
    return fields;
  }

  private requireReasonWithoutService(
    serviceId: string | null,
    visitReason: string | null | undefined,
  ): void {
    if (!serviceId && !visitReason?.trim()) {
      throw new RequestFieldValidationException(
        'visitReason',
        'visitReason is required when serviceId is not provided.',
      );
    }
  }

  private parseListWindow(
    fromInput: string,
    toInput: string,
  ): {
    from: Date;
    to: Date;
  } {
    const from = this.parseTimestamp(fromInput, 'from');
    const to = this.parseTimestamp(toInput, 'to');
    this.assertValidRange(from, to);
    if (to.getTime() - from.getTime() > MAX_LIST_WINDOW_MS) {
      throw new RequestFieldValidationException(
        'to',
        'The appointment list window must not exceed 31 days.',
      );
    }
    return { from, to };
  }

  private parseCalendarMonth(month: string): {
    monthStart: string;
    nextMonthStart: string;
  } {
    const [yearInput, monthInput] = month.split('-');
    const year = Number(yearInput);
    const monthNumber = Number(monthInput);
    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
    return {
      monthStart: `${yearInput}-${monthInput}-01`,
      nextMonthStart: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
    };
  }

  private emptyStatusCounts(): Record<AppointmentStatus, number> {
    return Object.values(AppointmentStatus).reduce(
      (counts, status) => {
        counts[status] = 0;
        return counts;
      },
      {} as Record<AppointmentStatus, number>,
    );
  }

  private parseAppointmentRange(
    startInput: string,
    endInput: string,
  ): {
    startAt: Date;
    endAt: Date;
  } {
    const startAt = this.parseTimestamp(startInput, 'startAt');
    const endAt = this.parseTimestamp(endInput, 'endAt');
    this.assertValidRange(startAt, endAt);
    return { startAt, endAt };
  }

  private parseTimestamp(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new RequestFieldValidationException(
        field,
        `${field} must be a valid ISO 8601 timestamp.`,
      );
    }
    return parsed;
  }

  private assertValidRange(startAt: Date, endAt: Date): void {
    if (startAt.getTime() >= endAt.getTime()) {
      throw new RequestFieldValidationException(
        'endAt',
        'endAt must be later than startAt.',
      );
    }
  }

  private assertSchedulingStatus(appointment: Appointment): void {
    if (!SCHEDULING_STATUSES.has(appointment.status)) {
      throw new ConflictException(
        'Appointment can no longer be changed in its current status.',
      );
    }
  }

  private assertBranchAdmin(context: AuthorizationContext): void {
    if (!context.access?.tenantRoles.includes(TenantRoleCode.BRANCH_ADMIN)) {
      throw new ForbiddenException(
        'Only a Branch Admin can assign or change an appointment Dentist.',
      );
    }
  }

  private async recordTransition(
    manager: EntityManager,
    context: AuthorizationContext,
    appointment: Appointment,
    fromStatus: AppointmentStatus | null,
    toStatus: AppointmentStatus,
    reasonCode?: string,
  ): Promise<void> {
    await manager.save(
      manager.create(AppointmentStatusTransition, {
        appointmentId: appointment.id,
        tenantId: appointment.tenantId,
        branchId: appointment.branchId,
        fromStatus,
        toStatus,
        reasonCode: reasonCode ?? null,
        changedByUserId: context.actor.userId,
      }),
    );
  }

  private async recordAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    action: AuditAction,
    input: {
      appointment: Appointment;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      reasonCode?: string;
    },
  ): Promise<void> {
    await this.auditLogService.record(manager, {
      action,
      actor: {
        type: AuditActorType.USER,
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
      },
      tenantId: input.appointment.tenantId,
      branchId: input.appointment.branchId,
      resourceId: input.appointment.id,
      ...(input.before ? { before: input.before } : {}),
      ...(input.after ? { after: input.after } : {}),
      ...(input.reasonCode
        ? { metadata: { reasonCode: input.reasonCode } }
        : {}),
    });
  }

  private snapshot(appointment: Appointment): AppointmentSnapshot {
    return {
      status: appointment.status,
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      assignedDentistUserId: appointment.assignedDentistUserId,
    };
  }

  private toManagementResponse(
    appointment: AppointmentDetails,
  ): AppointmentResponse {
    return {
      id: appointment.id,
      status: appointment.status,
      source: appointment.source,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      patient: {
        id: appointment.patient.id,
        fullName: appointment.patient.fullName,
        phone: appointment.patient.phone,
      },
      assignedDentist: appointment.assignedDentist
        ? {
            id: appointment.assignedDentist.id,
            fullName: appointment.assignedDentist.fullName,
          }
        : null,
      service: appointment.serviceId
        ? {
            id: appointment.serviceId,
            code: appointment.serviceCode!,
            name: appointment.serviceName!,
            amount: appointment.serviceAmount!,
            currency: appointment.serviceCurrency!,
            durationMinutes: appointment.serviceDurationMinutes!,
          }
        : null,
      visitReason: appointment.visitReason,
      operationalNote: appointment.operationalNote,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    };
  }

  private toDetailResponse(
    appointment: AppointmentDetails,
  ): AppointmentDetailResponse {
    const response = this.toManagementResponse(appointment);
    return {
      ...response,
      patient: {
        ...response.patient,
        gender: appointment.patient.gender,
        dateOfBirth: appointment.patient.dateOfBirth,
      },
    };
  }

  private toAssignedResponse(
    appointment: AppointmentDetails,
  ): AssignedAppointmentResponse {
    return {
      id: appointment.id,
      status: appointment.status,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      patient: {
        id: appointment.patient.id,
        fullName: appointment.patient.fullName,
      },
      service: appointment.serviceId
        ? {
            id: appointment.serviceId,
            code: appointment.serviceCode!,
            name: appointment.serviceName!,
          }
        : null,
    };
  }

  private throwIfDentistScheduleOverlaps(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { constraint?: string } | undefined)?.constraint ===
        'ex_appointments_assigned_dentist_time_overlap'
    ) {
      throw new ConflictException(
        'The assigned Dentist already has an overlapping appointment.',
      );
    }
  }
}
