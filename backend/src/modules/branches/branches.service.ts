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
import { BranchesRepository } from './branches.repository';
import { CreateBranchDto } from './dto/create-branch.dto';
import {
  BranchSortBy,
  ListBranchesQueryDto,
} from './dto/list-branches-query.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Branch, BranchStatus } from './entities/branch.entity';

const BRANCH_EDITABLE_FIELDS = [
  'name',
  'address',
  'phone',
  'timezone',
] as const;

type BranchEditableField = (typeof BRANCH_EDITABLE_FIELDS)[number];

const BRANCH_SORT_FIELDS: Readonly<Record<BranchSortBy, string>> = {
  [BranchSortBy.NAME]: 'branch.name',
  [BranchSortBy.STATUS]: 'branch.status',
  [BranchSortBy.CREATED_AT]: 'branch.created_at',
};

export interface BranchResponse {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  timezone: string | null;
  status: BranchStatus;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly branchesRepository: BranchesRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(
    context: AuthorizationContext,
    query: ListBranchesQueryDto,
  ): Promise<{
    items: BranchResponse[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const queryBuilder = this.branchesRepository.ormRepository
      .createQueryBuilder('branch')
      .where('branch.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      });

    if (query.status) {
      queryBuilder.andWhere('branch.status = :status', {
        status: query.status,
      });
    }
    applyIlikeSearch(queryBuilder, query.search, [
      'branch.name',
      'branch.slug',
      'branch.address',
      'branch.phone',
    ]);
    applySafeSort(queryBuilder, {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      fields: BRANCH_SORT_FIELDS,
      defaultField: BRANCH_SORT_FIELDS[BranchSortBy.NAME],
      defaultOrder: SortOrder.ASC,
      tieBreaker: 'branch.id',
    });
    applyOffsetPagination(queryBuilder, { page, limit });

    const [branches, total] = await queryBuilder.getManyAndCount();
    return {
      items: branches.map((branch) => this.toResponse(branch)),
      meta: toPageMeta({ page, limit }, total),
    };
  }

  async create(
    context: AuthorizationContext,
    input: CreateBranchDto,
  ): Promise<BranchResponse> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const branch = manager.create(Branch, {
          tenantId: context.tenant!.id,
          slug: input.slug,
          name: input.name,
          address: input.address,
          phone: input.phone,
          timezone: input.timezone ?? null,
          status: BranchStatus.ACTIVE,
        });
        const savedBranch = await manager.save(branch);
        await this.auditLogService.record(manager, {
          action: AuditAction.BRANCH_CREATED,
          actor: {
            type: AuditActorType.USER,
            userId: context.actor.userId,
            sessionId: context.actor.sessionId,
          },
          tenantId: savedBranch.tenantId,
          branchId: savedBranch.id,
          resourceId: savedBranch.id,
          after: this.toAuditSnapshot(savedBranch, [
            'slug',
            'name',
            'address',
            'phone',
            'timezone',
            'status',
          ]),
        });
        return this.toResponse(savedBranch);
      });
    } catch (error) {
      this.throwIfSlugAlreadyExists(error);
      throw error;
    }
  }

  async update(
    context: AuthorizationContext,
    branchSlug: string,
    input: UpdateBranchDto,
  ): Promise<BranchResponse> {
    return this.dataSource.transaction(async (manager) => {
      const branch = await this.findBySlugOrFail(
        manager,
        context.tenant!.id,
        branchSlug,
      );
      const requestedValues = this.toRequestedValues(input);
      const changedFields = BRANCH_EDITABLE_FIELDS.filter(
        (field) =>
          requestedValues[field] !== undefined &&
          branch[field] !== requestedValues[field],
      );
      if (changedFields.length === 0) {
        return this.toResponse(branch);
      }

      const before = this.toAuditSnapshot(branch, changedFields);
      changedFields.forEach((field) => {
        branch[field] = requestedValues[field] as never;
      });
      const savedBranch = await manager.save(branch);
      await this.auditLogService.record(manager, {
        action: AuditAction.BRANCH_UPDATED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: savedBranch.tenantId,
        branchId: savedBranch.id,
        resourceId: savedBranch.id,
        before,
        after: this.toAuditSnapshot(savedBranch, changedFields),
      });
      return this.toResponse(savedBranch);
    });
  }

  async deactivate(
    context: AuthorizationContext,
    branchSlug: string,
    reason: string,
  ): Promise<BranchResponse> {
    return this.dataSource.transaction(async (manager) => {
      const branch = await this.findBySlugOrFail(
        manager,
        context.tenant!.id,
        branchSlug,
      );
      if (branch.status === BranchStatus.INACTIVE) {
        return this.toResponse(branch);
      }

      const before = this.toAuditSnapshot(branch, ['status']);
      branch.status = BranchStatus.INACTIVE;
      const savedBranch = await manager.save(branch);
      await this.auditLogService.record(manager, {
        action: AuditAction.BRANCH_DEACTIVATED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: savedBranch.tenantId,
        branchId: savedBranch.id,
        resourceId: savedBranch.id,
        reason,
        before,
        after: this.toAuditSnapshot(savedBranch, ['status']),
      });
      return this.toResponse(savedBranch);
    });
  }

  async activate(
    context: AuthorizationContext,
    branchSlug: string,
    reason: string,
  ): Promise<BranchResponse> {
    return this.dataSource.transaction(async (manager) => {
      const branch = await this.findBySlugOrFail(
        manager,
        context.tenant!.id,
        branchSlug,
      );
      if (branch.status === BranchStatus.ACTIVE) {
        return this.toResponse(branch);
      }

      const before = this.toAuditSnapshot(branch, ['status']);
      branch.status = BranchStatus.ACTIVE;
      const savedBranch = await manager.save(branch);
      await this.auditLogService.record(manager, {
        action: AuditAction.BRANCH_ACTIVATED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        tenantId: savedBranch.tenantId,
        branchId: savedBranch.id,
        resourceId: savedBranch.id,
        reason,
        before,
        after: this.toAuditSnapshot(savedBranch, ['status']),
      });
      return this.toResponse(savedBranch);
    });
  }

  private async findBySlugOrFail(
    manager: EntityManager,
    tenantId: string,
    slug: string,
  ): Promise<Branch> {
    const branch = await this.branchesRepository.findByTenantAndSlugForUpdate(
      manager,
      tenantId,
      slug,
    );
    if (!branch) {
      throw new NotFoundException('Branch was not found.');
    }
    return branch;
  }

  private toRequestedValues(
    input: UpdateBranchDto,
  ): Record<BranchEditableField, string | null | undefined> {
    return {
      name: input.name,
      address: input.address,
      phone: input.phone,
      timezone: input.timezone,
    };
  }

  private toAuditSnapshot(
    branch: Branch,
    changedFields: readonly string[],
  ): { status: BranchStatus; changedFields: readonly string[] } {
    return { status: branch.status, changedFields };
  }

  private toResponse(branch: Branch): BranchResponse {
    return {
      id: branch.id,
      slug: branch.slug,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      timezone: branch.timezone,
      status: branch.status,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }

  private throwIfSlugAlreadyExists(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { constraint?: string } | undefined)?.constraint ===
        'uq_branches_tenant_id_slug'
    ) {
      throw new ConflictException(
        'A branch with this slug already exists in the tenant.',
      );
    }
  }
}
