import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import {
  Brackets,
  DataSource,
  EntityManager,
  IsNull,
  Repository,
} from 'typeorm';
import { RequestFieldValidationException } from '../../common/exceptions/request-field-validation.exception';
import { SortOrder } from '../../common/dto/page-list-query.dto';
import { AppConfigService } from '../../config/app-config.service';
import {
  OBJECT_STORAGE,
  ObjectStorageUnavailableError,
  type ObjectStorage,
  type StoredObjectMetadata,
} from '../../infrastructure/storage';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import { AppointmentsRepository } from '../appointments/appointments.repository';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  PATIENT_FILE_CONTENT_TYPES,
  PATIENT_FILE_EXTENSION_BY_CONTENT_TYPE,
  PATIENT_FILE_MAX_BYTES,
  type PatientFileContentType,
} from '../uploads/upload.constants';
import { Visit, VisitStatus } from '../visits/entities/visit.entity';
import { CreatePatientFileDto } from './dto/create-patient-file.dto';
import { ListPatientFilesQueryDto } from './dto/list-patient-files-query.dto';
import {
  PatientFileDisposition,
  PatientFileAccessQueryDto,
} from './dto/patient-file-access-query.dto';
import { UpdatePatientFileDto } from './dto/update-patient-file.dto';
import {
  PatientFile,
  PatientFileCategory,
} from './entities/patient-file.entity';

type AccessContext = { appointment: Appointment; visit: Visit };

export interface PatientFileResponse {
  id: string;
  sourceVisitId: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  category: PatientFileCategory;
  note: string | null;
  fileDate: string;
  previewUrl: string | null;
  createdBy: { id: string; fullName: string };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PatientFilesService {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    @InjectRepository(Visit)
    private readonly visitsRepository: Repository<Visit>,
    @InjectRepository(PatientFile)
    private readonly filesRepository: Repository<PatientFile>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(OBJECT_STORAGE) private readonly objectStorage: ObjectStorage,
    private readonly auditLogService: AuditLogService,
    private readonly config: AppConfigService,
  ) {}

