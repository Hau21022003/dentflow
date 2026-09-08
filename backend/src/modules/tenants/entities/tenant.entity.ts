import {
  Check,
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
import { RoleAssignment } from '../../authorization/entities/role-assignment.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { TenantOwnerInvitation } from './tenant-owner-invitation.entity';

export enum TenantStatus {
  PROVISIONING = 'PROVISIONING',
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  CANCELED = 'CANCELED',
}

@Entity({ name: 'tenants' })
@Unique('uq_tenants_slug', ['slug'])
@Index('idx_tenants_created_at_id', ['createdAt', 'id'])
@Check('chk_tenants_slug_format', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 200 })
  legalName: string;

  @Column({ name: 'display_name', type: 'varchar', length: 150 })
  displayName: string;

  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @Column({ name: 'billing_email', type: 'varchar', length: 254 })
  billingEmail: string;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: 254,
    nullable: true,
  })
  contactEmail: string | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 2048, nullable: true })
  logoUrl: string | null;

  @Column({
    name: 'default_locale',
    type: 'varchar',
    length: 10,
    default: 'vi',
  })
  defaultLocale: string;

  @Column({
    name: 'default_timezone',
    type: 'varchar',
    length: 64,
    default: 'Asia/Ho_Chi_Minh',
  })
  defaultTimezone: string;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    enumName: 'tenant_status_enum',
    default: TenantStatus.PROVISIONING,
  })
  status: TenantStatus;

  /**
   * Identity that accepted the initial owner invitation. This is intentionally
   * separate from RoleAssignment: a tenant can have several TENANT_ADMINs,
   * while Platform operations need one accountable owner/contact.
   */
  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  /** A Platform suspension wins over provider-derived subscription state. */
  @Column({ name: 'admin_suspended_at', type: 'timestamptz', nullable: true })
  adminSuspendedAt: Date | null;

  @Column({
    name: 'admin_suspended_by_user_id',
    type: 'uuid',
    nullable: true,
  })
  adminSuspendedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Branch, (branch) => branch.tenant)
  branches: Branch[];

  @OneToMany(() => RoleAssignment, (roleAssignment) => roleAssignment.tenant)
  roleAssignments: RoleAssignment[];

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_user_id', referencedColumnName: 'id' })
  ownerUser: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'admin_suspended_by_user_id',
    referencedColumnName: 'id',
  })
  adminSuspendedByUser: User | null;

  @OneToMany(() => TenantOwnerInvitation, (invitation) => invitation.tenant)
  ownerInvitations: TenantOwnerInvitation[];
}
