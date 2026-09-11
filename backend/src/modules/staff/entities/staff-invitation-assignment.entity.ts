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
import { TenantRoleCode } from '../../authorization/entities/role-assignment.entity';
import { StaffInvitation } from './staff-invitation.entity';

@Entity({ name: 'staff_invitation_assignments' })
@Check(
  'chk_staff_invitation_assignments_scope',
  `("role_code" = 'TENANT_ADMIN' AND "branch_id" IS NULL) OR ("role_code" IN ('BRANCH_ADMIN', 'RECEPTIONIST', 'DENTIST') AND "branch_id" IS NOT NULL)`,
)
@Index(
  'uq_staff_invitation_tenant_wide_assignment',
  ['staffInvitationId', 'roleCode'],
  {
    unique: true,
    where: '"branch_id" IS NULL',
  },
)
@Index(
  'uq_staff_invitation_branch_assignment',
  ['staffInvitationId', 'roleCode', 'branchId'],
  { unique: true, where: '"branch_id" IS NOT NULL' },
)
export class StaffInvitationAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'staff_invitation_id', type: 'uuid' })
  staffInvitationId: string;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(
    () => StaffInvitation,
    (invitation) => invitation.proposedAssignments,
    {
      nullable: false,
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'staff_invitation_id', referencedColumnName: 'id' })
  invitation: StaffInvitation;
}
