import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import {
  applyIlikeSearch,
  applyOffsetPagination,
  applySafeSort,
  toPageMeta,
} from '../../common/database/query-builder-list.util';
import { RequestFieldValidationException } from '../../common/exceptions/request-field-validation.exception';
import { SortOrder } from '../../common/dto/page-list-query.dto';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { CreateServiceDto } from './dto/create-service.dto';
import {
  ListServicesQueryDto,
  ServiceSortBy,
} from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from './entities/service.entity';
import { ServicesRepository } from './services.repository';

const SERVICE_EDITABLE_FIELDS = [
  'name',
  'groupName',
  'amount',
  'currency',
  'durationMinutes',
] as const;
const SERVICE_CREATED_FIELDS = [
  'code',
  ...SERVICE_EDITABLE_FIELDS,
  'isActive',
] as const;

type ServiceEditableField = (typeof SERVICE_EDITABLE_FIELDS)[number];
type ServiceRequestedValues = Record<
  ServiceEditableField,
  string | number | undefined
>;

const SERVICE_SORT_FIELDS: Readonly<Record<ServiceSortBy, string>> = {
  [ServiceSortBy.CODE]: 'service.code',
  [ServiceSortBy.NAME]: 'service.name',
  [ServiceSortBy.GROUP_NAME]: 'service.group_name',
  [ServiceSortBy.AMOUNT]: 'service.amount',
  [ServiceSortBy.DURATION_MINUTES]: 'service.duration_minutes',
  [ServiceSortBy.CREATED_AT]: 'service.created_at',
};

