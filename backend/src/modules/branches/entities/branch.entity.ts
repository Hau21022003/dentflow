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
import { RoleAssignment } from '../../authorization/entities/role-assignment.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum BranchStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity({ name: 'branches' })
@Unique('uq_branches_id_tenant_id', ['id', 'tenantId'])
@Index('idx_branches_tenant_id_status', ['tenantId', 'status'])
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone: string | null;

  @Column({
    type: 'enum',
    enum: BranchStatus,
    enumName: 'branch_status_enum',
    default: BranchStatus.ACTIVE,
  })
  status: BranchStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.branches, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @OneToMany(() => RoleAssignment, (roleAssignment) => roleAssignment.branch)
  roleAssignments: RoleAssignment[];
}
