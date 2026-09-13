import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";

import type {
  EmailTemplateContent,
  EmailTemplateDetail,
  EmailTemplateLocaleEntry,
  EmailTemplateRevision,
} from "./email-templates.types";

export type EmailTemplateContentCommand = IdempotentCommand & {
  templateKey: string;
  locale: string;
  input: EmailTemplateContent;
};

export type PublishEmailTemplateDraftCommand = IdempotentCommand & {
  templateKey: string;
  locale: string;
};

function detailPath(templateKey: string, locale: string): string {
  return `/platform/email-templates/${encodeURIComponent(templateKey)}/${encodeURIComponent(locale)}`;
}

export const emailTemplatesService = {
  async list(): Promise<EmailTemplateLocaleEntry[]> {
    const { payload } = await http.get<EmailTemplateLocaleEntry[]>(
      "/platform/email-templates",
    );

    return payload;
  },

  async get(templateKey: string, locale: string): Promise<EmailTemplateDetail> {
    const { payload } = await http.get<EmailTemplateDetail>(
      detailPath(templateKey, locale),
    );

    return payload;
  },

  async saveDraft({
    templateKey,
    locale,
    input,
    idempotencyKey,
  }: EmailTemplateContentCommand): Promise<EmailTemplateRevision> {
    const { payload } = await http.put<EmailTemplateRevision>(
      `${detailPath(templateKey, locale)}/draft`,
      input,
      { idempotencyKey },
    );

    return payload;
  },

  async publishDirect({
    templateKey,
    locale,
    input,
    idempotencyKey,
  }: EmailTemplateContentCommand): Promise<EmailTemplateRevision> {
    const { payload } = await http.post<EmailTemplateRevision>(
      `${detailPath(templateKey, locale)}/publish`,
      input,
      { idempotencyKey },
    );

    return payload;
  },

  async publishDraft({
    templateKey,
    locale,
    idempotencyKey,
  }: PublishEmailTemplateDraftCommand): Promise<EmailTemplateRevision> {
    const { payload } = await http.post<EmailTemplateRevision>(
      `${detailPath(templateKey, locale)}/draft/publish`,
      undefined,
      { idempotencyKey },
    );

    return payload;
  },
};
