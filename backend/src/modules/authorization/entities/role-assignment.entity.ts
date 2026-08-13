import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

export enum TenantRoleCode {
  TENANT_ADMIN = 'TENANT_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
  DENTIST = 'DENTIST',
}

@Entity({ name: 'role_assignments' })
@Check(
  'chk_role_assignments_scope',
  `("role_code" = 'TENANT_ADMIN' AND "branch_id" IS NULL) OR ("role_code" IN ('BRANCH_ADMIN', 'RECEPTIONIST', 'DENTIST') AND "branch_id" IS NOT NULL)`,
)
@Index(
  'uq_active_tenant_wide_role_assignment',
  ['userId', 'tenantId', 'roleCode'],
  {
    unique: true,
    where: '"revoked_at" IS NULL AND "branch_id" IS NULL',
  },
)
@Index(
  'uq_active_branch_role_assignment',
  ['userId', 'tenantId', 'roleCode', 'branchId'],
  {
    unique: true,
    where: '"revoked_at" IS NULL AND "branch_id" IS NOT NULL',
  },
)
@Index(
  'idx_active_role_assignments_for_authorization',
  ['userId', 'tenantId', 'branchId', 'roleCode'],
  {
    where: '"revoked_at" IS NULL',
  },
)
export class RoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({
    name: 'role_code',
    type: 'enum',
    enum: TenantRoleCode,
    enumName: 'tenant_role_code_enum',
  })
  roleCode: TenantRoleCode;

  @Column({ name: 'assigned_by_user_id', type: 'uuid', nullable: true })
  assignedByUserId: string | null;

  @Column({
    name: 'assigned_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  assignedAt: Date;

  @Column({
    name: 'assignment_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  assignmentReason: string | null;

  @Column({ name: 'revoked_by_user_id', type: 'uuid', nullable: true })
  revokedByUserId: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({
    name: 'revocation_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  revocationReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.roleAssignments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;

  @ManyToOne(() => Tenant, (tenant) => tenant.roleAssignments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @ManyToOne(() => Branch, (branch) => branch.roleAssignments, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'branch_id', referencedColumnName: 'id' })
  branch: Branch | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_by_user_id', referencedColumnName: 'id' })
  assignedByUser: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'revoked_by_user_id', referencedColumnName: 'id' })
  revokedByUser: User | null;
}
