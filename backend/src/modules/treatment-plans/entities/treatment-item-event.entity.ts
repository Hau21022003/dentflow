import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
export enum TreatmentItemEventType {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
@Entity({ name: 'treatment_item_events' })
@Index('idx_treatment_item_events_item_created_id', [
  'treatmentItemId',
  'createdAt',
  'id',
])
@Index('idx_treatment_item_events_visit_created_id', [
  'visitId',
  'createdAt',
  'id',
])
export class TreatmentItemEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'treatment_item_id', type: 'uuid' }) treatmentItemId: string;
  @Column({ name: 'treatment_plan_id', type: 'uuid' }) treatmentPlanId: string;
  @Column({ name: 'visit_id', type: 'uuid' }) visitId: string;
  @Column({ name: 'performed_by_user_id', type: 'uuid' })
  performedByUserId: string;
  @Column({
    name: 'event_type',
    type: 'enum',
    enum: TreatmentItemEventType,
    enumName: 'treatment_item_event_type_enum',
  })
  eventType: TreatmentItemEventType;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
