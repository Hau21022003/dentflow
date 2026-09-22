import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { TreatmentNote } from './treatment-note.entity';

export enum VisitStatus {
  OPEN = 'OPEN',
  COMPLETED = 'COMPLETED',
}

@Entity({ name: 'visits' })
@Index('uq_visits_appointment_id', ['appointmentId'], { unique: true })
@Index('idx_visits_tenant_branch_appointment_id', [
  'tenantId',
  'branchId',
  'appointmentId',
])
export class Visit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

  @Column({ name: 'opened_by_user_id', type: 'uuid' })
  openedByUserId: string;

  @Column({
    type: 'enum',
    enum: VisitStatus,
    enumName: 'visit_status_enum',
    default: VisitStatus.OPEN,
  })
  status: VisitStatus;

  @Column({ type: 'text', nullable: true })
  symptoms: string | null;

  @Column({ name: 'relevant_history', type: 'text', nullable: true })
  relevantHistory: string | null;

  @Column({ type: 'text', nullable: true })
  examination: string | null;

  @Column({ type: 'text', nullable: true })
  diagnosis: string | null;

  @Column({ name: 'clinical_note', type: 'text', nullable: true })
  clinicalNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

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
  @JoinColumn({ name: 'opened_by_user_id', referencedColumnName: 'id' })
  openedByUser: User;

  @OneToMany(() => TreatmentNote, (note) => note.visit)
  addenda: TreatmentNote[];
}
