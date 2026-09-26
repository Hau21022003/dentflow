import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
export enum TreatmentItemStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
@Entity({ name: 'treatment_items' })
@Index('idx_treatment_items_plan', ['treatmentPlanId', 'id'])
export class TreatmentItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'treatment_plan_id', type: 'uuid' }) treatmentPlanId: string;
  @Column({ name: 'service_id', type: 'uuid' }) serviceId: string;
  @Column({ name: 'service_code', length: 100 }) serviceCode: string;
  @Column({ name: 'service_name', length: 150 }) serviceName: string;
  @Column({ name: 'list_unit_amount', type: 'integer' }) listUnitAmount: number;
  @Column({ type: 'char', length: 3 }) currency: string;
  @Column({ type: 'integer' }) quantity: number;
  @Column({ name: 'discount_amount', type: 'integer' }) discountAmount: number;
  @Column({ name: 'final_unit_amount', type: 'integer' })
  finalUnitAmount: number;
  @Column({
    name: 'tooth_position',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  toothPosition: string | null;
  @Column({ type: 'text', nullable: true }) indication: string | null;
  @Column({ name: 'planned_dentist_user_id', type: 'uuid' })
  plannedDentistUserId: string;
  @Column({
    type: 'enum',
    enum: TreatmentItemStatus,
    enumName: 'treatment_item_status_enum',
  })
  status: TreatmentItemStatus;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
