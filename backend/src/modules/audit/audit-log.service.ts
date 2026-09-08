import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { RequestContextService } from '../../common/request-context/request-context.service';
import {
  AUDIT_ACTION_DEFINITIONS,
  type AuditAction,
  type AuditResourceType,
} from './audit-actions';
import { AuditActorType, AuditLog } from './entities/audit-log.entity';

type AuditJson = Record<string, unknown>;

export interface AuditActor {
  type: AuditActorType;
  userId?: string;
  sessionId?: string;
}

export interface AuditEvent {
  action: AuditAction;
  actor: AuditActor;
  tenantId?: string;
  branchId?: string;
  resourceId: string;
  resourceType?: AuditResourceType;
  reason?: string;
  before?: AuditJson;
  after?: AuditJson;
  metadata?: AuditJson;
  occurredAt?: Date;
}

const SENSITIVE_KEY_PATTERN =
  /password|token|secret|cookie|clinical|diagnos|treatment.?note|\bnote\b|alert|patient.?name|full.?name|email|phone|address|date.?of.?birth/i;
const MAX_SNAPSHOT_BYTES = 12_000;
const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,79}$/;

@Injectable()
export class AuditLogService {
  constructor(private readonly requestContext: RequestContextService) {}

  async record(manager: EntityManager, event: AuditEvent): Promise<AuditLog> {
    const definition = AUDIT_ACTION_DEFINITIONS[event.action];
    if (!definition) {
      throw new BadRequestException('Unsupported audit action.');
    }
    if (event.resourceType && event.resourceType !== definition.resourceType) {
      throw new BadRequestException(
        'Audit resource type does not match action.',
      );
    }
    if (event.branchId && !event.tenantId) {
      throw new BadRequestException('Branch audit events require a tenant.');
    }
    if (event.actor.type === AuditActorType.USER && !event.actor.userId) {
      throw new BadRequestException('User audit actor requires a user ID.');
    }
    if (event.reason && !definition.allowsFreeTextReason) {
      throw new BadRequestException(
        'This audit action accepts a reason code in metadata, not free text.',
      );
    }

    const context = this.requestContext.get();
    const auditLog = manager.create(AuditLog, {
      tenantId: event.tenantId ?? null,
      branchId: event.branchId ?? null,
      actorType: event.actor.type,
      actorUserId: event.actor.userId ?? null,
      actorSessionId: event.actor.sessionId ?? null,
      domain: definition.domain,
      action: event.action,
      resourceType: definition.resourceType,
      resourceId: event.resourceId,
      reason: this.normalizeReason(event.reason),
      before: this.toSafeSnapshot(
        event.before,
        'before',
        definition.payload.before,
      ),
      after: this.toSafeSnapshot(
        event.after,
        'after',
        definition.payload.after,
      ),
      metadata:
        this.toSafeSnapshot(
          event.metadata,
          'metadata',
          definition.payload.metadata,
        ) ?? {},
      requestId: context?.requestId ?? randomUUID(),
      sourceIpHmac: context?.sourceIpHmac ?? null,
      userAgent: context?.userAgent ?? null,
      occurredAt: event.occurredAt ?? new Date(),
    });

    return manager.getRepository(AuditLog).save(auditLog);
  }

  private normalizeReason(reason: string | undefined): string | null {
    if (!reason) {
      return null;
    }

    const normalized = reason.trim();
    if (!normalized || normalized.length > 500) {
      throw new BadRequestException(
        'Audit reason must contain up to 500 characters.',
      );
    }

    return normalized;
  }

  private toSafeSnapshot(
    snapshot: AuditJson | undefined,
    fieldName: string,
    allowedKeys: readonly string[],
  ): AuditJson | null {
    if (snapshot === undefined) {
      return null;
    }
    if (!this.isPlainObject(snapshot)) {
      throw new BadRequestException(`${fieldName} must be a JSON object.`);
    }

    this.assertSafeJson(snapshot, fieldName, allowedKeys);
    const serialized = JSON.stringify(snapshot);
    if (serialized.length > MAX_SNAPSHOT_BYTES) {
      throw new BadRequestException(
        `${fieldName} exceeds the audit payload limit.`,
      );
    }

    return JSON.parse(serialized) as AuditJson;
  }

  private assertSafeJson(
    value: AuditJson,
    path: string,
    allowedKeys: readonly string[],
  ): void {
    if (this.isPlainObject(value)) {
      Object.entries(value).forEach(([key, entry]) => {
        if (!allowedKeys.includes(key)) {
          throw new BadRequestException(
            `${path}.${key} is not allowed for this audit action.`,
          );
        }
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          throw new BadRequestException(
            `${path}.${key} is not permitted in an audit payload.`,
          );
        }
        this.assertSafeFieldValue(key, entry, `${path}.${key}`);
        this.assertSafeJsonValue(entry, `${path}.${key}`);
      });
    }
  }

  private assertSafeJsonValue(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        this.assertSafeJsonValue(entry, `${path}[${index}]`),
      );
      return;
    }
    if (this.isPlainObject(value)) {
      Object.entries(value).forEach(([key, entry]) => {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          throw new BadRequestException(
            `${path}.${key} is not permitted in an audit payload.`,
          );
        }
        this.assertSafeJsonValue(entry, `${path}.${key}`);
      });
      return;
    }
    if (
      value !== null &&
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      throw new BadRequestException(`${path} is not JSON serializable.`);
    }
  }

  private assertSafeFieldValue(
    key: string,
    value: unknown,
    path: string,
  ): void {
    if (key === 'reasonCode') {
      if (typeof value !== 'string' || !REASON_CODE_PATTERN.test(value)) {
        throw new BadRequestException(
          `${path} must be an uppercase machine-readable code.`,
        );
      }
      return;
    }

    if (key === 'changedFields') {
      if (
        !Array.isArray(value) ||
        value.some(
          (field) =>
            typeof field !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(field),
        )
      ) {
        throw new BadRequestException(
          `${path} must contain only field-name identifiers.`,
        );
      }
    }
  }

  private isPlainObject(value: unknown): value is AuditJson {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }
}
