import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  toPageMeta,
  type PageMeta,
} from '../../common/database/query-builder-list.util';
import { SortOrder } from '../../common/dto/page-list-query.dto';
import { RequestFieldValidationException } from '../../common/exceptions/request-field-validation.exception';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { AppointmentStatus } from '../appointments/entities/appointment.entity';
import { Visit, VisitStatus } from '../visits/entities/visit.entity';
import type { ListPatientVisitsQueryDto } from './dto/list-patient-visits-query.dto';
import { PatientsService } from './patients.service';

type PatientVisitListItem = {
  id: string;
  appointmentId: string;
  status: VisitStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMinutes: number | null;
  dentist: { id: string; fullName: string };
  operatory: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  } | null;
  diagnosisSummary: string | null;
};

type PatientVisitListResponse = {
  items: PatientVisitListItem[];
  meta: PageMeta;
  summary: { total: number; completed: number; inProgress: number };
  filterOptions: {
    dentists: Array<{ id: string; fullName: string }>;
  };
};

type RawPatientVisit = {
  visit_id: string;
  appointment_id: string;
  visit_status: VisitStatus;
  diagnosis_summary: string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  dentist_id: string;
  dentist_full_name: string;
  operatory_id: string | null;
  operatory_code: string | null;
  operatory_name: string | null;
  operatory_is_active: boolean | null;
};

type RawVisitSummary = {
  total: string;
  completed: string;
  in_progress: string;
};

@Injectable()
export class PatientVisitsService {
  constructor(
    @InjectRepository(Visit)
    private readonly visits: Repository<Visit>,
    private readonly patientsService: PatientsService,
  ) {}

  async list(
    context: AuthorizationContext,
    patientId: string,
    query: ListPatientVisitsQueryDto,
  ): Promise<PatientVisitListResponse> {
    await this.patientsService.get(context, patientId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortOrder = query.sortOrder ?? SortOrder.DESC;
    const range = this.parseRange(query.from, query.to);
    const startedAtExpression = this.actualTimeExpression(
      'inProgressAppointmentStatus',
    );
    const completedAtExpression = this.actualTimeExpression(
      'completedAppointmentStatus',
    );

    const itemsQuery = this.createFilteredQuery(
      context,
      patientId,
      query,
      range,
      startedAtExpression,
    )
      .innerJoin('visit.openedByUser', 'dentist')
      .leftJoin('appointment.operatory', 'operatory')
      .select('visit.id', 'visit_id')
      .addSelect('visit.appointmentId', 'appointment_id')
      .addSelect('visit.status', 'visit_status')
      .addSelect('visit.diagnosis', 'diagnosis_summary')
      .addSelect(startedAtExpression, 'started_at')
      .addSelect(completedAtExpression, 'completed_at')
      .addSelect('dentist.id', 'dentist_id')
      .addSelect('dentist.fullName', 'dentist_full_name')
      .addSelect('operatory.id', 'operatory_id')
      .addSelect('operatory.code', 'operatory_code')
      .addSelect('operatory.name', 'operatory_name')
      .addSelect('operatory.isActive', 'operatory_is_active')
      .orderBy('started_at', sortOrder, 'NULLS LAST')
      .addOrderBy('visit.id', sortOrder)
      .offset((page - 1) * limit)
      .limit(limit)
      .setParameters({
        inProgressAppointmentStatus: AppointmentStatus.IN_PROGRESS,
        completedAppointmentStatus: AppointmentStatus.COMPLETED,
      });

    const countQuery = this.createFilteredQuery(
      context,
      patientId,
      query,
      range,
      startedAtExpression,
    )
      .select('COUNT(DISTINCT visit.id)', 'total')
      .setParameter(
        'inProgressAppointmentStatus',
        AppointmentStatus.IN_PROGRESS,
      );
    const summaryQuery = this.createScopedQuery(context, patientId)
      .select('COUNT(visit.id)', 'total')
      .addSelect(
        'COUNT(visit.id) FILTER (WHERE visit.status = :completedVisitStatus)',
        'completed',
      )
      .addSelect(
        'COUNT(visit.id) FILTER (WHERE visit.status = :openVisitStatus)',
        'in_progress',
      )
      .setParameters({
        completedVisitStatus: VisitStatus.COMPLETED,
        openVisitStatus: VisitStatus.OPEN,
      });
    const dentistsQuery = this.createScopedQuery(context, patientId)
      .innerJoin('visit.openedByUser', 'dentist')
      .select('dentist.id', 'id')
      .addSelect('dentist.fullName', 'full_name')
      .distinct(true)
      .orderBy('dentist.fullName', 'ASC')
      .addOrderBy('dentist.id', 'ASC');

    const [rows, rawCount, rawSummary, dentistRows] = await Promise.all([
      itemsQuery.getRawMany<RawPatientVisit>(),
      countQuery.getRawOne<{ total: string }>(),
      summaryQuery.getRawOne<RawVisitSummary>(),
      dentistsQuery.getRawMany<{ id: string; full_name: string }>(),
    ]);

    return {
      items: rows.map((row) => this.toListItem(row)),
      meta: toPageMeta({ page, limit }, Number(rawCount?.total ?? 0)),
      summary: {
        total: Number(rawSummary?.total ?? 0),
        completed: Number(rawSummary?.completed ?? 0),
        inProgress: Number(rawSummary?.in_progress ?? 0),
      },
      filterOptions: {
        dentists: dentistRows.map((dentist) => ({
          id: dentist.id,
          fullName: dentist.full_name,
        })),
      },
    };
  }

  private createScopedQuery(
    context: AuthorizationContext,
    patientId: string,
  ): SelectQueryBuilder<Visit> {
    return this.visits
      .createQueryBuilder('visit')
      .innerJoin('visit.appointment', 'appointment')
      .where('visit.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('visit.branchId = :branchId', {
        branchId: context.branch!.id,
      })
      .andWhere('appointment.tenantId = :tenantId')
      .andWhere('appointment.branchId = :branchId')
      .andWhere('appointment.patientId = :patientId', { patientId });
  }

