export type EmailTemplateRevisionStatus =
  | "ARCHIVED"
  | "DRAFT"
  | "PUBLISHED";

export type EmailTemplateRevision = {
  id: string;
  templateKey: string;
  locale: string;
  version: number;
  status: EmailTemplateRevisionStatus;
  subject: string;
  text: string;
  html: string;
  createdByUserId: string | null;
  publishedByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailTemplateContent = Pick<
  EmailTemplateRevision,
  "subject" | "text" | "html"
>;

export type EmailTemplateLocaleEntry = {
  templateKey: string;
  locale: string;
  draft: EmailTemplateRevision | null;
  published: EmailTemplateRevision | null;
};

export type EmailTemplateDetail = EmailTemplateLocaleEntry & {
  revisions: EmailTemplateRevision[];
};

export type EmailTemplateGroup = {
  templateKey: string;
  locales: EmailTemplateLocaleEntry[];
  latestUpdatedAt: string | null;
};

const localeOrder = ["vi", "en"];

function compareLocales(
  left: EmailTemplateLocaleEntry,
  right: EmailTemplateLocaleEntry,
): number {
  const leftOrder = localeOrder.indexOf(left.locale);
  const rightOrder = localeOrder.indexOf(right.locale);

  if (leftOrder !== rightOrder) {
    return (leftOrder === -1 ? Number.MAX_SAFE_INTEGER : leftOrder) -
      (rightOrder === -1 ? Number.MAX_SAFE_INTEGER : rightOrder);
  }

  return left.locale.localeCompare(right.locale);
}

function latestRevisionUpdate(
  entry: EmailTemplateLocaleEntry,
): string | null {
  const timestamps = [entry.draft?.updatedAt, entry.published?.updatedAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps)).toISOString();
}

export function groupEmailTemplates(
  entries: EmailTemplateLocaleEntry[],
): EmailTemplateGroup[] {
  const grouped = new Map<string, EmailTemplateLocaleEntry[]>();

  entries.forEach((entry) => {
    const locales = grouped.get(entry.templateKey) ?? [];
    locales.push(entry);
    grouped.set(entry.templateKey, locales);
  });

  return [...grouped.entries()]
    .map(([templateKey, locales]) => {
      const timestamps = locales
        .map(latestRevisionUpdate)
        .filter((value): value is string => value !== null)
        .map((value) => new Date(value).getTime());

      return {
        templateKey,
        locales: [...locales].sort(compareLocales),
        latestUpdatedAt:
          timestamps.length > 0
            ? new Date(Math.max(...timestamps)).toISOString()
            : null,
      };
    })
    .sort((left, right) => left.templateKey.localeCompare(right.templateKey));
}
