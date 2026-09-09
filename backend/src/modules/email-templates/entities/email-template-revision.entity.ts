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
import { User } from '../../users/entities/user.entity';
import {
  EmailTemplateKey,
  EmailTemplateLocale,
} from '../email-template-registry';

export enum EmailTemplateRevisionStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Entity({ name: 'email_template_revisions' })
@Unique('uq_email_template_revisions_key_locale_version', [
  'templateKey',
  'locale',
  'version',
])
@Index('uq_email_template_revisions_current_draft', ['templateKey', 'locale'], {
  unique: true,
  where: `"status" = 'DRAFT'`,
})
@Index(
  'uq_email_template_revisions_current_published',
  ['templateKey', 'locale'],
  {
    unique: true,
    where: `"status" = 'PUBLISHED'`,
  },
)
@Check('chk_email_template_revisions_version_positive', '"version" > 0')
@Check(
  'chk_email_template_revisions_publish_state',
  `(
    ("status" = 'DRAFT' AND "published_at" IS NULL AND "published_by_user_id" IS NULL)
    OR
    ("status" IN ('PUBLISHED', 'ARCHIVED') AND "published_at" IS NOT NULL)
  )`,
)
export class EmailTemplateRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_key', type: 'varchar', length: 100 })
  templateKey: EmailTemplateKey;

  @Column({ type: 'varchar', length: 10 })
  locale: EmailTemplateLocale;

  @Column({ type: 'integer' })
  version: number;

  @Column({
    type: 'enum',
    enum: EmailTemplateRevisionStatus,
    enumName: 'email_template_revision_status_enum',
  })
  status: EmailTemplateRevisionStatus;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'text' })
  html: string;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ name: 'published_by_user_id', type: 'uuid', nullable: true })
  publishedByUserId: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id', referencedColumnName: 'id' })
  createdByUser: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'published_by_user_id', referencedColumnName: 'id' })
  publishedByUser: User | null;
}
