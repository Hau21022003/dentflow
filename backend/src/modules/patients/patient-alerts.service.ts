import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import {
  CreatePatientAlertDto,
  ResolvePatientAlertReasonCode,
  UpdatePatientAlertDto,
} from './dto/patient-alert.dto';
import {
  PatientAlert,
  PatientAlertCategory,
  PatientAlertSeverity,
} from './entities/patient-alert.entity';
import { Patient } from './entities/patient.entity';

const ACTIVE_CASE_APPOINTMENT_STATUSES = [
  AppointmentStatus.BOOKED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

export type PatientAlertResponse = {
  id: string;
  category: PatientAlertCategory;
  severity: PatientAlertSeverity;
  message: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PatientAlertsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(context: AuthorizationContext, patientId: string) {
    await this.assertAssignedDentistCase(
      this.dataSource.manager,
      context,
      patientId,
    );
    const alerts = await this.dataSource.getRepository(PatientAlert).find({
      where: { tenantId: context.tenant!.id, patientId },
      order: { resolvedAt: 'ASC', severity: 'DESC', createdAt: 'DESC' },
    });
    return { items: alerts.map((alert) => this.toResponse(alert)) };
  }

  async listActive(
    context: AuthorizationContext,
    patientId: string,
  ): Promise<PatientAlertResponse[]> {
    const alerts = await this.dataSource.getRepository(PatientAlert).find({
      where: {
        tenantId: context.tenant!.id,
        patientId,
        resolvedAt: IsNull(),
      },
      order: { severity: 'DESC', createdAt: 'ASC' },
    });
    return alerts.map((alert) => this.toResponse(alert));
  }

  async create(
    context: AuthorizationContext,
    patientId: string,
    input: CreatePatientAlertDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.assertAssignedDentistCase(manager, context, patientId);
      const alert = await manager.save(
        manager.create(PatientAlert, {
          tenantId: context.tenant!.id,
          patientId,
          category: input.category,
          severity: input.severity,
          message: input.message,
          createdByUserId: context.actor.userId,
          resolvedByUserId: null,
          resolvedAt: null,
        }),
      );
      await this.recordAudit(
        manager,
        context,
        AuditAction.PATIENT_ALERT_CREATED,
        alert,
        {
          category: alert.category,
          severity: alert.severity,
        },
      );
      return this.toResponse(alert);
    });
  }

  async update(
    context: AuthorizationContext,
    patientId: string,
    alertId: string,
    input: UpdatePatientAlertDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.assertAssignedDentistCase(manager, context, patientId);
      const alert = await manager.getRepository(PatientAlert).findOne({
        where: {
          id: alertId,
          tenantId: context.tenant!.id,
          patientId,
          resolvedAt: IsNull(),
        },
      });
      if (!alert) {
        throw new NotFoundException('Active Patient Alert was not found.');
      }
      const changedFields = ['category', 'severity', 'message'].filter(
        (field) =>
          alert[field as 'category' | 'severity' | 'message'] !==
          input[field as 'category' | 'severity' | 'message'],
      );
      if (changedFields.length === 0) return this.toResponse(alert);
      alert.category = input.category;
      alert.severity = input.severity;
      alert.message = input.message;
      await manager.save(alert);
      await this.recordAudit(
        manager,
        context,
        AuditAction.PATIENT_ALERT_UPDATED,
        alert,
        {
          changedFields,
          category: alert.category,
          severity: alert.severity,
        },
      );
      return this.toResponse(alert);
    });
  }

  async resolve(
    context: AuthorizationContext,
    patientId: string,
    alertId: string,
    reasonCode: ResolvePatientAlertReasonCode,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.assertAssignedDentistCase(manager, context, patientId);
      const alert = await manager.getRepository(PatientAlert).findOne({
        where: {
          id: alertId,
          tenantId: context.tenant!.id,
          patientId,
          resolvedAt: IsNull(),
        },
      });
      if (!alert) {
        throw new NotFoundException('Active Patient Alert was not found.');
      }
      alert.resolvedAt = new Date();
      alert.resolvedByUserId = context.actor.userId;
      await manager.save(alert);
      await this.recordAudit(
        manager,
        context,
        AuditAction.PATIENT_ALERT_RESOLVED,
        alert,
        {
          resolvedAt: alert.resolvedAt.toISOString(),
        },
        reasonCode,
      );
      return this.toResponse(alert);
    });
  }

  private toResponse(alert: PatientAlert): PatientAlertResponse {
    return {
      id: alert.id,
      category: alert.category,
      severity: alert.severity,
      message: alert.message,
      resolvedAt: alert.resolvedAt,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }

  private async assertAssignedDentistCase(
    manager: EntityManager,
    context: AuthorizationContext,
    patientId: string,
  ): Promise<void> {
    const patient = await manager.getRepository(Patient).findOne({
      where: { id: patientId, tenantId: context.tenant!.id },
    });
    if (!patient) throw new NotFoundException('Patient was not found.');
    const count = await manager.getRepository(Appointment).count({
      where: {
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
        patientId,
        assignedDentistUserId: context.actor.userId,
        status: In(ACTIVE_CASE_APPOINTMENT_STATUSES),
      },
    });
    if (count === 0) {
      throw new ForbiddenException(
        'The Dentist is not assigned to an active case for this Patient.',
      );
    }
  }

  private async recordAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    action: AuditAction,
    alert: PatientAlert,
    after: Record<string, unknown>,
    reasonCode?: string,
  ): Promise<void> {
    await this.auditLogService.record(manager, {
      action,
      actor: {
        type: AuditActorType.USER,
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
      },
      tenantId: context.tenant!.id,
      branchId: context.branch!.id,
      resourceId: alert.id,
      after,
      ...(reasonCode ? { metadata: { reasonCode } } : {}),
    });
  }
}
