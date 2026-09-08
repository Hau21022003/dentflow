import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuditDomain, AuditLog } from './entities/audit-log.entity';

export interface AuditLogCursor {
  occurredAt: Date;
  id: string;
}

export interface AuditLogFilters {
  tenantId?: string;
  branchId?: string;
  domains?: AuditDomain[];
  from?: Date;
  to?: Date;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string;
  cursor?: AuditLogCursor;
  limit: number;
}

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async findPage(filters: AuditLogFilters): Promise<AuditLog[]> {
    const query = this.applyFilters(
      this.auditLogs.createQueryBuilder('auditLog'),
      filters,
    )
      .select([
        'auditLog.id',
        'auditLog.tenantId',
        'auditLog.branchId',
        'auditLog.actorType',
        'auditLog.actorUserId',
        'auditLog.actorSessionId',
        'auditLog.domain',
        'auditLog.action',
        'auditLog.resourceType',
        'auditLog.resourceId',
        'auditLog.reason',
        'auditLog.requestId',
        'auditLog.occurredAt',
      ])
      .orderBy('auditLog.occurred_at', 'DESC')
      .addOrderBy('auditLog.id', 'DESC')
      .take(filters.limit + 1);

    return query.getMany();
  }

  async findOne(
    filters: Omit<AuditLogFilters, 'limit' | 'cursor'> & {
      id: string;
    },
  ): Promise<AuditLog | null> {
    const query = this.applyFilters(
      this.auditLogs
        .createQueryBuilder('auditLog')
        .where('auditLog.id = :id', { id: filters.id }),
      { ...filters, limit: 1 },
    ).take(1);

    return query.getOne();
  }

  private applyFilters<
    T extends ReturnType<Repository<AuditLog>['createQueryBuilder']>,
  >(query: T, filters: AuditLogFilters): T {
    if (filters.tenantId) {
      query.andWhere('auditLog.tenant_id = :tenantId', {
        tenantId: filters.tenantId,
      });
    }
    if (filters.branchId) {
      query.andWhere('auditLog.branch_id = :branchId', {
        branchId: filters.branchId,
      });
    }
    if (filters.domains?.length) {
      query.andWhere('auditLog.domain IN (:...domains)', {
        domains: filters.domains,
      });
    }
    if (filters.from) {
      query.andWhere('auditLog.occurred_at >= :from', { from: filters.from });
    }
    if (filters.to) {
      query.andWhere('auditLog.occurred_at <= :to', { to: filters.to });
    }
    if (filters.action) {
      query.andWhere('auditLog.action = :action', { action: filters.action });
    }
    if (filters.resourceType) {
      query.andWhere('auditLog.resource_type = :resourceType', {
        resourceType: filters.resourceType,
      });
    }
    if (filters.resourceId) {
      query.andWhere('auditLog.resource_id = :resourceId', {
        resourceId: filters.resourceId,
      });
    }
    if (filters.actorUserId) {
      query.andWhere('auditLog.actor_user_id = :actorUserId', {
        actorUserId: filters.actorUserId,
      });
    }
    if (filters.cursor) {
      query.andWhere(
        new Brackets((cursorQuery) => {
          cursorQuery
            .where('auditLog.occurred_at < :cursorOccurredAt', {
              cursorOccurredAt: filters.cursor!.occurredAt,
            })
            .orWhere(
              'auditLog.occurred_at = :cursorOccurredAt AND auditLog.id < :cursorId',
              {
                cursorOccurredAt: filters.cursor!.occurredAt,
                cursorId: filters.cursor!.id,
              },
            );
        }),
      );
    }

    return query;
  }
}
