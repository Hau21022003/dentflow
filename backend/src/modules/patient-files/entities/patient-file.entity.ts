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
import { Branch } from '../../branches/entities/branch.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { Visit } from '../../visits/entities/visit.entity';

export enum PatientFileCategory {
  CLINICAL_PHOTO = 'CLINICAL_PHOTO',
  XRAY = 'XRAY',
  DOCUMENT = 'DOCUMENT',
  FORM = 'FORM',
  OTHER = 'OTHER',
}

@Entity({ name: 'patient_files' })
@Unique('uq_patient_files_object_key', ['objectKey'])
@Index('idx_patient_files_patient_date', [
  'tenantId',
  'branchId',
  'patientId',
  'archivedAt',
  'fileDate',
  'id',
])
@Index('idx_patient_files_patient_category_date', [
  'tenantId',
  'branchId',
  'patientId',
  'category',
  'archivedAt',
  'fileDate',
  'id',
])
@Check(
  'chk_patient_files_name_not_blank',
  `length(btrim("original_file_name")) > 0`,
)
@Check(
  'chk_patient_files_note_length',
  `"note" IS NULL OR length("note") BETWEEN 1 AND 500`,
)
@Check('chk_patient_files_size', `"size_bytes" BETWEEN 1 AND 10485760`)
@Check(
  'chk_patient_files_content_type',
  `"content_type" IN ('image/jpeg','image/png','image/webp','application/pdf')`,
)
@Check(
  'chk_patient_files_archive_pair',
  `("archived_at" IS NULL) = ("archived_by_user_id" IS NULL)`,
)
export class PatientFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'source_visit_id', type: 'uuid' }) sourceVisitId: string;

  @Column({ name: 'original_file_name', type: 'varchar', length: 255 })
  originalFileName: string;

  @Column({ name: 'object_key', type: 'varchar', length: 500 })
  objectKey: string;

  @Column({ name: 'content_type', type: 'varchar', length: 50 })
  contentType: string;

  @Column({ name: 'size_bytes', type: 'integer' }) sizeBytes: number;

  @Column({
    type: 'enum',
    enum: PatientFileCategory,
    enumName: 'patient_file_category_enum',
  })
  category: PatientFileCategory;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ name: 'file_date', type: 'date' }) fileDate: string;
  @Column({ name: 'created_by_user_id', type: 'uuid' }) createdByUserId: string;
  @Column({ name: 'updated_by_user_id', type: 'uuid' }) updatedByUserId: string;
  @Column({ name: 'archived_by_user_id', type: 'uuid', nullable: true })
  archivedByUserId: string | null;
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

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

  @ManyToOne(() => Visit, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_visit_id', referencedColumnName: 'id' })
  sourceVisit: Visit;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id', referencedColumnName: 'id' })
  createdBy: User;
}
