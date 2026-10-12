import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
import {
  applyIlikeSearch,
  applyOffsetPagination,
  applySafeSort,
  toPageMeta,
} from '../../common/database/query-builder-list.util';
import { SortOrder } from '../../common/dto/page-list-query.dto';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import {
  CreateOperatoryDto,
  ListOperatoriesQueryDto,
  OperatorySortBy,
  UpdateOperatoryDto,
} from './dto/operatory.dto';
import { Operatory } from './entities/operatory.entity';

const SORT_FIELDS = {
  [OperatorySortBy.CODE]: 'operatory.code',
  [OperatorySortBy.NAME]: 'operatory.name',
  [OperatorySortBy.TYPE]: 'operatory.type',
  [OperatorySortBy.IS_ACTIVE]: 'operatory.is_active',
  [OperatorySortBy.CREATED_AT]: 'operatory.created_at',
} as const;
const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatus.BOOKED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

@Injectable()
export class OperatoriesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditLogService,
  ) {}

  async list(context: AuthorizationContext, query: ListOperatoriesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const qb = this.dataSource
      .getRepository(Operatory)
      .createQueryBuilder('operatory')
      .where('operatory.tenantId = :tenantId', { tenantId: context.tenant!.id })
      .andWhere('operatory.branchId = :branchId', {
        branchId: context.branch!.id,
      });
    if (query.isActive !== undefined) {
      qb.andWhere('operatory.isActive = :isActive', {
        isActive: query.isActive,
      });
    }
    applyIlikeSearch(qb, query.search, ['operatory.code', 'operatory.name']);
    applySafeSort(qb, {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      fields: SORT_FIELDS,
      defaultField: SORT_FIELDS[OperatorySortBy.NAME],
      defaultOrder: SortOrder.ASC,
      tieBreaker: 'operatory.id',
    });
    applyOffsetPagination(qb, { page, limit });
    const [items, total] = await qb.getManyAndCount();
    return { items, meta: toPageMeta({ page, limit }, total) };
  }

  async get(context: AuthorizationContext, id: string) {
    return this.findOrFail(this.dataSource.manager, context, id);
  }

  async create(context: AuthorizationContext, input: CreateOperatoryDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const operatory = await manager.save(
          manager.create(Operatory, {
            tenantId: context.tenant!.id,
            branchId: context.branch!.id,
            code: input.code,
            name: input.name,
            type: input.type,
            isActive: true,
          }),
        );
        await this.recordAudit(
          manager,
          context,
          AuditAction.OPERATORY_CREATED,
          operatory,
          {
            code: operatory.code,
            type: operatory.type,
            isActive: true,
            changedFields: ['code', 'name', 'type', 'isActive'],
          },
        );
        return operatory;
      });
    } catch (error) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  async update(
    context: AuthorizationContext,
    id: string,
    input: UpdateOperatoryDto,
  ) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const operatory = await this.findOrFail(manager, context, id, true);
        if (operatory.name === input.name && operatory.type === input.type) {
          return operatory;
        }
        const changedFields = [
          ...(operatory.name === input.name ? [] : ['name']),
          ...(operatory.type === input.type ? [] : ['type']),
        ];
        operatory.name = input.name;
        operatory.type = input.type;
        await manager.save(operatory);
        await this.recordAudit(
          manager,
          context,
          AuditAction.OPERATORY_UPDATED,
          operatory,
          {
            code: operatory.code,
            type: operatory.type,
            isActive: operatory.isActive,
            changedFields,
          },
        );
        return operatory;
      });
    } catch (error) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  async changeActivity(
    context: AuthorizationContext,
    id: string,
    isActive: boolean,
    reason: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const operatory = await this.findOrFail(manager, context, id, true);
      if (operatory.isActive === isActive) return operatory;
      if (!isActive) {
        const assigned = await manager.getRepository(Appointment).count({
          where: {
            tenantId: context.tenant!.id,
            branchId: context.branch!.id,
            operatoryId: operatory.id,
            status: In(ACTIVE_APPOINTMENT_STATUSES),
          },
        });
        if (assigned > 0) {
          throw new ConflictException(
            'The Operatory still has non-terminal appointments. Reassign them before deactivation.',
          );
        }
      }
      operatory.isActive = isActive;
      await manager.save(operatory);
      await this.recordAudit(
        manager,
        context,
        isActive
          ? AuditAction.OPERATORY_ACTIVATED
          : AuditAction.OPERATORY_DEACTIVATED,
        operatory,
        {
          code: operatory.code,
          type: operatory.type,
          isActive,
          changedFields: ['isActive'],
        },
        reason,
      );
      return operatory;
    });
  }

  private async findOrFail(
    manager: EntityManager,
    context: AuthorizationContext,
    id: string,
    lock = false,
  ): Promise<Operatory> {
    const qb = manager
      .getRepository(Operatory)
      .createQueryBuilder('operatory')
      .where('operatory.id = :id', { id })
      .andWhere('operatory.tenantId = :tenantId', {
        tenantId: context.tenant!.id,
      })
      .andWhere('operatory.branchId = :branchId', {
        branchId: context.branch!.id,
      });
    if (lock) qb.setLock('pessimistic_write');
    const operatory = await qb.getOne();
    if (!operatory) throw new NotFoundException('Operatory was not found.');
    return operatory;
  }

  private async recordAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    action: AuditAction,
    operatory: Operatory,
    after: Record<string, unknown>,
    reason?: string,
  ) {
    await this.audit.record(manager, {
      action,
      actor: {
        type: AuditActorType.USER,
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
      },
      tenantId: context.tenant!.id,
      branchId: context.branch!.id,
      resourceId: operatory.id,
      after,
      ...(reason ? { reason } : {}),
    });
  }

  private throwIfDuplicate(error: unknown) {
    const constraint =
      error instanceof QueryFailedError
        ? (error.driverError as { constraint?: string } | undefined)?.constraint
        : undefined;
    if (
      constraint === 'uq_operatories_branch_code_ci' ||
      constraint === 'uq_operatories_branch_name_ci'
    ) {
      throw new ConflictException(
        'An Operatory with this code or name already exists in the branch.',
      );
    }
  }
}
