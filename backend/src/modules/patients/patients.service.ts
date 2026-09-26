import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  SelectQueryBuilder,
} from 'typeorm';
import {
  applyIlikeSearch,
  applyOffsetPagination,
  applySafeSort,
  toPageMeta,
} from '../../common/database/query-builder-list.util';
import { SortOrder } from '../../common/dto/page-list-query.dto';
import { RequestFieldValidationException } from '../../common/exceptions/request-field-validation.exception';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { CreatePatientDto } from './dto/create-patient.dto';
import {
  ListPatientsQueryDto,
  PatientScheduleFilter,
  PatientSortBy,
} from './dto/list-patients-query.dto';
import { PatientEmergencyContactDto } from './dto/patient-emergency-contact.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Patient, PatientGender } from './entities/patient.entity';
import { normalizePatientPhone } from './patient-phone.util';
import { PatientsRepository } from './patients.repository';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';

const PATIENT_CREATED_FIELDS = [
  'fullName',
  'phone',
  'gender',
  'dateOfBirth',
  'address',
  'emergencyContact',
  'referralSource',
] as const;
const PATIENT_SORT_FIELDS: Readonly<Record<PatientSortBy, string>> = {
  [PatientSortBy.FULL_NAME]: 'patient.full_name',
  [PatientSortBy.DATE_OF_BIRTH]: 'patient.date_of_birth',
  [PatientSortBy.CREATED_AT]: 'patient.created_at',
  [PatientSortBy.NEXT_APPOINTMENT_AT]: 'nextAppointment.start_at',
  [PatientSortBy.LAST_VISIT_AT]: 'lastVisit.end_at',
};

const UPCOMING_APPOINTMENT_STATUSES = [
  AppointmentStatus.BOOKED,
  AppointmentStatus.CONFIRMED,
] as const;

export interface PatientResponse {
  id: string;
  fullName: string;
  phone: string;
  dateOfBirth: string | null;
  gender: PatientGender;
  address: string | null;
  emergencyContact: {
    fullName: string;
    phone: string;
    relationship: string | null;
  } | null;
  referralSource: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientAppointmentSummary {
  startAt: Date;
  serviceName: string | null;
  visitReason: string | null;
}

export interface PatientLastVisitSummary {
  completedAt: Date;
}

export interface PatientListResponse extends PatientResponse {
  nextAppointment: PatientAppointmentSummary | null;
  lastVisit: PatientLastVisitSummary | null;
}

export interface AssignedPatientListResponse {
  id: string;
  fullName: string;
  phone: string;
  dateOfBirth: string | null;
  gender: PatientGender;
  nextAppointment: PatientAppointmentSummary | null;
  lastVisit: PatientLastVisitSummary | null;
}

export interface PatientScheduleCounts {
  all: number;
  withUpcoming: number;
  withoutUpcoming: number;
}

type PatientListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  scheduleCounts: PatientScheduleCounts;
};

type PatientScheduleCountsRaw = Record<keyof PatientScheduleCounts, string>;

type PatientUpdateValues = {
  fullName?: string;
  phone?: string;
  phoneNormalized?: string;
  gender?: PatientGender;
  dateOfBirth?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  referralSource?: string | null;
};

