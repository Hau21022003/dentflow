import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Tenant } from './tenant.entity';

export enum TenantOwnerInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
}

export enum TenantOwnerInvitationDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

/**
 * Invitation capability records are tenant-owned but are only operated by
 * Platform Admin or the public acceptance endpoint. tokenHash is one-way;
 * the raw capability is deterministically reconstructed only by the server
 * when a notification worker sends it.
 */
@Entity({ name: 'tenant_owner_invitations' })
@Index('uq_tenant_owner_invitations_pending_tenant', ['tenantId'], {
  unique: true,
  where: `"status" = 'PENDING'`,
})
@Index('idx_tenant_owner_invitations_tenant_status', ['tenantId', 'status'])
export class TenantOwnerInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'owner_email', type: 'varchar', length: 254 })
  ownerEmail: string;

  @Column({ name: 'owner_email_normalized', type: 'varchar', length: 254 })
  ownerEmailNormalized: string;

  @Column({ name: 'owner_full_name', type: 'varchar', length: 150 })
  ownerFullName: string;

  @Column({ name: 'token_hash', type: 'char', length: 64, select: false })
  tokenHash: string;

  @Column({
    type: 'enum',
    enum: TenantOwnerInvitationStatus,
    enumName: 'tenant_owner_invitation_status_enum',
    default: TenantOwnerInvitationStatus.PENDING,
  })
  status: TenantOwnerInvitationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'accepted_by_user_id', type: 'uuid', nullable: true })
  acceptedByUserId: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({
    name: 'delivery_status',
    type: 'enum',
    enum: TenantOwnerInvitationDeliveryStatus,
    enumName: 'tenant_owner_invitation_delivery_status_enum',
    default: TenantOwnerInvitationDeliveryStatus.PENDING,
  })
  deliveryStatus: TenantOwnerInvitationDeliveryStatus;

  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  @Column({
    name: 'last_delivery_error_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lastDeliveryErrorCode: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.ownerInvitations, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accepted_by_user_id', referencedColumnName: 'id' })
  acceptedByUser: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id', referencedColumnName: 'id' })
  createdByUser: User | null;
}
