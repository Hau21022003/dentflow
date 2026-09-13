import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { SaveEmailTemplateDraftDto } from './dto/save-email-template-draft.dto';
import {
  EmailTemplateRenderError,
  EmailTemplateRenderer,
} from './email-template-renderer.service';
import {
  EmailTemplateKey,
  EmailTemplateLocale,
} from './email-template-registry';
import {
  EmailTemplateRevision,
  EmailTemplateRevisionStatus,
} from './entities/email-template-revision.entity';

const EMAIL_TEMPLATE_CONTENT_FIELDS = ['subject', 'text', 'html'] as const;

type EmailTemplateContentField = (typeof EMAIL_TEMPLATE_CONTENT_FIELDS)[number];

type EmailTemplateRevisionResponse = {
  id: string;
  templateKey: EmailTemplateKey;
  locale: EmailTemplateLocale;
  version: number;
  status: EmailTemplateRevisionStatus;
  subject: string;
  text: string;
  html: string;
  createdByUserId: string | null;
  publishedByUserId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplateRevision)
    private readonly revisions: Repository<EmailTemplateRevision>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly renderer: EmailTemplateRenderer,
  ) {}

  async list() {
    const revisions = await this.revisions.find({
      order: { templateKey: 'ASC', locale: 'ASC', version: 'DESC' },
    });

    return Object.values(EmailTemplateKey).flatMap((templateKey) =>
      Object.values(EmailTemplateLocale).map((locale) => {
        const records = revisions.filter(
          (revision) =>
            revision.templateKey === templateKey && revision.locale === locale,
        );
        return {
          templateKey,
          locale,
          draft: this.toRevisionResponse(
            records.find(
              (revision) =>
                revision.status === EmailTemplateRevisionStatus.DRAFT,
            ) ?? null,
          ),
          published: this.toRevisionResponse(
            records.find(
              (revision) =>
                revision.status === EmailTemplateRevisionStatus.PUBLISHED,
            ) ?? null,
          ),
        };
      }),
    );
  }

  async get(templateKey: EmailTemplateKey, locale: EmailTemplateLocale) {
    const revisions = await this.revisions.find({
      where: { templateKey, locale },
      order: { version: 'DESC' },
    });
    if (revisions.length === 0) {
      throw new NotFoundException('Email template was not found.');
    }

    return {
      templateKey,
      locale,
      draft: this.toRevisionResponse(
        revisions.find(
          (revision) => revision.status === EmailTemplateRevisionStatus.DRAFT,
        ) ?? null,
      ),
      published: this.toRevisionResponse(
        revisions.find(
          (revision) =>
            revision.status === EmailTemplateRevisionStatus.PUBLISHED,
        ) ?? null,
      ),
      revisions: revisions.map((revision) => this.toRevisionResponse(revision)),
    };
  }

  async saveDraft(
    context: AuthorizationContext,
    templateKey: EmailTemplateKey,
    locale: EmailTemplateLocale,
    input: SaveEmailTemplateDraftDto,
  ): Promise<EmailTemplateRevisionResponse> {
    this.validateContent(templateKey, input);

    return this.dataSource.transaction(async (manager) => {
      await this.lockTemplate(manager, templateKey, locale);
      const repository = manager.getRepository(EmailTemplateRevision);
      const existing = await repository
        .createQueryBuilder('revision')
        .setLock('pessimistic_write')
        .where('revision.template_key = :templateKey', { templateKey })
        .andWhere('revision.locale = :locale', { locale })
        .andWhere('revision.status = :status', {
          status: EmailTemplateRevisionStatus.DRAFT,
        })
        .getOne();

      if (existing) {
        const changedFields = this.changedContentFields(existing, input);
        if (changedFields.length === 0) {
          return this.toRevisionResponse(existing)!;
        }

        const before = this.toAuditSnapshot(existing, changedFields);
        changedFields.forEach((field) => {
          existing[field] = input[field];
        });
        const saved = await repository.save(existing);
        await this.recordDraftAudit(
          manager,
          context,
          saved,
          before,
          changedFields,
        );
        return this.toRevisionResponse(saved)!;
      }

      const latest = await repository.findOne({
        where: { templateKey, locale },
        order: { version: 'DESC' },
      });
      const draft = repository.create({
        templateKey,
        locale,
        version: (latest?.version ?? 0) + 1,
        status: EmailTemplateRevisionStatus.DRAFT,
        subject: input.subject,
        text: input.text,
        html: input.html,
        createdByUserId: context.actor.userId,
        publishedByUserId: null,
        publishedAt: null,
      });
      const saved = await repository.save(draft);
      await this.recordDraftAudit(manager, context, saved, undefined, [
        ...EMAIL_TEMPLATE_CONTENT_FIELDS,
      ]);
      return this.toRevisionResponse(saved)!;
    });
  }

  async publishDraft(
    context: AuthorizationContext,
    templateKey: EmailTemplateKey,
    locale: EmailTemplateLocale,
  ): Promise<EmailTemplateRevisionResponse> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockTemplate(manager, templateKey, locale);
      const repository = manager.getRepository(EmailTemplateRevision);
      const draft = await repository
        .createQueryBuilder('revision')
        .setLock('pessimistic_write')
        .where('revision.template_key = :templateKey', { templateKey })
        .andWhere('revision.locale = :locale', { locale })
        .andWhere('revision.status = :status', {
          status: EmailTemplateRevisionStatus.DRAFT,
        })
        .getOne();
      if (!draft) {
        throw new ConflictException('No email template draft is available.');
      }

      const currentPublished = await repository
        .createQueryBuilder('revision')
        .setLock('pessimistic_write')
        .where('revision.template_key = :templateKey', { templateKey })
        .andWhere('revision.locale = :locale', { locale })
        .andWhere('revision.status = :status', {
          status: EmailTemplateRevisionStatus.PUBLISHED,
        })
        .getOne();
      if (currentPublished) {
        currentPublished.status = EmailTemplateRevisionStatus.ARCHIVED;
        await repository.save(currentPublished);
      }

      draft.status = EmailTemplateRevisionStatus.PUBLISHED;
      draft.publishedByUserId = context.actor.userId;
      draft.publishedAt = new Date();
      const saved = await repository.save(draft);
      await this.auditLogService.record(manager, {
        action: AuditAction.EMAIL_TEMPLATE_PUBLISHED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        resourceId: saved.id,
        before: this.toAuditSnapshot(
          draft,
          [],
          EmailTemplateRevisionStatus.DRAFT,
        ),
        after: this.toAuditSnapshot(
          saved,
          [],
          EmailTemplateRevisionStatus.PUBLISHED,
        ),
      });
      return this.toRevisionResponse(saved)!;
    });
  }

  async publish(
    context: AuthorizationContext,
    templateKey: EmailTemplateKey,
    locale: EmailTemplateLocale,
    input: SaveEmailTemplateDraftDto,
  ): Promise<EmailTemplateRevisionResponse> {
    this.validateContent(templateKey, input);

    return this.dataSource.transaction(async (manager) => {
      await this.lockTemplate(manager, templateKey, locale);
      const repository = manager.getRepository(EmailTemplateRevision);
      const draft = await repository
        .createQueryBuilder('revision')
        .setLock('pessimistic_write')
        .where('revision.template_key = :templateKey', { templateKey })
        .andWhere('revision.locale = :locale', { locale })
        .andWhere('revision.status = :status', {
          status: EmailTemplateRevisionStatus.DRAFT,
        })
        .getOne();
      if (draft) {
        throw new ConflictException(
          'An email template draft must be resolved before publishing directly.',
        );
      }

      const latest = await repository.findOne({
        where: { templateKey, locale },
        order: { version: 'DESC' },
      });
      const currentPublished = await repository
        .createQueryBuilder('revision')
        .setLock('pessimistic_write')
        .where('revision.template_key = :templateKey', { templateKey })
        .andWhere('revision.locale = :locale', { locale })
        .andWhere('revision.status = :status', {
          status: EmailTemplateRevisionStatus.PUBLISHED,
        })
        .getOne();
      if (currentPublished) {
        currentPublished.status = EmailTemplateRevisionStatus.ARCHIVED;
        await repository.save(currentPublished);
      }

      const saved = await repository.save(
        repository.create({
          templateKey,
          locale,
          version: (latest?.version ?? 0) + 1,
          status: EmailTemplateRevisionStatus.PUBLISHED,
          subject: input.subject,
          text: input.text,
          html: input.html,
          createdByUserId: context.actor.userId,
          publishedByUserId: context.actor.userId,
          publishedAt: new Date(),
        }),
      );
      await this.auditLogService.record(manager, {
        action: AuditAction.EMAIL_TEMPLATE_PUBLISHED,
        actor: {
          type: AuditActorType.USER,
          userId: context.actor.userId,
          sessionId: context.actor.sessionId,
        },
        resourceId: saved.id,
        after: this.toAuditSnapshot(saved, EMAIL_TEMPLATE_CONTENT_FIELDS),
      });
      return this.toRevisionResponse(saved)!;
    });
  }

  private changedContentFields(
    revision: EmailTemplateRevision,
    input: SaveEmailTemplateDraftDto,
  ): EmailTemplateContentField[] {
    return EMAIL_TEMPLATE_CONTENT_FIELDS.filter(
      (field) => revision[field] !== input[field],
    );
  }

  private validateContent(
    templateKey: EmailTemplateKey,
    input: SaveEmailTemplateDraftDto,
  ): void {
    try {
      this.renderer.validateContent({ templateKey, ...input });
    } catch (error) {
      if (error instanceof EmailTemplateRenderError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }
  }

  private async lockTemplate(
    manager: EntityManager,
    templateKey: EmailTemplateKey,
    locale: EmailTemplateLocale,
  ): Promise<void> {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [templateKey, locale],
    );
  }

  private async recordDraftAudit(
    manager: EntityManager,
    context: AuthorizationContext,
    revision: EmailTemplateRevision,
    before: Record<string, unknown> | undefined,
    changedFields: readonly EmailTemplateContentField[],
  ): Promise<void> {
    await this.auditLogService.record(manager, {
      action: AuditAction.EMAIL_TEMPLATE_DRAFT_SAVED,
      actor: {
        type: AuditActorType.USER,
        userId: context.actor.userId,
        sessionId: context.actor.sessionId,
      },
      resourceId: revision.id,
      ...(before ? { before } : {}),
      after: this.toAuditSnapshot(revision, changedFields),
    });
  }

  private toAuditSnapshot(
    revision: EmailTemplateRevision,
    changedFields: readonly EmailTemplateContentField[],
    status: EmailTemplateRevisionStatus = revision.status,
  ): Record<string, unknown> {
    return {
      templateKey: revision.templateKey,
      locale: revision.locale,
      version: revision.version,
      status,
      changedFields: [...changedFields],
    };
  }

  private toRevisionResponse(
    revision: EmailTemplateRevision | null,
  ): EmailTemplateRevisionResponse | null {
    if (!revision) {
      return null;
    }

    return {
      id: revision.id,
      templateKey: revision.templateKey,
      locale: revision.locale,
      version: revision.version,
      status: revision.status,
      subject: revision.subject,
      text: revision.text,
      html: revision.html,
      createdByUserId: revision.createdByUserId,
      publishedByUserId: revision.publishedByUserId,
      publishedAt: revision.publishedAt,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
    };
  }
}
