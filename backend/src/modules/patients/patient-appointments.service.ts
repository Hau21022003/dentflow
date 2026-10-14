import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  applyIlikeSearch,
  applyOffsetPagination,
  toPageMeta,
} from '../../common/database/query-builder-list.util';
import { SortOrder } from '../../common/dto/page-list-query.dto';
import { RequestFieldValidationException } from '../../common/exceptions/request-field-validation.exception';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  Appointment,
  type AppointmentSource,
  type AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import type { ListPatientAppointmentsQueryDto } from './dto/list-patient-appointments-query.dto';

export type PatientAppointmentListItem = {
  id: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  startAt: Date;
  endAt: Date;
  assignedDentist: { id: string; fullName: string } | null;
  operatory: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  } | null;
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
};

@Injectable()
export class PatientAppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
  ) {}

  async list(
    context: AuthorizationContext,
    patientId: string,
    query: ListPatientAppointmentsQueryDto,
  ): Promise<{
    items: PatientAppointmentListItem[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const range = this.parseOptionalRange(query.from, query.to);
    const sortOrder = query.sortOrder ?? SortOrder.DESC;

    if (query.sortBy && query.sortBy !== 'startAt') {
      throw new RequestFieldValidationException(
        'sortBy',
        'sortBy must be startAt.',
      );
    }

    const queryBuilder = this.appointments
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.assignedDentist', 'assignedDentist')
      .leftJoinAndSelect('appointment.operatory', 'operatory')
      .where('appointment.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('appointment.branchId = :branchId', {
        branchId: context.branch!.id,
      })
      .andWhere('appointment.patientId = :patientId', { patientId });

    if (range) {
      queryBuilder
        .andWhere('appointment.startAt < :to', { to: range.to })
        .andWhere('appointment.endAt > :from', { from: range.from });
    }
    if (query.status) {
      queryBuilder.andWhere('appointment.status = :status', {
        status: query.status,
      });
    }
    if (query.dentistUserId) {
      queryBuilder.andWhere(
        'appointment.assignedDentistUserId = :dentistUserId',
        { dentistUserId: query.dentistUserId },
      );
    }

    applyIlikeSearch(queryBuilder, query.search, [
      'appointment.serviceCode',
      'appointment.serviceName',
      'appointment.visitReason',
      'assignedDentist.fullName',
      'operatory.code',
      'operatory.name',
      'appointment.operationalNote',
    ]);
    queryBuilder
      .orderBy('appointment.start_at', sortOrder)
      .addOrderBy('appointment.id', sortOrder);
    applyOffsetPagination(queryBuilder, { page, limit });

    const [appointments, total] = await queryBuilder.getManyAndCount();
    return {
      items: appointments.map((appointment) => this.toResponse(appointment)),
      meta: toPageMeta({ page, limit }, total),
    };
  }

  private parseOptionalRange(
    fromInput: string | undefined,
    toInput: string | undefined,
  ): { from: Date; to: Date } | null {
    if (!fromInput && !toInput) return null;
    if (!fromInput) {
      throw new RequestFieldValidationException(
        'from',
        'from is required when to is provided.',
      );
    }
    if (!toInput) {
      throw new RequestFieldValidationException(
        'to',
        'to is required when from is provided.',
      );
    }

    const from = new Date(fromInput);
    const to = new Date(toInput);
    if (from.getTime() >= to.getTime()) {
      throw new RequestFieldValidationException(
        'to',
        'to must be later than from.',
      );
    }
    return { from, to };
  }

  private toResponse(appointment: Appointment): PatientAppointmentListItem {
    return {
      id: appointment.id,
      status: appointment.status,
      source: appointment.source,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      assignedDentist: appointment.assignedDentist
        ? {
            id: appointment.assignedDentist.id,
            fullName: appointment.assignedDentist.fullName,
          }
        : null,
      operatory: appointment.operatory
        ? {
            id: appointment.operatory.id,
            code: appointment.operatory.code,
            name: appointment.operatory.name,
            isActive: appointment.operatory.isActive,
          }
        : null,
      service:
        appointment.serviceId &&
        appointment.serviceCode &&
        appointment.serviceName &&
        appointment.serviceAmount !== null &&
        appointment.serviceCurrency &&
        appointment.serviceDurationMinutes !== null
          ? {
              id: appointment.serviceId,
              code: appointment.serviceCode,
              name: appointment.serviceName,
              amount: appointment.serviceAmount,
              currency: appointment.serviceCurrency,
              durationMinutes: appointment.serviceDurationMinutes,
            }
          : null,
      visitReason: appointment.visitReason,
      operationalNote: appointment.operationalNote,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    };
  }
}
