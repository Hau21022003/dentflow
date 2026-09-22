import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { RequestFieldValidationException } from '../../common/exceptions/request-field-validation.exception';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import { AppointmentsRepository } from '../appointments/appointments.repository';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import { AppointmentStatusTransition } from '../appointments/entities/appointment-status-transition.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { CreateTreatmentNoteDto } from './dto/create-treatment-note.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { TreatmentNote } from './entities/treatment-note.entity';
import { Visit, VisitStatus } from './entities/visit.entity';
import { VisitsRepository } from './visits.repository';

const CLINICAL_FIELDS = [
  'symptoms',
  'relevantHistory',
  'examination',
  'diagnosis',
  'clinicalNote',
] as const;

type VisitWithAddenda = Visit & {
  addenda: Array<TreatmentNote & { author: { id: string; fullName: string } }>;
};

export interface VisitResponse {
  id: string;
  appointmentId: string;
  status: VisitStatus;
  openedByUserId: string;
  symptoms: string | null;
  relevantHistory: string | null;
  examination: string | null;
  diagnosis: string | null;
  clinicalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  addenda: Array<{
    id: string;
    content: string;
    author: { id: string; fullName: string };
    createdAt: Date;
  }>;
}

@Injectable()
export class VisitsService {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly visitsRepository: VisitsRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async start(
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<VisitResponse> {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.findAppointmentForUpdateOrFail(
        manager,
        context,
        appointmentId,
      );
      this.assertCaseOwner(context, appointment);
      if (appointment.status !== AppointmentStatus.CHECKED_IN) {
        throw new ConflictException(
          'Appointment must be checked in to start a Visit.',
        );
      }
      const existing =
        await this.visitsRepository.findByTenantBranchAndAppointmentIdForUpdate(
          manager,
          context.tenant!.id,
          context.branch!.id,
          appointmentId,
        );
      if (existing) {
        throw new ConflictException('Appointment already has a Visit.');
      }

      const visit = await manager.save(
        manager.create(Visit, {
          tenantId: context.tenant!.id,
          branchId: context.branch!.id,
          appointmentId: appointment.id,
          openedByUserId: context.actor.userId,
          status: VisitStatus.OPEN,
          symptoms: null,
          relevantHistory: null,
          examination: null,
          diagnosis: null,
          clinicalNote: null,
        }),
      );
      const appointmentBefore = this.appointmentSnapshot(appointment);
      const fromStatus = appointment.status;
      appointment.status = AppointmentStatus.IN_PROGRESS;
      const savedAppointment = await manager.save(appointment);
      await this.recordAppointmentTransition(
        manager,
        context,
        savedAppointment,
        fromStatus,
        AppointmentStatus.IN_PROGRESS,
      );
      await this.recordAppointmentAudit(manager, context, savedAppointment, {
        before: appointmentBefore,
        after: this.appointmentSnapshot(savedAppointment),
      });
      await this.recordVisitAudit(
        manager,
        context,
        AuditAction.VISIT_OPENED,
        visit,
        {
          after: { status: visit.status },
        },
      );

      return this.toResponse(
        await this.loadDetailsOrFail(manager, context, appointmentId),
      );
    });
  }

  async get(
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<VisitResponse> {
    const appointment =
      await this.appointmentsRepository.findByTenantBranchAndId(
        context.tenant!.id,
        context.branch!.id,
        appointmentId,
      );
    if (!appointment) {
      throw new NotFoundException('Appointment was not found.');
    }
    this.assertCaseOwner(context, appointment);
    const visit =
      await this.visitsRepository.findByTenantBranchAndAppointmentId(
        context.tenant!.id,
        context.branch!.id,
        appointmentId,
      );
    if (!visit) {
      throw new NotFoundException('Visit was not found.');
    }
    return this.toResponse(visit);
  }

  async update(
    context: AuthorizationContext,
    appointmentId: string,
    input: UpdateVisitDto,
  ): Promise<VisitResponse> {
    const fields = CLINICAL_FIELDS.filter(
      (field) => input[field] !== undefined,
    );
    if (fields.length === 0) {
      throw new RequestFieldValidationException(
        'body',
        'At least one clinical field must be provided.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.findAppointmentForUpdateOrFail(
        manager,
        context,
        appointmentId,
      );
      this.assertCaseOwner(context, appointment);
      this.assertAppointmentInProgress(appointment);
      const visit = await this.findVisitForUpdateOrFail(
        manager,
        context,
        appointmentId,
      );
      this.assertVisitOpen(visit);
      const changedFields = fields.filter(
        (field) => visit[field] !== input[field],
      );
      if (changedFields.length > 0) {
        for (const field of changedFields) {
          visit[field] = input[field] ?? null;
        }
        const saved = await manager.save(visit);
        await this.recordVisitAudit(
          manager,
          context,
          AuditAction.VISIT_UPDATED,
          saved,
          {
            before: { status: saved.status },
            after: { status: saved.status, changedFields },
          },
        );
      }
      return this.toResponse(
        await this.loadDetailsOrFail(manager, context, appointmentId),
      );
    });
  }

  async complete(
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<VisitResponse> {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.findAppointmentForUpdateOrFail(
        manager,
        context,
        appointmentId,
      );
      this.assertCaseOwner(context, appointment);
      this.assertAppointmentInProgress(appointment);
      const visit = await this.findVisitForUpdateOrFail(
        manager,
        context,
        appointmentId,
      );
      this.assertVisitOpen(visit);
      if (!this.hasClinicalContent(visit)) {
        throw new RequestFieldValidationException(
          'visit',
          'At least one clinical field must contain content before completion.',
        );
      }

      visit.status = VisitStatus.COMPLETED;
      const savedVisit = await manager.save(visit);
      const appointmentBefore = this.appointmentSnapshot(appointment);
      const fromStatus = appointment.status;
      appointment.status = AppointmentStatus.COMPLETED;
      const savedAppointment = await manager.save(appointment);
      await this.recordAppointmentTransition(
        manager,
        context,
        savedAppointment,
        fromStatus,
        AppointmentStatus.COMPLETED,
      );
      await this.recordAppointmentAudit(manager, context, savedAppointment, {
        before: appointmentBefore,
        after: this.appointmentSnapshot(savedAppointment),
      });
      await this.recordVisitAudit(
        manager,
        context,
        AuditAction.VISIT_COMPLETED,
        savedVisit,
        {
          before: { status: VisitStatus.OPEN },
          after: { status: VisitStatus.COMPLETED },
        },
      );

      return this.toResponse(
        await this.loadDetailsOrFail(manager, context, appointmentId),
      );
    });
  }

  async addendum(
    context: AuthorizationContext,
    appointmentId: string,
    input: CreateTreatmentNoteDto,
  ): Promise<VisitResponse> {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.findAppointmentForUpdateOrFail(
        manager,
        context,
        appointmentId,
      );
      this.assertCaseOwner(context, appointment);
      if (appointment.status !== AppointmentStatus.COMPLETED) {
        throw new ConflictException(
          'Appointment must be completed before adding an addendum.',
        );
      }
      const visit = await this.findVisitForUpdateOrFail(
        manager,
        context,
        appointmentId,
      );
      if (visit.status !== VisitStatus.COMPLETED) {
        throw new ConflictException(
          'Addenda may only be added after Visit completion.',
        );
      }
      const note = await manager.save(
        manager.create(TreatmentNote, {
          tenantId: context.tenant!.id,
          branchId: context.branch!.id,
          visitId: visit.id,
          authorUserId: context.actor.userId,
          content: input.content,
        }),
      );
      await this.auditLogService.record(manager, {
        action: AuditAction.TREATMENT_NOTE_ADDED,
        actor: this.auditActor(context),
        tenantId: note.tenantId,
        branchId: note.branchId,
        resourceId: note.id,
        after: {
          visitId: note.visitId,
          createdAt: note.createdAt.toISOString(),
        },
      });
      return this.toResponse(
        await this.loadDetailsOrFail(manager, context, appointmentId),
      );
    });
  }

  private async findAppointmentForUpdateOrFail(
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

  private async findVisitForUpdateOrFail(
    manager: EntityManager,
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<Visit> {
    const visit =
      await this.visitsRepository.findByTenantBranchAndAppointmentIdForUpdate(
        manager,
        context.tenant!.id,
        context.branch!.id,
        appointmentId,
      );
    if (!visit) {
      throw new NotFoundException('Visit was not found.');
    }
    return visit;
  }

  private async loadDetailsOrFail(
    manager: EntityManager,
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<VisitWithAddenda> {
    const visit =
      await this.visitsRepository.findDetailsByTenantBranchAndAppointmentId(
        manager,
        context.tenant!.id,
        context.branch!.id,
        appointmentId,
      );
    if (!visit) {
      throw new NotFoundException('Visit was not found.');
    }
    return visit;
  }

  private assertCaseOwner(
    context: AuthorizationContext,
    appointment: Appointment,
  ): void {
    if (appointment.assignedDentistUserId !== context.actor.userId) {
      throw new ForbiddenException(
        'Only the assigned Dentist may access this Visit.',
      );
    }
  }

  private assertVisitOpen(visit: Visit): void {
    if (visit.status !== VisitStatus.OPEN) {
      throw new ConflictException(
        'Visit clinical content is locked after completion.',
      );
    }
  }

  private assertAppointmentInProgress(appointment: Appointment): void {
    if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
      throw new ConflictException(
        'Appointment must be in progress for this Visit command.',
      );
    }
  }

  private hasClinicalContent(visit: Visit): boolean {
    return CLINICAL_FIELDS.some((field) => Boolean(visit[field]?.trim()));
  }

  private appointmentSnapshot(
    appointment: Appointment,
  ): Record<string, unknown> {
    return {
      status: appointment.status,
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      assignedDentistUserId: appointment.assignedDentistUserId,
    };
  }

  private auditActor(context: AuthorizationContext) {
    return {
      type: AuditActorType.USER,
      userId: context.actor.userId,
      sessionId: context.actor.sessionId,
    };
  }

  private async recordAppointmentTransition(
    manager: EntityManager,
    context: AuthorizationContext,
    appointment: Appointment,
    fromStatus: AppointmentStatus,
    toStatus: AppointmentStatus,
  ): Promise<void> {
    await manager.save(
      manager.create(AppointmentStatusTransition, {
        appointmentId: appointment.id,
        tenantId: appointment.tenantId,
        branchId: appointment.branchId,
        fromStatus,
        toStatus,
        reasonCode: null,
        changedByUserId: context.actor.userId,
      }),
    );
  }

  private async recordAppointmentAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    appointment: Appointment,
    input: { before: Record<string, unknown>; after: Record<string, unknown> },
  ): Promise<void> {
    await this.auditLogService.record(manager, {
      action: AuditAction.APPOINTMENT_STATE_CHANGED,
      actor: this.auditActor(context),
      tenantId: appointment.tenantId,
      branchId: appointment.branchId,
      resourceId: appointment.id,
      before: input.before,
      after: input.after,
    });
  }

  private async recordVisitAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    action:
      | typeof AuditAction.VISIT_OPENED
      | typeof AuditAction.VISIT_UPDATED
      | typeof AuditAction.VISIT_COMPLETED,
    visit: Visit,
    input: { before?: Record<string, unknown>; after: Record<string, unknown> },
  ): Promise<void> {
    await this.auditLogService.record(manager, {
      action,
      actor: this.auditActor(context),
      tenantId: visit.tenantId,
      branchId: visit.branchId,
      resourceId: visit.id,
      ...(input.before ? { before: input.before } : {}),
      after: input.after,
    });
  }

  private toResponse(visit: VisitWithAddenda): VisitResponse {
    return {
      id: visit.id,
      appointmentId: visit.appointmentId,
      status: visit.status,
      openedByUserId: visit.openedByUserId,
      symptoms: visit.symptoms,
      relevantHistory: visit.relevantHistory,
      examination: visit.examination,
      diagnosis: visit.diagnosis,
      clinicalNote: visit.clinicalNote,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      addenda: (visit.addenda ?? []).map((note) => ({
        id: note.id,
        content: note.content,
        author: { id: note.author.id, fullName: note.author.fullName },
        createdAt: note.createdAt,
      })),
    };
  }
}
