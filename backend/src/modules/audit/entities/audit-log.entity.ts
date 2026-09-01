import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AuditDomain {
  PLATFORM = 'PLATFORM',
  TENANT_ADMIN = 'TENANT_ADMIN',
  CLINICAL = 'CLINICAL',
  FINANCIAL = 'FINANCIAL',
  SECURITY = 'SECURITY',
}

export enum AuditActorType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  WEBHOOK = 'WEBHOOK',
}

@Entity({ name: 'audit_logs' })
@Index('idx_audit_logs_tenant_occurred_at', ['tenantId', 'occurredAt', 'id'])
@Index('idx_audit_logs_branch_occurred_at', ['branchId', 'occurredAt', 'id'])
@Index('idx_audit_logs_actor_occurred_at', ['actorUserId', 'occurredAt', 'id'])
@Index('idx_audit_logs_resource_occurred_at', [
  'resourceType',
  'resourceId',
  'occurredAt',
  'id',
])
@Index('idx_audit_logs_domain_occurred_at', ['domain', 'occurredAt', 'id'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: AuditActorType,
    enumName: 'audit_actor_type_enum',
  })
  actorType: AuditActorType;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ name: 'actor_session_id', type: 'uuid', nullable: true })
  actorSessionId: string | null;

  @Column({
    type: 'enum',
    enum: AuditDomain,
    enumName: 'audit_domain_enum',
  })
  domain: AuditDomain;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 80 })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Column({ name: 'before', type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ name: 'after', type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({
    name: 'source_ip_hmac',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourceIpHmac: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