export interface ServiceResponse {
  id: string;
  code: string;
  name: string;
  groupName: string;
  amount: number;
  currency: string;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ServicesService {
  constructor(
    private readonly servicesRepository: ServicesRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(
    context: AuthorizationContext,
    query: ListServicesQueryDto,
  ): Promise<{
    items: ServiceResponse[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const queryBuilder = this.servicesRepository.ormRepository
      .createQueryBuilder('service')
      .where('service.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      });

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('service.isActive = :isActive', {
        isActive: query.isActive,
      });
    }
    applyIlikeSearch(queryBuilder, query.search, [
      'service.code',
      'service.name',
      'service.group_name',
    ]);
    applySafeSort(queryBuilder, {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      fields: SERVICE_SORT_FIELDS,
      defaultField: SERVICE_SORT_FIELDS[ServiceSortBy.NAME],
      defaultOrder: SortOrder.ASC,
      tieBreaker: 'service.id',
    });
    applyOffsetPagination(queryBuilder, { page, limit });

    const [services, total] = await queryBuilder.getManyAndCount();
    return {
      items: services.map((service) => this.toResponse(service)),
      meta: toPageMeta({ page, limit }, total),
    };
  }

  async get(
    context: AuthorizationContext,
    serviceId: string,
  ): Promise<ServiceResponse> {
    const service = await this.servicesRepository.findByTenantAndId(
      context.tenant!.id,
      serviceId,
    );
    if (!service) {
      throw new NotFoundException('Service was not found.');
    }

    return this.toResponse(service);
  }

  async create(
    context: AuthorizationContext,
    input: CreateServiceDto,
  ): Promise<ServiceResponse> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const service = manager.create(Service, {
          tenantId: context.tenant!.id,
          code: input.code,
          name: input.name,
          groupName: input.groupName,
          amount: input.amount,
          currency: input.currency,
          durationMinutes: input.durationMinutes,
          isActive: true,
        });
        const savedService = await manager.save(service);
        await this.recordAudit(manager, context, AuditAction.SERVICE_CREATED, {
          service: savedService,
          after: this.toAuditSnapshot(savedService, SERVICE_CREATED_FIELDS),
        });

        return this.toResponse(savedService);
      });
    } catch (error) {
      this.throwIfCodeAlreadyExists(error);
      throw error;
    }
  }

  async update(
    context: AuthorizationContext,
    serviceId: string,
    input: UpdateServiceDto,
  ): Promise<ServiceResponse> {
    return this.dataSource.transaction(async (manager) => {
      const service = await this.findByTenantAndIdOrFail(
        manager,
        context.tenant!.id,
        serviceId,
      );
      const requestedValues = this.toRequestedValues(input);
      const changedFields = SERVICE_EDITABLE_FIELDS.filter(
        (field) =>
          requestedValues[field] !== undefined &&
          service[field] !== requestedValues[field],
      );
      if (changedFields.length === 0) {
        return this.toResponse(service);
      }

      const priceChanged =
        changedFields.includes('amount') || changedFields.includes('currency');
      if (priceChanged && !input.reason) {
        throw new RequestFieldValidationException(
          'reason',
          'reason is required when amount or currency changes.',
        );
      }

      const before = this.toAuditSnapshot(service, changedFields);
      changedFields.forEach((field) => {
        (service as unknown as Record<string, string | number>)[field] =
          requestedValues[field] as string | number;
      });
      const savedService = await manager.save(service);
      await this.recordAudit(manager, context, AuditAction.SERVICE_UPDATED, {
        service: savedService,
        ...(priceChanged ? { reason: input.reason } : {}),
        before,
        after: this.toAuditSnapshot(savedService, changedFields),
      });

      return this.toResponse(savedService);
    });
  }

  deactivate(
    context: AuthorizationContext,
    serviceId: string,
    reason: string,
  ): Promise<ServiceResponse> {
    return this.changeActivity(
      context,
      serviceId,
      false,
      reason,
      AuditAction.SERVICE_DEACTIVATED,
    );
  }

  activate(
    context: AuthorizationContext,
    serviceId: string,
    reason: string,
  ): Promise<ServiceResponse> {
    return this.changeActivity(
      context,
      serviceId,
      true,
      reason,
      AuditAction.SERVICE_ACTIVATED,
    );
  }

  private async changeActivity(
    context: AuthorizationContext,
    serviceId: string,
    isActive: boolean,
    reason: string,
    action: AuditAction,
  ): Promise<ServiceResponse> {
    return this.dataSource.transaction(async (manager) => {
      const service = await this.findByTenantAndIdOrFail(
        manager,
        context.tenant!.id,
        serviceId,
      );
      if (service.isActive === isActive) {
        return this.toResponse(service);
      }

      const before = this.toAuditSnapshot(service, ['isActive']);
      service.isActive = isActive;
      const savedService = await manager.save(service);
      await this.recordAudit(manager, context, action, {
        service: savedService,
        reason,
        before,
        after: this.toAuditSnapshot(savedService, ['isActive']),
      });

      return this.toResponse(savedService);
    });
  }

  private async findByTenantAndIdOrFail(
    manager: EntityManager,
    tenantId: string,
    serviceId: string,
  ): Promise<Service> {
    const service = await this.servicesRepository.findByTenantAndIdForUpdate(
      manager,
      tenantId,
      serviceId,
    );
    if (!service) {
      throw new NotFoundException('Service was not found.');
    }
    return service;
  }

  private toRequestedValues(input: UpdateServiceDto): ServiceRequestedValues {
    return {
      name: input.name,
      groupName: input.groupName,
      amount: input.amount,
      currency: input.currency,
      durationMinutes: input.durationMinutes,
    };
  }

  private toAuditSnapshot(
    service: Service,
    changedFields: readonly string[],
  ): {
    changedFields: readonly string[];
    isActive: boolean;
    amount: number;
    currency: string;
    durationMinutes: number;
  } {
    return {
      changedFields: [...changedFields],
      isActive: service.isActive,
      amount: service.amount,
      currency: service.currency,
      durationMinutes: service.durationMinutes,
    };
  }

  private async recordAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    action: AuditAction,
    input: {
      service: Service;
      reason?: string;
      before?: ReturnType<ServicesService['toAuditSnapshot']>;
      after?: ReturnType<ServicesService['toAuditSnapshot']>;
    },
  ): Promise<void> {
    await this.auditLogService.record(manager, {
      action,
      actor: {
        type: AuditActorType.USER,
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
      },
      tenantId: input.service.tenantId,
      resourceId: input.service.id,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.before ? { before: input.before } : {}),
      ...(input.after ? { after: input.after } : {}),
    });
  }

  private toResponse(service: Service): ServiceResponse {
    return {
      id: service.id,
      code: service.code,
      name: service.name,
      groupName: service.groupName,
      amount: service.amount,
      currency: service.currency,
      durationMinutes: service.durationMinutes,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private throwIfCodeAlreadyExists(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { constraint?: string } | undefined)?.constraint ===
        'uq_services_tenant_id_code'
    ) {
      throw new ConflictException(
        'A service with this code already exists in the tenant.',
      );
    }
  }
}