  private createFilteredQuery(
    context: AuthorizationContext,
    patientId: string,
    query: ListPatientVisitsQueryDto,
    range: { from?: Date; to?: Date },
    startedAtExpression: string,
  ): SelectQueryBuilder<Visit> {
    const queryBuilder = this.createScopedQuery(context, patientId);

    if (query.status) {
      queryBuilder.andWhere('visit.status = :visitStatus', {
        visitStatus: query.status,
      });
    }
    if (query.dentistUserId) {
      queryBuilder.andWhere('visit.openedByUserId = :dentistUserId', {
        dentistUserId: query.dentistUserId,
      });
    }
    if (range.from) {
      queryBuilder.andWhere(`${startedAtExpression} >= :from`, {
        from: range.from,
      });
    }
    if (range.to) {
      queryBuilder.andWhere(`${startedAtExpression} < :to`, { to: range.to });
    }
    return queryBuilder;
  }

  private actualTimeExpression(statusParameter: string): string {
    return `(SELECT "transition"."occurred_at"
      FROM "appointment_status_transitions" "transition"
      WHERE "transition"."appointment_id" = "appointment"."id"
        AND "transition"."tenant_id" = :tenantId
        AND "transition"."branch_id" = :branchId
        AND "transition"."to_status" = :${statusParameter}
      ORDER BY "transition"."occurred_at" ASC, "transition"."id" ASC
      LIMIT 1)`;
  }

  private parseRange(
    fromInput: string | undefined,
    toInput: string | undefined,
  ): { from?: Date; to?: Date } {
    const from = fromInput ? new Date(fromInput) : undefined;
    const to = toInput ? new Date(toInput) : undefined;
    if (from && to && from.getTime() >= to.getTime()) {
      throw new RequestFieldValidationException(
        'to',
        'to must be later than from.',
      );
    }
    return { from, to };
  }

  private toListItem(row: RawPatientVisit): PatientVisitListItem {
    const startedAt = this.toDate(row.started_at);
    const completedAt = this.toDate(row.completed_at);
    const durationMilliseconds =
      row.visit_status === VisitStatus.COMPLETED && startedAt && completedAt
        ? completedAt.getTime() - startedAt.getTime()
        : null;
    const durationMinutes =
      durationMilliseconds !== null && durationMilliseconds >= 0
        ? Math.round(durationMilliseconds / 60_000)
        : null;

    return {
      id: row.visit_id,
      appointmentId: row.appointment_id,
      status: row.visit_status,
      startedAt,
      completedAt,
      durationMinutes,
      dentist: {
        id: row.dentist_id,
        fullName: row.dentist_full_name,
      },
      operatory: row.operatory_id
        ? {
            id: row.operatory_id,
            code: row.operatory_code!,
            name: row.operatory_name!,
            isActive: Boolean(row.operatory_is_active),
          }
        : null,
      diagnosisSummary: row.diagnosis_summary,
    };
  }

  private toDate(value: Date | string | null): Date | null {
    if (!value) return null;
    const result = value instanceof Date ? value : new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
  }
}
