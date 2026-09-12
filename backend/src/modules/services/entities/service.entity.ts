import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ServiceGroup } from '../../service-groups/entities/service-group.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity({ name: 'services' })
@Unique('uq_services_tenant_id_code', ['tenantId', 'code'])
@Index('idx_services_tenant_id_is_active_name_id', [
  'tenantId',
  'isActive',
  'name',
  'id',
])
@Index('idx_services_tenant_id_service_group_id', [
  'tenantId',
  'serviceGroupId',
])
@Check('chk_services_code_format', `"code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('chk_services_amount_non_negative', `"amount" >= 0`)
@Check('chk_services_currency_format', `"currency" ~ '^[A-Z]{3}$'`)
@Check('chk_services_duration_minutes_positive', `"duration_minutes" > 0`)
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'service_group_id', type: 'uuid' })
  serviceGroupId: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'duration_minutes', type: 'smallint' })
  durationMinutes: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @ManyToOne(() => ServiceGroup, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_group_id', referencedColumnName: 'id' })
  serviceGroup: ServiceGroup;
}
