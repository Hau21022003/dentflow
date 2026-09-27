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
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum PatientGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

@Entity({ name: 'patients' })
@Unique('uq_patients_tenant_id_phone_normalized', [
  'tenantId',
  'phoneNormalized',
])
@Index('idx_patients_tenant_id_full_name_id', ['tenantId', 'fullName', 'id'])
@Index('idx_patients_tenant_id_created_at_id', ['tenantId', 'createdAt', 'id'])
@Check('chk_patients_full_name_not_blank', `length(btrim("full_name")) > 0`)
@Check('chk_patients_phone_not_blank', `length(btrim("phone")) > 0`)
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  /** The display value supplied by the user; never use it for uniqueness. */
  @Column({ type: 'varchar', length: 30 })
  phone: string;

  /** Canonical E.164 value used internally for tenant-scoped duplicate checks. */
  @Column({ name: 'phone_normalized', type: 'varchar', length: 20 })
  phoneNormalized: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({
    type: 'enum',
    enum: PatientGender,
    enumName: 'patient_gender_enum',
  })
  gender: PatientGender;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({
    name: 'emergency_contact_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  emergencyContactName: string | null;

  @Column({
    name: 'emergency_contact_phone',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  emergencyContactPhone: string | null;

  @Column({
    name: 'emergency_contact_relationship',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  emergencyContactRelationship: string | null;

  @Column({
    name: 'referral_source',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  referralSource: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;
}
