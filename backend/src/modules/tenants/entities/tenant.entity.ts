import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Branch, (branch) => branch.tenant)
  branches: Branch[];
}
