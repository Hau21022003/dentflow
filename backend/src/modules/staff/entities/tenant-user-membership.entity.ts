import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

export enum TenantUserMembershipStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

/**
 * Tenant-local access lifecycle for a global identity. It deliberately does
 * not mirror User.status, because a tenant must not disable another tenant's
 * workforce access.
 */
@Entity({ name: 'tenant_user_memberships' })
@Unique('uq_tenant_user_memberships_tenant_user', ['tenantId', 'userId'])
@Unique('uq_tenant_user_memberships_user_tenant', ['userId', 'tenantId'])
@Check(
  'chk_tenant_user_memberships_disabled_state',
  `("status" = 'ACTIVE' AND "disabled_at" IS NULL AND "disabled_by_user_id" IS NULL AND "disabled_reason" IS NULL) OR ("status" = 'DISABLED' AND "disabled_at" IS NOT NULL AND "disabled_by_user_id" IS NOT NULL AND "disabled_reason" IS NOT NULL)`,
)
export class TenantUserMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: TenantUserMembershipStatus,
    enumName: 'tenant_user_membership_status_enum',
    default: TenantUserMembershipStatus.ACTIVE,
  })
  status: TenantUserMembershipStatus;

  @Column({ name: 'disabled_at', type: 'timestamptz', nullable: true })
  disabledAt: Date | null;

  @Column({ name: 'disabled_by_user_id', type: 'uuid', nullable: true })
  disabledByUserId: string | null;

  @Column({
    name: 'disabled_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  disabledReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'disabled_by_user_id', referencedColumnName: 'id' })
  disabledByUser: User | null;
}
