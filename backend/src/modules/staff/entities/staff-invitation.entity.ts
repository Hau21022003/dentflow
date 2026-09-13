import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { StaffInvitationAssignment } from './staff-invitation-assignment.entity';

export enum StaffInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum StaffInvitationDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity({ name: 'staff_invitations' })
@Unique('uq_staff_invitations_id_tenant', ['id', 'tenantId'])
@Index(
  'uq_staff_invitations_pending_tenant_email',
  ['tenantId', 'emailNormalized'],
  {
    unique: true,
    where: `"status" = 'PENDING'`,
  },
)
@Index('idx_staff_invitations_tenant_status', ['tenantId', 'status'])
export class StaffInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'email_normalized', type: 'varchar', length: 254 })
  emailNormalized: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ name: 'token_hash', type: 'char', length: 64, select: false })
  tokenHash: string;

  @Column({
    type: 'enum',
    enum: StaffInvitationStatus,
    enumName: 'staff_invitation_status_enum',
    default: StaffInvitationStatus.PENDING,
  })
  status: StaffInvitationStatus;

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
    enum: StaffInvitationDeliveryStatus,
    enumName: 'staff_invitation_delivery_status_enum',
    default: StaffInvitationDeliveryStatus.PENDING,
  })
  deliveryStatus: StaffInvitationDeliveryStatus;

  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  @Column({
    name: 'last_delivery_error_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lastDeliveryErrorCode: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accepted_by_user_id', referencedColumnName: 'id' })
  acceptedByUser: User | null;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id', referencedColumnName: 'id' })
  createdByUser: User;

  @OneToMany(
    () => StaffInvitationAssignment,
    (assignment) => assignment.invitation,
  )
  proposedAssignments: StaffInvitationAssignment[];
}