@Injectable()
export class PatientsService {
  constructor(
    private readonly patientsRepository: PatientsRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(
    context: AuthorizationContext,
    query: ListPatientsQueryDto,
  ): Promise<{
    items: PatientListResponse[];
    meta: PatientListMeta;
  }> {
    return this.listPatients(context, query, false);
  }

  async listAssigned(
    context: AuthorizationContext,
    query: ListPatientsQueryDto,
  ): Promise<{
    items: AssignedPatientListResponse[];
    meta: PatientListMeta;
  }> {
    return this.listPatients(context, query, true);
  }

  private async listPatients(
    context: AuthorizationContext,
    query: ListPatientsQueryDto,
    assignedOnly: false,
  ): Promise<{
    items: PatientListResponse[];
    meta: PatientListMeta;
  }>;
  private async listPatients(
    context: AuthorizationContext,
    query: ListPatientsQueryDto,
    assignedOnly: true,
  ): Promise<{
    items: AssignedPatientListResponse[];
    meta: PatientListMeta;
  }>;
  private async listPatients(
    context: AuthorizationContext,
    query: ListPatientsQueryDto,
    assignedOnly: boolean,
  ): Promise<{
    items: PatientListResponse[] | AssignedPatientListResponse[];
    meta: PatientListMeta;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const queryBuilder = this.patientsRepository.ormRepository
      .createQueryBuilder('patient')
      .where('patient.tenantId = :tenantId', { tenantId: context.tenant!.id })
      .leftJoin(
        Appointment,
        'nextAppointment',
        `nextAppointment.id = (
          SELECT next_appointment.id
          FROM appointments next_appointment
          WHERE next_appointment.tenant_id = patient.tenant_id
            AND next_appointment.branch_id = :branchId
            AND next_appointment.patient_id = patient.id
            AND next_appointment.status IN (:...upcomingStatuses)
            AND next_appointment.start_at > NOW()
          ORDER BY next_appointment.start_at ASC, next_appointment.id ASC
          LIMIT 1
        )`,
      )
      .leftJoin(
        Appointment,
        'lastVisit',
        `lastVisit.id = (
          SELECT last_visit.id
          FROM appointments last_visit
          WHERE last_visit.tenant_id = patient.tenant_id
            AND last_visit.branch_id = :branchId
            AND last_visit.patient_id = patient.id
            AND last_visit.status = :completedStatus
          ORDER BY last_visit.end_at DESC, last_visit.id DESC
          LIMIT 1
        )`,
      )
      .addSelect('nextAppointment.startAt', 'next_appointment_start_at')
      .addSelect('nextAppointment.serviceName', 'next_appointment_service_name')
      .addSelect('nextAppointment.visitReason', 'next_appointment_visit_reason')
      .addSelect('lastVisit.endAt', 'last_visit_completed_at')
      .setParameters({
        branchId: context.branch!.id,
        upcomingStatuses: UPCOMING_APPOINTMENT_STATUSES,
        completedStatus: AppointmentStatus.COMPLETED,
      });

    if (assignedOnly) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1
          FROM appointments assigned_appointment
          WHERE assigned_appointment.tenant_id = patient.tenant_id
            AND assigned_appointment.branch_id = :branchId
            AND assigned_appointment.patient_id = patient.id
            AND assigned_appointment.assigned_dentist_user_id = :actorUserId
        )`,
        { actorUserId: context.actor.userId },
      );
    }

    applyIlikeSearch(queryBuilder, query.search, [
      'patient.full_name',
      'patient.phone',
    ]);
    const scheduleCounts = await this.getScheduleCounts(queryBuilder);
    if (query.scheduleFilter === PatientScheduleFilter.WITH_UPCOMING) {
      queryBuilder.andWhere('nextAppointment.id IS NOT NULL');
    }
    if (query.scheduleFilter === PatientScheduleFilter.WITHOUT_UPCOMING) {
      queryBuilder.andWhere('nextAppointment.id IS NULL');
    }
    applySafeSort(queryBuilder, {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      fields: PATIENT_SORT_FIELDS,
      defaultField: PATIENT_SORT_FIELDS[PatientSortBy.CREATED_AT],
      defaultOrder: SortOrder.DESC,
      tieBreaker: 'patient.id',
    });
    const total = await queryBuilder.getCount();
    applyOffsetPagination(queryBuilder, { page, limit });

    const raw = await queryBuilder.getRawMany<Record<string, unknown>>();
    return {
      items: raw.map((row) => {
        const patient = this.toResponseFromRaw(row);
        const summary = this.toListSummary(row);
        if (assignedOnly) {
          return this.toAssignedListResponse(patient, summary);
        }
        return { ...patient, ...summary };
      }),
      meta: { ...toPageMeta({ page, limit }, total), scheduleCounts },
    };
  }

  private async getScheduleCounts(
    queryBuilder: SelectQueryBuilder<Patient>,
  ): Promise<PatientScheduleCounts> {
    const counts = await queryBuilder
      .clone()
      .select('COUNT(patient.id)', 'all')
      .addSelect('COUNT(nextAppointment.id)', 'withUpcoming')
      .addSelect(
        'COUNT(patient.id) FILTER (WHERE nextAppointment.id IS NULL)',
        'withoutUpcoming',
      )
      .getRawOne<PatientScheduleCountsRaw>();

    return {
      all: Number(counts?.all ?? 0),
      withUpcoming: Number(counts?.withUpcoming ?? 0),
      withoutUpcoming: Number(counts?.withoutUpcoming ?? 0),
    };
  }

  async get(
    context: AuthorizationContext,
    patientId: string,
  ): Promise<PatientResponse> {
    const patient = await this.patientsRepository.findByTenantAndId(
      context.tenant!.id,
      patientId,
    );
    if (!patient) {
      throw new NotFoundException('Patient was not found.');
    }

    return this.toResponse(patient);
  }

  async create(
    context: AuthorizationContext,
    input: CreatePatientDto,
  ): Promise<PatientResponse> {
    const phoneNormalized = this.normalizePhoneOrFail(input.phone, 'phone');
    const emergencyContact = this.toEmergencyContact(input.emergencyContact);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const patient = manager.create(Patient, {
          tenantId: context.tenant!.id,
          fullName: input.fullName,
          phone: input.phone,
          phoneNormalized,
          gender: input.gender,
          dateOfBirth: input.dateOfBirth ?? null,
          address: input.address ?? null,
          ...emergencyContact,
          referralSource: input.referralSource ?? null,
        });
        const savedPatient = await manager.save(patient);
        await this.recordAudit(
          manager,
          context,
          AuditAction.PATIENT_CREATED,
          savedPatient,
          PATIENT_CREATED_FIELDS.filter((field) =>
            this.isPatientFieldPresent(savedPatient, field),
          ),
        );
        return this.toResponse(savedPatient);
      });
    } catch (error) {
      this.throwIfPhoneAlreadyExists(error);
      throw error;
    }
  }

  async update(
    context: AuthorizationContext,
    patientId: string,
    input: UpdatePatientDto,
  ): Promise<PatientResponse> {
    const values = this.toUpdateValues(input);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const patient = await this.findByTenantAndIdOrFail(
          manager,
          context.tenant!.id,
          patientId,
        );
        const changedFields = this.getChangedFields(patient, input, values);
        if (changedFields.length === 0) {
          return this.toResponse(patient);
        }

        Object.assign(patient, values);
        const savedPatient = await manager.save(patient);
        await this.recordAudit(
          manager,
          context,
          AuditAction.PATIENT_ADMINISTRATIVE_UPDATED,
          savedPatient,
          changedFields,
        );
        return this.toResponse(savedPatient);
      });
    } catch (error) {
      this.throwIfPhoneAlreadyExists(error);
      throw error;
    }
  }

  private async findByTenantAndIdOrFail(
    manager: EntityManager,
    tenantId: string,
    patientId: string,
  ): Promise<Patient> {
    const patient = await this.patientsRepository.findByTenantAndIdForUpdate(
      manager,
      tenantId,
      patientId,
    );
    if (!patient) {
      throw new NotFoundException('Patient was not found.');
    }
    return patient;
  }

  private toUpdateValues(input: UpdatePatientDto): PatientUpdateValues {
    const values: PatientUpdateValues = {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.dateOfBirth !== undefined
        ? { dateOfBirth: input.dateOfBirth }
        : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.referralSource !== undefined
        ? { referralSource: input.referralSource }
        : {}),
    };

    if (input.phone !== undefined) {
      values.phone = input.phone;
      values.phoneNormalized = this.normalizePhoneOrFail(input.phone, 'phone');
    }
    if (input.emergencyContact !== undefined) {
      Object.assign(values, this.toEmergencyContact(input.emergencyContact));
    }

    return values;
  }

  private getChangedFields(
    patient: Patient,
    input: UpdatePatientDto,
    values: PatientUpdateValues,
  ): string[] {
    const changedFields: string[] = [];
    if (values.fullName !== undefined && patient.fullName !== values.fullName) {
      changedFields.push('fullName');
    }
    if (values.phone !== undefined && patient.phone !== values.phone) {
      changedFields.push('phone');
    }
    if (values.gender !== undefined && patient.gender !== values.gender) {
      changedFields.push('gender');
    }
    if (
      values.dateOfBirth !== undefined &&
      patient.dateOfBirth !== values.dateOfBirth
    ) {
      changedFields.push('dateOfBirth');
    }
    if (values.address !== undefined && patient.address !== values.address) {
      changedFields.push('address');
    }
    if (
      input.emergencyContact !== undefined &&
      (patient.emergencyContactName !== values.emergencyContactName ||
        patient.emergencyContactPhone !== values.emergencyContactPhone ||
        patient.emergencyContactRelationship !==
          values.emergencyContactRelationship)
    ) {
      changedFields.push('emergencyContact');
    }
    if (
      values.referralSource !== undefined &&
      patient.referralSource !== values.referralSource
    ) {
      changedFields.push('referralSource');
    }
    return changedFields;
  }

  private toEmergencyContact(
    contact: PatientEmergencyContactDto | null | undefined,
  ): Pick<
    Patient,
    | 'emergencyContactName'
    | 'emergencyContactPhone'
    | 'emergencyContactRelationship'
  > {
    if (!contact) {
      return {
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelationship: null,
      };
    }

    this.normalizePhoneOrFail(contact.phone, 'emergencyContact.phone');
    return {
      emergencyContactName: contact.fullName,
      emergencyContactPhone: contact.phone,
      emergencyContactRelationship: contact.relationship ?? null,
    };
  }

  private normalizePhoneOrFail(value: string, field: string): string {
    const normalized = normalizePatientPhone(value);
    if (!normalized) {
      throw new RequestFieldValidationException(
        field,
        'Phone number must be valid for Vietnam or include a valid country code.',
      );
    }
    return normalized;
  }

  private isPatientFieldPresent(
    patient: Patient,
    field: (typeof PATIENT_CREATED_FIELDS)[number],
  ): boolean {
    if (field === 'emergencyContact') {
      return patient.emergencyContactName !== null;
    }
    return patient[field] !== null;
  }

  private async recordAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    action: AuditAction,
    patient: Patient,
    changedFields: readonly string[],
  ): Promise<void> {
    await this.auditLogService.record(manager, {
      action,
      actor: {
        type: AuditActorType.USER,
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
      },
      tenantId: patient.tenantId,
      branchId: context.branch!.id,
      resourceId: patient.id,
      after: { changedFields: [...changedFields] },
      ...(action === AuditAction.PATIENT_ADMINISTRATIVE_UPDATED
        ? { before: { changedFields: [...changedFields] } }
        : {}),
    });
  }

  private toResponse(patient: Patient): PatientResponse {
    return {
      id: patient.id,
      fullName: patient.fullName,
      phone: patient.phone,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      address: patient.address,
      emergencyContact:
        patient.emergencyContactName && patient.emergencyContactPhone
          ? {
              fullName: patient.emergencyContactName,
              phone: patient.emergencyContactPhone,
              relationship: patient.emergencyContactRelationship,
            }
          : null,
      referralSource: patient.referralSource,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    };
  }

  private toListSummary(raw: Record<string, unknown>): Pick<
    PatientListResponse,
    'nextAppointment' | 'lastVisit'
  > {
    const nextStartAt = raw.next_appointment_start_at;
    const lastCompletedAt = raw.last_visit_completed_at;
    return {
      nextAppointment: nextStartAt
        ? {
            startAt: new Date(String(nextStartAt)),
            serviceName:
              typeof raw.next_appointment_service_name === 'string'
                ? raw.next_appointment_service_name
                : null,
            visitReason:
              typeof raw.next_appointment_visit_reason === 'string'
                ? raw.next_appointment_visit_reason
                : null,
          }
        : null,
      lastVisit: lastCompletedAt
        ? { completedAt: new Date(String(lastCompletedAt)) }
        : null,
    };
  }

  private toResponseFromRaw(raw: Record<string, unknown>): PatientResponse {
    const emergencyContactName = this.rawString(raw.patient_emergency_contact_name);
    const emergencyContactPhone = this.rawString(raw.patient_emergency_contact_phone);
    return {
      id: String(raw.patient_id),
      fullName: String(raw.patient_full_name),
      phone: String(raw.patient_phone),
      dateOfBirth: this.rawString(raw.patient_date_of_birth),
      gender: raw.patient_gender as PatientGender,
      address: this.rawString(raw.patient_address),
      emergencyContact:
        emergencyContactName && emergencyContactPhone
          ? {
              fullName: emergencyContactName,
              phone: emergencyContactPhone,
              relationship: this.rawString(
                raw.patient_emergency_contact_relationship,
              ),
            }
          : null,
      referralSource: this.rawString(raw.patient_referral_source),
      createdAt: new Date(String(raw.patient_created_at)),
      updatedAt: new Date(String(raw.patient_updated_at)),
    };
  }

  private rawString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private toAssignedListResponse(
    patient: PatientResponse,
    summary: Pick<PatientListResponse, 'nextAppointment' | 'lastVisit'>,
  ): AssignedPatientListResponse {
    return {
      id: patient.id,
      fullName: patient.fullName,
      phone: patient.phone,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      ...summary,
    };
  }

  private throwIfPhoneAlreadyExists(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { constraint?: string }).constraint ===
        'uq_patients_tenant_id_phone_normalized'
    ) {
      throw new ConflictException(
        'A patient with this phone number already exists in the tenant.',
      );
    }
  }
}
