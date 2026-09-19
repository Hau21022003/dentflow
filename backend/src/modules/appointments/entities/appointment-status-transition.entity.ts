import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { Appointment, AppointmentStatus } from './appointment.entity';

@Entity({ name: 'appointment_status_transitions' })
@Index('idx_appointment_status_transitions_appointment_occurred_at_id', [
  'appointmentId',
  'occurredAt',
  'id',
])
export class AppointmentStatusTransition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: AppointmentStatus,
    enumName: 'appointment_status_enum',
    nullable: true,
  })
  fromStatus: AppointmentStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: AppointmentStatus,
    enumName: 'appointment_status_enum',
  })
  toStatus: AppointmentStatus;

  @Column({ name: 'reason_code', type: 'varchar', length: 80, nullable: true })
  reasonCode: string | null;

  @Column({ name: 'changed_by_user_id', type: 'uuid' })
  changedByUserId: string;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @ManyToOne(() => Appointment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'appointment_id', referencedColumnName: 'id' })
  appointment: Appointment;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @ManyToOne(() => Branch, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'branch_id', referencedColumnName: 'id' },
    { name: 'tenant_id', referencedColumnName: 'tenantId' },
  ])
  branch: Branch;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'changed_by_user_id', referencedColumnName: 'id' })
  changedByUser: User;
}
