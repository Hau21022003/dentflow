/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment */
import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { RequestFieldValidationException } from '../../common/exceptions/request-field-validation.exception';
import type { AppConfigService } from '../../config/app-config.service';
import type { ObjectStorage } from '../../infrastructure/storage';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AppointmentsRepository } from '../appointments/appointments.repository';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Visit, VisitStatus } from '../visits/entities/visit.entity';
import {
  PatientFile,
  PatientFileCategory,
} from './entities/patient-file.entity';
import { PatientFilesService } from './patient-files.service';

describe('PatientFilesService', () => {
  const appointment = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-id',
    branchId: 'branch-id',
    patientId: '22222222-2222-4222-8222-222222222222',
    assignedDentistUserId: 'dentist-id',
    status: AppointmentStatus.IN_PROGRESS,
  } as Appointment;
  const visit = {
    id: '33333333-3333-4333-8333-333333333333',
    tenantId: 'tenant-id',
    branchId: 'branch-id',
    appointmentId: appointment.id,
    status: VisitStatus.OPEN,
  } as Visit;
  const appointmentsRepository = {
    findByTenantBranchAndId: jest.fn(),
  } as unknown as AppointmentsRepository;
  const visitsRepository = {
    findOne: jest.fn(),
  } as unknown as Repository<Visit>;
  const filesRepository = {
    findOne: jest.fn(),
  } as unknown as Repository<PatientFile>;
  const storage: ObjectStorage = {
    createPresignedPost: jest.fn(),
    createPresignedGet: jest.fn(),
    headObject: jest.fn(),
    copyObject: jest.fn(),
    deleteObject: jest.fn(),
  };
  const appointmentTxRepository = { findOne: jest.fn() };
  const visitTxRepository = { findOne: jest.fn() };
  const fileTxRepository = { findOne: jest.fn() };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Appointment) return appointmentTxRepository;
      if (entity === Visit) return visitTxRepository;
      return fileTxRepository;
    }),
    create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn(async (value: unknown) => value),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(
      async (callback: (manager: EntityManager) => unknown) =>
        callback(manager),
    ),
  } as unknown as DataSource;
  const auditLogService = {
    record: jest.fn(),
  } as unknown as AuditLogService;
  const config = {
    s3Config: { presignedPostTtlMs: 300_000 },
  } as AppConfigService;
  const service = new PatientFilesService(
    appointmentsRepository,
    visitsRepository,
    filesRepository,
    dataSource,
    storage,
    auditLogService,
    config,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(appointmentsRepository.findByTenantBranchAndId)
      .mockResolvedValue(appointment);
    jest.mocked(visitsRepository.findOne).mockResolvedValue(visit);
    appointmentTxRepository.findOne.mockResolvedValue(appointment);
    visitTxRepository.findOne.mockResolvedValue(visit);
    jest.mocked(storage.headObject).mockResolvedValue({
      contentType: 'application/pdf',
      sizeBytes: 1024,
    });
    jest.mocked(storage.copyObject).mockResolvedValue();
    jest.mocked(storage.deleteObject).mockResolvedValue();
    jest
      .mocked(storage.createPresignedGet)
      .mockResolvedValue('https://storage.example.test/file');
    jest.mocked(filesRepository.findOne).mockResolvedValue(null);
    fileTxRepository.findOne.mockResolvedValue(null);
  });

  it('rejects a Dentist who is not assigned before touching storage', async () => {
    jest
      .mocked(appointmentsRepository.findByTenantBranchAndId)
      .mockResolvedValue({
        ...appointment,
        assignedDentistUserId: 'other-dentist',
      } as Appointment);

    await expect(
      service.create(context(), appointment.id, createInput()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it('keeps Patient files read-only after Visit completion', async () => {
    jest
      .mocked(appointmentsRepository.findByTenantBranchAndId)
      .mockResolvedValue({
        ...appointment,
        status: AppointmentStatus.COMPLETED,
      } as Appointment);
    jest.mocked(visitsRepository.findOne).mockResolvedValue({
      ...visit,
      status: VisitStatus.COMPLETED,
    } as Visit);

    await expect(
      service.create(context(), appointment.id, createInput()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it('copies an actor-owned temp PDF and never exposes its object key', async () => {
    jest.mocked(filesRepository.findOne).mockImplementation(async (options) => {
      const id = (options.where as { id: string }).id;
      return {
        id,
        tenantId: appointment.tenantId,
        branchId: appointment.branchId,
        patientId: appointment.patientId,
        sourceVisitId: visit.id,
        originalFileName: 'synthetic-consent.pdf',
        objectKey: `clinical/tenant-id/branch-id/${appointment.patientId}/patient-files/${id}.pdf`,
        contentType: 'application/pdf',
        sizeBytes: 1024,
        category: PatientFileCategory.FORM,
        note: null,
        fileDate: '2026-10-20',
        createdBy: { id: 'dentist-id', fullName: 'Synthetic Dentist' },
        createdAt: new Date('2026-10-20T03:00:00Z'),
        updatedAt: new Date('2026-10-20T03:00:00Z'),
      } as PatientFile;
    });

    const response = await service.create(
      context(),
      appointment.id,
      createInput(),
    );

    expect(storage.headObject).toHaveBeenCalledWith(createInput().objectKey);
    expect(storage.copyObject).toHaveBeenCalledWith({
      sourceKey: createInput().objectKey,
      destinationKey: expect.stringMatching(
        new RegExp(
          `^clinical/tenant-id/branch-id/${appointment.patientId}/patient-files/[0-9a-f-]{36}\\.pdf$`,
          'i',
        ),
      ),
    });
    expect(storage.deleteObject).toHaveBeenCalledWith(createInput().objectKey);
    expect(auditLogService.record).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        action: 'PATIENT_FILE_CREATED',
        after: { status: 'ACTIVE' },
      }),
    );
    expect(response).not.toHaveProperty('objectKey');
    expect(response.previewUrl).toBe('https://storage.example.test/file');
  });

  it('rejects a temp key owned by another actor before reading storage', async () => {
    await expect(
      service.create(context(), appointment.id, {
        ...createInput(),
        objectKey:
          'temp/tenant-id/branch-id/patient-files/other-user/44444444-4444-4444-8444-444444444444.pdf',
      }),
    ).rejects.toBeInstanceOf(RequestFieldValidationException);
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it('rejects a future file date before reading storage', async () => {
    await expect(
      service.create(context(), appointment.id, {
        ...createInput(),
        fileDate: '2999-01-01',
      }),
    ).rejects.toBeInstanceOf(RequestFieldValidationException);
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it('rejects storage metadata that does not match the temp extension', async () => {
    jest.mocked(storage.headObject).mockResolvedValue({
      contentType: 'image/png',
      sizeBytes: 1024,
    });

    await expect(
      service.create(context(), appointment.id, createInput()),
    ).rejects.toBeInstanceOf(RequestFieldValidationException);
    expect(storage.copyObject).not.toHaveBeenCalled();
  });

  it('cleans up the permanent object when the database transaction fails', async () => {
    jest
      .mocked(dataSource.transaction)
      .mockRejectedValueOnce(new Error('synthetic transaction failure'));

    await expect(
      service.create(context(), appointment.id, createInput()),
    ).rejects.toThrow('synthetic transaction failure');
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledWith(
      expect.stringMatching(/\/patient-files\/[0-9a-f-]{36}\.pdf$/i),
    );
  });

  it('allows access to an active file after Visit completion', async () => {
    jest
      .mocked(appointmentsRepository.findByTenantBranchAndId)
      .mockResolvedValue({
        ...appointment,
        status: AppointmentStatus.COMPLETED,
      } as Appointment);
    jest.mocked(visitsRepository.findOne).mockResolvedValue({
      ...visit,
      status: VisitStatus.COMPLETED,
    } as Visit);
    jest.mocked(filesRepository.findOne).mockResolvedValue(storedFile());

    await expect(
      service.access(context(), appointment.id, storedFile().id, {
        disposition: 'attachment' as never,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        url: 'https://storage.example.test/file',
      }),
    );
  });

  it('returns service unavailable when a signed access URL cannot be created', async () => {
    jest.mocked(filesRepository.findOne).mockResolvedValue(storedFile());
    jest
      .mocked(storage.createPresignedGet)
      .mockRejectedValueOnce(new Error('synthetic signing failure'));

    await expect(
      service.access(context(), appointment.id, storedFile().id, {}),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('archives metadata without deleting the stored object', async () => {
    fileTxRepository.findOne.mockResolvedValue(storedFile());

    await expect(
      service.archive(context(), appointment.id, storedFile().id),
    ).resolves.toEqual({ id: storedFile().id, archived: true });
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        action: 'PATIENT_FILE_ARCHIVED',
        before: { status: 'ACTIVE' },
        after: { status: 'ARCHIVED' },
      }),
    );
  });
});

function createInput() {
  return {
    objectKey:
      'temp/tenant-id/branch-id/patient-files/dentist-id/44444444-4444-4444-8444-444444444444.pdf',
    originalFileName: 'synthetic-consent.pdf',
    category: PatientFileCategory.FORM,
    note: null,
    fileDate: '2026-10-20',
  };
}

function storedFile(): PatientFile {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    tenantId: 'tenant-id',
    branchId: 'branch-id',
    patientId: '22222222-2222-4222-8222-222222222222',
    sourceVisitId: '33333333-3333-4333-8333-333333333333',
    originalFileName: 'synthetic-consent.pdf',
    objectKey:
      'clinical/tenant-id/branch-id/22222222-2222-4222-8222-222222222222/patient-files/55555555-5555-4555-8555-555555555555.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    category: PatientFileCategory.FORM,
    note: null,
    fileDate: '2026-10-20',
    archivedAt: null,
    archivedByUserId: null,
    createdByUserId: 'dentist-id',
    updatedByUserId: 'dentist-id',
    createdAt: new Date('2026-10-20T03:00:00Z'),
    updatedAt: new Date('2026-10-20T03:00:00Z'),
  } as PatientFile;
}

function context(): AuthorizationContext {
  return {
    actor: { userId: 'dentist-id', sessionId: 'session-id' },
    scope: 'branch',
    tenant: { id: 'tenant-id', slug: 'synthetic', status: 'ACTIVE' as never },
    branch: {
      id: 'branch-id',
      slug: 'central',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'ACTIVE' as never,
    },
  };
}
