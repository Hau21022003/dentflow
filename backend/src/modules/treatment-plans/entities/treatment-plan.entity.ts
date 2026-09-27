import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
export enum TreatmentPlanStatus {
  DRAFT = 'DRAFT',
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
@Entity({ name: 'treatment_plans' })
@Index('idx_treatment_plans_tenant_branch_patient', [
  'tenantId',
  'branchId',
  'patientId',
])
@Index('idx_treatment_plans_origin_visit', ['originVisitId'])
export class TreatmentPlan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'origin_visit_id', type: 'uuid' }) originVisitId: string;
  @Column({ name: 'created_by_user_id', type: 'uuid' }) createdByUserId: string;
  @Column({
    type: 'enum',
    enum: TreatmentPlanStatus,
    enumName: 'treatment_plan_status_enum',
  })
  status: TreatmentPlanStatus;
  @Column({ name: 'accepted_by_user_id', type: 'uuid', nullable: true })
  acceptedByUserId: string | null;
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
