import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'treatment_item_event_images' })
@Index('idx_treatment_item_event_images_event', ['eventId', 'sortOrder'])
@Unique('uq_treatment_item_event_images_event_sort', ['eventId', 'sortOrder'])
@Unique('uq_treatment_item_event_images_object_key', ['objectKey'])
export class TreatmentItemEventImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'object_key', type: 'varchar', length: 500 })
  objectKey: string;

  @Column({ name: 'content_type', type: 'varchar', length: 50 })
  contentType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ name: 'sort_order', type: 'smallint' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
