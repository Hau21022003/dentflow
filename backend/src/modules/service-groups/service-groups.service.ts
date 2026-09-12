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
import { SortOrder } from '../../common/dto/page-list-query.dto';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { CreateServiceGroupDto } from './dto/create-service-group.dto';
import {
  ListServiceGroupsQueryDto,
  ServiceGroupSortBy,
} from './dto/list-service-groups-query.dto';
import { UpdateServiceGroupDto } from './dto/update-service-group.dto';
import { ServiceGroup } from './entities/service-group.entity';
import { ServiceGroupsRepository } from './service-groups.repository';

const SERVICE_GROUP_SORT_FIELDS: Readonly<Record<ServiceGroupSortBy, string>> =
  {
    [ServiceGroupSortBy.NAME]: 'serviceGroup.name',
    [ServiceGroupSortBy.CREATED_AT]: 'serviceGroup.created_at',
  };
const SERVICE_GROUP_CHANGED_FIELDS = ['name'] as const;

export interface ServiceGroupResponse {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ServiceGroupsService {
  constructor(
    private readonly serviceGroupsRepository: ServiceGroupsRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(
    context: AuthorizationContext,
    query: ListServiceGroupsQueryDto,
  ): Promise<{
    items: ServiceGroupResponse[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const queryBuilder = this.serviceGroupsRepository.ormRepository
      .createQueryBuilder('serviceGroup')
      .where('serviceGroup.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      });

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('serviceGroup.isActive = :isActive', {
        isActive: query.isActive,
      });
    }
    applyIlikeSearch(queryBuilder, query.search, ['serviceGroup.name']);
    applySafeSort(queryBuilder, {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      fields: SERVICE_GROUP_SORT_FIELDS,
      defaultField: SERVICE_GROUP_SORT_FIELDS[ServiceGroupSortBy.NAME],
      defaultOrder: SortOrder.ASC,
      tieBreaker: 'serviceGroup.id',
    });
    applyOffsetPagination(queryBuilder, { page, limit });

    const [serviceGroups, total] = await queryBuilder.getManyAndCount();
    return {
      items: serviceGroups.map((serviceGroup) => this.toResponse(serviceGroup)),
      meta: toPageMeta({ page, limit }, total),
    };
  }

  async get(
    context: AuthorizationContext,
    serviceGroupId: string,
  ): Promise<ServiceGroupResponse> {
    const serviceGroup = await this.serviceGroupsRepository.findByTenantAndId(
      context.tenant!.id,
      serviceGroupId,
    );
    if (!serviceGroup) {
      throw new NotFoundException('Service group was not found.');
    }
    return this.toResponse(serviceGroup);
  }

  async create(
    context: AuthorizationContext,
    input: CreateServiceGroupDto,
  ): Promise<ServiceGroupResponse> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const serviceGroup = manager.create(ServiceGroup, {
          tenantId: context.tenant!.id,
          name: input.name,
          isActive: true,
        });
        const savedServiceGroup = await manager.save(serviceGroup);
        await this.recordAudit(
          manager,
          context,
          AuditAction.SERVICE_GROUP_CREATED,
          savedServiceGroup,
          {
            after: this.toAuditSnapshot(
              savedServiceGroup,
              SERVICE_GROUP_CHANGED_FIELDS,
            ),
          },
        );
        return this.toResponse(savedServiceGroup);
      });
    } catch (error) {
      this.throwIfNameAlreadyExists(error);
      throw error;
    }
  }

  async update(
    context: AuthorizationContext,
    serviceGroupId: string,
    input: UpdateServiceGroupDto,
  ): Promise<ServiceGroupResponse> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const serviceGroup = await this.findByTenantAndIdOrFail(
          manager,
          context.tenant!.id,
          serviceGroupId,
        );
        if (input.name === undefined || input.name === serviceGroup.name) {
          return this.toResponse(serviceGroup);
        }

        const before = this.toAuditSnapshot(
          serviceGroup,
          SERVICE_GROUP_CHANGED_FIELDS,
        );
        serviceGroup.name = input.name;
        const savedServiceGroup = await manager.save(serviceGroup);
        await this.recordAudit(
          manager,
          context,
          AuditAction.SERVICE_GROUP_UPDATED,
          savedServiceGroup,
          {
            before,
            after: this.toAuditSnapshot(
              savedServiceGroup,
              SERVICE_GROUP_CHANGED_FIELDS,
            ),
          },
        );
        return this.toResponse(savedServiceGroup);
      });
    } catch (error) {
      this.throwIfNameAlreadyExists(error);
      throw error;
    }
  }

  deactivate(
    context: AuthorizationContext,
    serviceGroupId: string,
    reason: string,
  ): Promise<ServiceGroupResponse> {
    return this.changeActivity(
      context,
      serviceGroupId,
      false,
      reason,
      AuditAction.SERVICE_GROUP_DEACTIVATED,
    );
  }

  activate(
    context: AuthorizationContext,
    serviceGroupId: string,
    reason: string,
  ): Promise<ServiceGroupResponse> {
    return this.changeActivity(
      context,
      serviceGroupId,
      true,
      reason,
      AuditAction.SERVICE_GROUP_ACTIVATED,
    );
  }

  private async changeActivity(
    context: AuthorizationContext,
    serviceGroupId: string,
    isActive: boolean,
    reason: string,
    action: AuditAction,
  ): Promise<ServiceGroupResponse> {
    return this.dataSource.transaction(async (manager) => {
      const serviceGroup = await this.findByTenantAndIdOrFail(
        manager,
        context.tenant!.id,
        serviceGroupId,
      );
      if (serviceGroup.isActive === isActive) {
        return this.toResponse(serviceGroup);
      }

      const before = this.toAuditSnapshot(serviceGroup, ['isActive']);
      serviceGroup.isActive = isActive;
      const savedServiceGroup = await manager.save(serviceGroup);
      await this.recordAudit(manager, context, action, savedServiceGroup, {
        reason,
        before,
        after: this.toAuditSnapshot(savedServiceGroup, ['isActive']),
      });
      return this.toResponse(savedServiceGroup);
    });
  }

  private async findByTenantAndIdOrFail(
    manager: EntityManager,
    tenantId: string,
    serviceGroupId: string,
  ): Promise<ServiceGroup> {
    const serviceGroup =
      await this.serviceGroupsRepository.findByTenantAndIdForUpdate(
        manager,
        tenantId,
        serviceGroupId,
      );
    if (!serviceGroup) {
      throw new NotFoundException('Service group was not found.');
    }
    return serviceGroup;
  }

  private toAuditSnapshot(
    serviceGroup: ServiceGroup,
    changedFields: readonly string[],
  ): { changedFields: readonly string[]; isActive: boolean } {
    return {
      changedFields: [...changedFields],
      isActive: serviceGroup.isActive,
    };
  }

  private async recordAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    action: AuditAction,
    serviceGroup: ServiceGroup,
    input: {
      reason?: string;
      before?: ReturnType<ServiceGroupsService['toAuditSnapshot']>;
      after?: ReturnType<ServiceGroupsService['toAuditSnapshot']>;
    },
  ): Promise<void> {
    await this.auditLogService.record(manager, {
      action,
      actor: {
        type: AuditActorType.USER,
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
      },
      tenantId: serviceGroup.tenantId,
      resourceId: serviceGroup.id,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.before ? { before: input.before } : {}),
      ...(input.after ? { after: input.after } : {}),
    });
  }

  private toResponse(serviceGroup: ServiceGroup): ServiceGroupResponse {
    return {
      id: serviceGroup.id,
      name: serviceGroup.name,
      isActive: serviceGroup.isActive,
      createdAt: serviceGroup.createdAt,
      updatedAt: serviceGroup.updatedAt,
    };
  }

  private throwIfNameAlreadyExists(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { constraint?: string } | undefined)?.constraint ===
        'uq_service_groups_tenant_id_lower_name'
    ) {
      throw new ConflictException(
        'A service group with this name already exists in the tenant.',
      );
    }
  }
}
