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
import { Patient } from '../../patients/entities/patient.entity';
import { Service } from '../../services/entities/service.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum AppointmentSource {
  PHONE = 'PHONE',
  WALK_IN = 'WALK_IN',
  ONLINE = 'ONLINE',
  OTHER = 'OTHER',
}

@Entity({ name: 'appointments' })
@Index('idx_appointments_branch_start_at_id', [
  'tenantId',
  'branchId',
  'startAt',
  'id',
])
@Index('idx_appointments_branch_status_start_at_id', [
  'tenantId',
  'branchId',
  'status',
  'startAt',
  'id',
])
@Index('idx_appointments_assigned_dentist_start_at_id', [
  'tenantId',
  'branchId',
  'assignedDentistUserId',
  'startAt',
  'id',
])
@Check('chk_appointments_time_range', '"start_at" < "end_at"')
@Check(
  'chk_appointments_reason_without_service',
  '"service_id" IS NOT NULL OR length(btrim(coalesce("visit_reason", \'\'))) > 0',
)
@Check(
  'chk_appointments_service_snapshot',
  `("service_id" IS NULL AND "service_code" IS NULL AND "service_name" IS NULL AND "service_amount" IS NULL AND "service_currency" IS NULL AND "service_duration_minutes" IS NULL) OR ("service_id" IS NOT NULL AND "service_code" IS NOT NULL AND "service_name" IS NOT NULL AND "service_amount" IS NOT NULL AND "service_currency" IS NOT NULL AND "service_duration_minutes" IS NOT NULL)`,
)
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    enumName: 'appointment_status_enum',
    default: AppointmentStatus.BOOKED,
  })
  status: AppointmentStatus;

  @Column({
    type: 'enum',
    enum: AppointmentSource,
    enumName: 'appointment_source_enum',
  })
  source: AppointmentSource;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ name: 'assigned_dentist_user_id', type: 'uuid', nullable: true })
  assignedDentistUserId: string | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({
    name: 'service_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  serviceCode: string | null;

  @Column({
    name: 'service_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  serviceName: string | null;

  @Column({ name: 'service_amount', type: 'integer', nullable: true })
  serviceAmount: number | null;

  @Column({ name: 'service_currency', type: 'char', length: 3, nullable: true })
  serviceCurrency: string | null;

  @Column({
    name: 'service_duration_minutes',
    type: 'smallint',
    nullable: true,
  })
  serviceDurationMinutes: number | null;

  @Column({
    name: 'visit_reason',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  visitReason: string | null;

  @Column({
    name: 'operational_note',
    type: 'varchar',
    length: 2000,
    nullable: true,
  })
  operationalNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @ManyToOne(() => Branch, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'branch_id', referencedColumnName: 'id' },
    { name: 'tenant_id', referencedColumnName: 'tenantId' },
  ])
  branch: Branch;

  @ManyToOne(() => Patient, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id', referencedColumnName: 'id' })
  patient: Patient;

  @ManyToOne(() => Service, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_id', referencedColumnName: 'id' })
  service: Service | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_dentist_user_id', referencedColumnName: 'id' })
  assignedDentist: User | null;
}