  async list(
    context: AuthorizationContext,
    appointmentId: string,
    query: ListPatientFilesQueryDto,
  ) {
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      throw new RequestFieldValidationException(
        'dateRange',
        'Patient file dateFrom must not be after dateTo.',
      );
    }
    const { appointment } = await this.resolveAccess(
      context,
      appointmentId,
      false,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const base = this.filesRepository
      .createQueryBuilder('file')
      .innerJoinAndSelect('file.createdBy', 'createdBy')
      .where('file.tenantId = :tenantId', { tenantId: context.tenant!.id })
      .andWhere('file.branchId = :branchId', { branchId: context.branch!.id })
      .andWhere('file.patientId = :patientId', {
        patientId: appointment.patientId,
      })
      .andWhere('file.archivedAt IS NULL');
    this.applyFilters(base, query, true);
    const sortBy = query.sortBy ?? 'fileDate';
    const sortOrder = query.sortOrder ?? SortOrder.DESC;
    base
      .orderBy(`file.${sortBy}`, sortOrder)
      .addOrderBy('file.createdAt', SortOrder.DESC)
      .addOrderBy('file.id', SortOrder.DESC)
      .skip((page - 1) * limit)
      .take(limit);

    const [files, total] = await base.getManyAndCount();
    const facets = this.filesRepository
      .createQueryBuilder('file')
      .select('file.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('file.tenantId = :tenantId', { tenantId: context.tenant!.id })
      .andWhere('file.branchId = :branchId', { branchId: context.branch!.id })
      .andWhere('file.patientId = :patientId', {
        patientId: appointment.patientId,
      })
      .andWhere('file.archivedAt IS NULL');
    this.applyFilters(facets, query, false);
    const rows = await facets.groupBy('file.category').getRawMany<{
      category: PatientFileCategory;
      count: string;
    }>();
    const categoryCounts = Object.fromEntries(
      Object.values(PatientFileCategory).map((category) => [category, 0]),
    ) as Record<PatientFileCategory, number>;
    for (const row of rows) categoryCounts[row.category] = Number(row.count);

    return {
      items: await Promise.all(files.map((file) => this.toResponse(file))),
      meta: { page, limit, total, categoryCounts },
    };
  }

  async create(
    context: AuthorizationContext,
    appointmentId: string,
    input: CreatePatientFileDto,
  ): Promise<PatientFileResponse> {
    const initial = await this.resolveAccess(context, appointmentId, true);
    this.assertFileDate(input.fileDate, context.branch!.timezone);
    const originalFileName = this.normalizeOriginalFileName(
      input.originalFileName,
    );
    const extension = this.tempFileExtension(context, input.objectKey);
    const metadata = await this.readAndValidateTempObject(
      input.objectKey,
      extension,
    );
    const fileId = randomUUID();
    const permanentObjectKey = `clinical/${context.tenant!.id}/${context.branch!.id}/${initial.appointment.patientId}/patient-files/${fileId}.${extension}`;
    await this.copyObject(input.objectKey, permanentObjectKey);

    try {
      await this.dataSource.transaction(async (manager) => {
        const { visit, appointment } = await this.resolveAccessForUpdate(
          manager,
          context,
          appointmentId,
        );
        const file = manager.create(PatientFile, {
          id: fileId,
          tenantId: context.tenant!.id,
          branchId: context.branch!.id,
          patientId: appointment.patientId,
          sourceVisitId: visit.id,
          originalFileName,
          objectKey: permanentObjectKey,
          contentType: metadata.contentType!,
          sizeBytes: metadata.sizeBytes!,
          category: input.category,
          note: this.normalizeNote(input.note),
          fileDate: input.fileDate,
          createdByUserId: context.actor.userId,
          updatedByUserId: context.actor.userId,
          archivedByUserId: null,
          archivedAt: null,
        });
        await manager.save(file);
        await this.recordAudit(
          manager,
          context,
          AuditAction.PATIENT_FILE_CREATED,
          file,
          {
            after: { status: 'ACTIVE' },
          },
        );
      });
    } catch (error) {
      await this.deleteObjectQuietly(permanentObjectKey);
      throw error;
    }
    await this.deleteObjectQuietly(input.objectKey);
    return this.loadResponseOrFail(context, fileId);
  }

  async update(
    context: AuthorizationContext,
    appointmentId: string,
    fileId: string,
    input: UpdatePatientFileDto,
  ): Promise<PatientFileResponse> {
    const fields = (['category', 'note', 'fileDate'] as const).filter(
      (field) => input[field] !== undefined,
    );
    if (fields.length === 0) {
      throw new RequestFieldValidationException(
        'body',
        'At least one metadata field must be provided.',
      );
    }
    if (input.fileDate) {
      this.assertFileDate(input.fileDate, context.branch!.timezone);
    }

    await this.dataSource.transaction(async (manager) => {
      const { appointment } = await this.resolveAccessForUpdate(
        manager,
        context,
        appointmentId,
      );
      const file = await this.findFileForUpdate(
        manager,
        context,
        appointment.patientId,
        fileId,
      );
      const nextNote =
        input.note === undefined ? file.note : this.normalizeNote(input.note);
      const changedFields = fields.filter((field) => {
        if (field === 'note') return file.note !== nextNote;
        return file[field] !== input[field];
      });
      if (changedFields.length === 0) return;
      if (input.category !== undefined) file.category = input.category;
      if (input.fileDate !== undefined) file.fileDate = input.fileDate;
      if (input.note !== undefined) file.note = nextNote;
      file.updatedByUserId = context.actor.userId;
      await manager.save(file);
      await this.recordAudit(
        manager,
        context,
        AuditAction.PATIENT_FILE_METADATA_UPDATED,
        file,
        { after: { status: 'ACTIVE', changedFields } },
      );
    });
    return this.loadResponseOrFail(context, fileId);
  }

  async archive(
    context: AuthorizationContext,
    appointmentId: string,
    fileId: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const { appointment } = await this.resolveAccessForUpdate(
        manager,
        context,
        appointmentId,
      );
      const file = await this.findFileForUpdate(
        manager,
        context,
        appointment.patientId,
        fileId,
      );
      file.archivedAt = new Date();
      file.archivedByUserId = context.actor.userId;
      file.updatedByUserId = context.actor.userId;
      await manager.save(file);
      await this.recordAudit(
        manager,
        context,
        AuditAction.PATIENT_FILE_ARCHIVED,
        file,
        { before: { status: 'ACTIVE' }, after: { status: 'ARCHIVED' } },
      );
    });
    return { id: fileId, archived: true };
  }

  async access(
    context: AuthorizationContext,
    appointmentId: string,
    fileId: string,
    query: PatientFileAccessQueryDto,
  ) {
    const { appointment } = await this.resolveAccess(
      context,
      appointmentId,
      false,
    );
    const file = await this.filesRepository.findOne({
      where: {
        id: fileId,
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
        patientId: appointment.patientId,
        archivedAt: IsNull(),
      },
    });
    if (!file) throw new NotFoundException('Patient file was not found.');
    const disposition = query.disposition ?? PatientFileDisposition.INLINE;
    try {
      const url = await this.objectStorage.createPresignedGet(file.objectKey, {
        responseContentType: file.contentType,
        responseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalFileName)}`,
      });
      return {
        url,
        expiresAt: new Date(
          Date.now() + this.config.s3Config.presignedPostTtlMs,
        ).toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException(
        'Patient file access is temporarily unavailable.',
      );
    }
  }

  private applyFilters(
    queryBuilder: ReturnType<Repository<PatientFile>['createQueryBuilder']>,
    query: ListPatientFilesQueryDto,
    includeCategory: boolean,
  ): void {
    const search = query.q?.trim();
    if (search) {
      queryBuilder.andWhere(
        new Brackets((where) => {
          where
            .where('file.originalFileName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('file.note ILIKE :search', { search: `%${search}%` });
        }),
      );
    }
    if (includeCategory && query.category) {
      queryBuilder.andWhere('file.category = :category', {
        category: query.category,
      });
    }
    if (query.dateFrom) {
      queryBuilder.andWhere('file.fileDate >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    }
    if (query.dateTo) {
      queryBuilder.andWhere('file.fileDate <= :dateTo', {
        dateTo: query.dateTo,
      });
    }
  }

  private async resolveAccess(
    context: AuthorizationContext,
    appointmentId: string,
    requireWritable: boolean,
  ): Promise<AccessContext> {
    const appointment =
      await this.appointmentsRepository.findByTenantBranchAndId(
        context.tenant!.id,
        context.branch!.id,
        appointmentId,
      );
    if (!appointment) throw new NotFoundException('Appointment was not found.');
    this.assertCaseOwner(context, appointment);
    const visit = await this.visitsRepository.findOne({
      where: {
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
        appointmentId,
      },
    });
    if (!visit) throw new NotFoundException('Visit was not found.');
    if (requireWritable) this.assertWritable(appointment, visit);
    else if (
      ![AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED].includes(
        appointment.status,
      )
    ) {
      throw new ConflictException(
        'Patient files are available after the Visit starts.',
      );
    }
    return { appointment, visit };
  }

  private async resolveAccessForUpdate(
    manager: EntityManager,
    context: AuthorizationContext,
    appointmentId: string,
  ): Promise<AccessContext> {
    const appointment = await manager.getRepository(Appointment).findOne({
      where: {
        id: appointmentId,
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!appointment) throw new NotFoundException('Appointment was not found.');
    this.assertCaseOwner(context, appointment);
    const visit = await manager.getRepository(Visit).findOne({
      where: {
        appointmentId,
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!visit) throw new NotFoundException('Visit was not found.');
    this.assertWritable(appointment, visit);
    return { appointment, visit };
  }

  private assertCaseOwner(
    context: AuthorizationContext,
    appointment: Appointment,
  ): void {
    if (appointment.assignedDentistUserId !== context.actor.userId) {
      throw new ForbiddenException(
        'Only the assigned Dentist may access Patient files.',
      );
    }
  }

  private assertWritable(appointment: Appointment, visit: Visit): void {
    if (
      appointment.status !== AppointmentStatus.IN_PROGRESS ||
      visit.status !== VisitStatus.OPEN
    ) {
      throw new ConflictException(
        'Patient files are read-only after Visit completion.',
      );
    }
  }

  private async findFileForUpdate(
    manager: EntityManager,
    context: AuthorizationContext,
    patientId: string,
    fileId: string,
  ): Promise<PatientFile> {
    const file = await manager.getRepository(PatientFile).findOne({
      where: {
        id: fileId,
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
        patientId,
        archivedAt: IsNull(),
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!file) throw new NotFoundException('Patient file was not found.');
    return file;
  }

  private assertFileDate(fileDate: string, timeZone: string): void {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    const today = `${get('year')}-${get('month')}-${get('day')}`;
    if (fileDate > today) {
      throw new RequestFieldValidationException(
        'fileDate',
        'Patient file date must not be in the future.',
      );
    }
  }

  private normalizeOriginalFileName(input: string): string {
    const normalized = input.trim();
    const basename = normalized.replace(/\\/g, '/').split('/').at(-1) ?? '';
    const hasControlCharacter = Array.from(normalized).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
    if (!normalized || basename !== normalized || hasControlCharacter) {
      throw new RequestFieldValidationException(
        'originalFileName',
        'Original file name is invalid.',
      );
    }
    return normalized;
  }

  private normalizeNote(note: string | null | undefined): string | null {
    const normalized = note?.trim() ?? '';
    return normalized || null;
  }

  private tempFileExtension(
    context: AuthorizationContext,
    objectKey: string,
  ): string {
    const prefix = `temp/${context.tenant!.id}/${context.branch!.id}/patient-files/${context.actor.userId}/`;
    if (!objectKey.startsWith(prefix)) {
      throw new RequestFieldValidationException(
        'objectKey',
        'Patient file upload key is invalid.',
      );
    }
    const filename = objectKey.slice(prefix.length);
    const match = /^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i.exec(filename);
    if (!match) {
      throw new RequestFieldValidationException(
        'objectKey',
        'Patient file upload key is invalid.',
      );
    }
    return match[1].toLowerCase();
  }

  private async readAndValidateTempObject(
    objectKey: string,
    extension: string,
  ): Promise<StoredObjectMetadata> {
    let metadata: StoredObjectMetadata;
    try {
      metadata = await this.objectStorage.headObject(objectKey);
    } catch (error) {
      if (error instanceof ObjectStorageUnavailableError) {
        throw new ServiceUnavailableException(
          'Patient file uploads are not configured for this environment.',
        );
      }
      throw new RequestFieldValidationException(
        'objectKey',
        'Patient file upload was not found.',
      );
    }
    const contentType = metadata.contentType as
      PatientFileContentType | undefined;
    if (
      !contentType ||
      !PATIENT_FILE_CONTENT_TYPES.includes(contentType) ||
      PATIENT_FILE_EXTENSION_BY_CONTENT_TYPE[contentType] !== extension ||
      !metadata.sizeBytes ||
      metadata.sizeBytes < 1 ||
      metadata.sizeBytes > PATIENT_FILE_MAX_BYTES
    ) {
      throw new RequestFieldValidationException(
        'objectKey',
        'Patient file upload is invalid.',
      );
    }
    return metadata;
  }

  private async copyObject(sourceKey: string, destinationKey: string) {
    try {
      await this.objectStorage.copyObject({ sourceKey, destinationKey });
    } catch {
      throw new ServiceUnavailableException(
        'Patient file could not be stored.',
      );
    }
  }

  private async deleteObjectQuietly(objectKey: string): Promise<void> {
    try {
      await this.objectStorage.deleteObject(objectKey);
    } catch {
      // Temp lifecycle and operational cleanup handle best-effort failures.
    }
  }

  private async loadResponseOrFail(
    context: AuthorizationContext,
    fileId: string,
  ): Promise<PatientFileResponse> {
    const file = await this.filesRepository.findOne({
      where: {
        id: fileId,
        tenantId: context.tenant!.id,
        branchId: context.branch!.id,
        archivedAt: IsNull(),
      },
      relations: { createdBy: true },
    });
    if (!file) throw new NotFoundException('Patient file was not found.');
    return this.toResponse(file);
  }

  private async toResponse(file: PatientFile): Promise<PatientFileResponse> {
    let previewUrl: string | null = null;
    try {
      previewUrl = await this.objectStorage.createPresignedGet(file.objectKey, {
        responseContentType: file.contentType,
        responseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(file.originalFileName)}`,
      });
    } catch {
      previewUrl = null;
    }
    return {
      id: file.id,
      sourceVisitId: file.sourceVisitId,
      originalFileName: file.originalFileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      category: file.category,
      note: file.note,
      fileDate: file.fileDate,
      previewUrl,
      createdBy: {
        id: file.createdBy.id,
        fullName: file.createdBy.fullName,
      },
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  private recordAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    action:
      | typeof AuditAction.PATIENT_FILE_CREATED
      | typeof AuditAction.PATIENT_FILE_METADATA_UPDATED
      | typeof AuditAction.PATIENT_FILE_ARCHIVED,
    file: PatientFile,
    payload: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    },
  ) {
    return this.auditLogService.record(manager, {
      action,
      actor: {
        type: AuditActorType.USER,
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
      },
      tenantId: file.tenantId,
      branchId: file.branchId,
      resourceId: file.id,
      ...payload,
    });
  }
}
