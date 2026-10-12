import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PatientAlertCategory {
  ALLERGY = 'ALLERGY',
  MEDICAL_CONDITION = 'MEDICAL_CONDITION',
  MEDICATION = 'MEDICATION',
  OTHER = 'OTHER',
}

export enum PatientAlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

@Entity({ name: 'patient_alerts' })
@Index('idx_patient_alerts_active', [
  'tenantId',
  'patientId',
  'severity',
  'createdAt',
])
@Check('chk_patient_alert_message_not_blank', `length(btrim("message")) > 0`)
export class PatientAlert {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({
    type: 'enum',
    enum: PatientAlertCategory,
    enumName: 'patient_alert_category_enum',
  })
  category: PatientAlertCategory;
  @Column({
    type: 'enum',
    enum: PatientAlertSeverity,
    enumName: 'patient_alert_severity_enum',
  })
  severity: PatientAlertSeverity;
  @Column({ type: 'varchar', length: 500 }) message: string;
  @Column({ name: 'created_by_user_id', type: 'uuid' }) createdByUserId: string;
  @Column({ name: 'resolved_by_user_id', type: 'uuid', nullable: true })
  resolvedByUserId: string | null;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
