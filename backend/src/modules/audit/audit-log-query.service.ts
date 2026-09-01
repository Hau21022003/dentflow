import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Branch } from '../branches/entities/branch.entity';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { AuditDomain, type AuditLog } from './entities/audit-log.entity';
import {
  type AuditLogCursor,
  type AuditLogFilters,
  AuditLogRepository,
} from './audit-log.repository';

const DEFAULT_LIMIT = 50;
const PLATFORM_DOMAINS = [AuditDomain.PLATFORM, AuditDomain.SECURITY];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuditLogSummaryResponse {
  id: string;
  occurredAt: Date;
  domain: AuditDomain;
  action: string;
  tenantId: string | null;
  branchId: string | null;
  actor: {
    type: string;
    userId: string | null;
    sessionId: string | null;
  };
  resource: {
    type: string;
    id: string;
  };
  reason: string | null;
  requestId: string;
}

export interface AuditLogDetailResponse extends AuditLogSummaryResponse {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

export interface AuditLogPageResponse {
  items: AuditLogSummaryResponse[];
  nextCursor: string | null;
}

@Injectable()
export class AuditLogQueryService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  async listPlatform(query: ListAuditLogsDto): Promise<AuditLogPageResponse> {
    return this.list({ domains: PLATFORM_DOMAINS }, query);
  }

  async getPlatform(id: string): Promise<AuditLogDetailResponse> {
    return this.getOne({ id, domains: PLATFORM_DOMAINS });
  }

  async listTenant(
    context: AuthorizationContext,
    query: ListAuditLogsDto,
  ): Promise<AuditLogPageResponse> {
    const tenantId = context.tenant!.id;
    const branchId = query.branchSlug
      ? await this.resolveBranchId(tenantId, query.branchSlug)
      : undefined;

    return this.list({ tenantId, branchId }, query);
  }

  async getTenant(
    context: AuthorizationContext,
    id: string,
  ): Promise<AuditLogDetailResponse> {
    return this.getOne({ id, tenantId: context.tenant!.id });
  }

  async listBranch(
    context: AuthorizationContext,
    query: ListAuditLogsDto,
  ): Promise<AuditLogPageResponse> {
    return this.list(
      { tenantId: context.tenant!.id, branchId: context.branch!.id },
      query,
    );
  }

  async getBranch(
    context: AuthorizationContext,
    id: string,
  ): Promise<AuditLogDetailResponse> {
    return this.getOne({
      id,
      tenantId: context.tenant!.id,
      branchId: context.branch!.id,
    });
  }

  private async list(
    scope: Pick<AuditLogFilters, 'tenantId' | 'branchId' | 'domains'>,
    query: ListAuditLogsDto,
  ): Promise<AuditLogPageResponse> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const records = await this.auditLogRepository.findPage({
      ...scope,
      ...this.toFilters(query),
      limit,
    });
    const hasNextPage = records.length > limit;
    const page = hasNextPage ? records.slice(0, limit) : records;
    const last = page.at(-1);

    return {
      items: page.map((record) => this.toSummary(record)),
      nextCursor:
        hasNextPage && last
          ? this.encodeCursor(last.occurredAt, last.id)
          : null,
    };
  }

  private async getOne(
    scope: Pick<AuditLogFilters, 'tenantId' | 'branchId' | 'domains'> & {
      id: string;
    },
  ): Promise<AuditLogDetailResponse> {
    const record = await this.auditLogRepository.findOne(scope);
    if (!record) {
      throw new NotFoundException('Audit log not found.');
    }

    return {
      ...this.toSummary(record),
      before: record.before,
      after: record.after,
      metadata: record.metadata,
    };
  }

  private async resolveBranchId(
    tenantId: string,
    branchSlug: string,
  ): Promise<string> {
    const branch = await this.branchesRepository.findOneBy({
      tenantId,
      slug: branchSlug,
    });
    if (!branch) {
      throw new NotFoundException('Branch not found.');
    }

    return branch.id;
  }

  private toFilters(
    query: ListAuditLogsDto,
  ): Omit<AuditLogFilters, 'tenantId' | 'branchId' | 'domains' | 'limit'> {
    return {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      actorUserId: query.actorUserId,
      cursor: query.cursor ? this.decodeCursor(query.cursor) : undefined,
    };
  }

  private toSummary(record: AuditLog): AuditLogSummaryResponse {
    return {
      id: record.id,
      occurredAt: record.occurredAt,
      domain: record.domain,
      action: record.action,
      tenantId: record.tenantId,
      branchId: record.branchId,
      actor: {
        type: record.actorType,
        userId: record.actorUserId,
        sessionId: record.actorSessionId,
      },
      resource: { type: record.resourceType, id: record.resourceId },
      reason: record.reason,
      requestId: record.requestId,
    };
  }

  private encodeCursor(occurredAt: Date, id: string): string {
    return Buffer.from(
      JSON.stringify({ occurredAt: occurredAt.toISOString(), id }),
    ).toString('base64url');
  }

  private decodeCursor(value: string): AuditLogCursor {
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as { occurredAt?: unknown; id?: unknown };
      const occurredAt =
        typeof parsed.occurredAt === 'string'
          ? new Date(parsed.occurredAt)
          : undefined;

      if (
        !occurredAt ||
        Number.isNaN(occurredAt.getTime()) ||
        typeof parsed.id !== 'string' ||
        !UUID_PATTERN.test(parsed.id)
      ) {
        throw new Error('invalid cursor');
      }

      return { occurredAt, id: parsed.id };
    } catch {
      throw new BadRequestException('Invalid audit log cursor.');
    }
  }
}
