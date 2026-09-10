import { pathFor } from "@/app/router/paths";
import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  groupEmailTemplates,
  type EmailTemplateGroup,
  type EmailTemplateLocaleEntry,
} from "@/features/email-templates/email-templates.types";
import { useEmailTemplatesQuery } from "@/features/email-templates/email-templates.hooks";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Mail, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

function formatLocale(locale: string, t: (key: string) => string): string {
  if (locale === "vi" || locale === "en") {
    return t(`locales.${locale}`);
  }

  return locale.toUpperCase();
}

function LocaleStatus({
  entry,
  t,
}: {
  entry: EmailTemplateLocaleEntry;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <Badge variant="outline">{formatLocale(entry.locale, t)}</Badge>
      <span>
        {entry.published
          ? t("status.publishedVersion", { version: entry.published.version })
          : t("status.noPublished")}
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        ·
      </span>
      <span className={entry.draft ? "font-medium text-primary" : undefined}>
        {entry.draft
          ? t("status.draftVersion", { version: entry.draft.version })
          : t("status.noDraft")}
      </span>
    </div>
  );
}

export function EmailTemplateManagementPage() {
  const { i18n, t } = useTranslation("emailTemplates");
  const { t: tCommon } = useTranslation("common");
  const templatesQuery = useEmailTemplatesQuery();
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "vi", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [i18n.resolvedLanguage],
  );
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("table.searchPlaceholder") },
      }),
    [t, tCommon],
  );
  const templates = useMemo(
    () => groupEmailTemplates(templatesQuery.data ?? []),
    [templatesQuery.data],
  );

  const columns = useMemo<ColumnDef<EmailTemplateGroup>[]>(
    () => [
      {
        id: "template",
        accessorFn: (template) =>
          `${t(`templateKeys.${template.templateKey}`, {
            defaultValue: template.templateKey,
          })} ${template.templateKey}`,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.columns.template")}
          />
        ),
        cell: ({ row }) => (
          <div className="min-w-52">
            <p className="font-semibold">
              {t(`templateKeys.${row.original.templateKey}`, {
                defaultValue: row.original.templateKey,
              })}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {row.original.templateKey}
            </p>
          </div>
        ),
      },
      {
        id: "localeStatus",
        accessorFn: (template) =>
          template.locales
            .map((entry) =>
              [
                entry.locale,
                entry.published ? "published" : "unpublished",
                entry.draft ? "draft" : "no-draft",
              ].join(" "),
            )
            .join(" "),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.columns.localeStatus")}
          />
        ),
        cell: ({ row }) => (
          <div className="min-w-72 space-y-2">
            {row.original.locales.map((entry) => (
              <LocaleStatus entry={entry} key={entry.locale} t={t} />
            ))}
          </div>
        ),
      },
      {
        id: "lastUpdatedAt",
        accessorFn: (template) =>
          template.latestUpdatedAt
            ? new Date(template.latestUpdatedAt).getTime()
            : 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.columns.lastUpdatedAt")}
          />
        ),
        cell: ({ row }) =>
          row.original.latestUpdatedAt
            ? dateTimeFormatter.format(new Date(row.original.latestUpdatedAt))
            : t("status.notAvailable"),
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => (
          <span className="sr-only">{t("table.columns.actions")}</span>
        ),
        cell: ({ row }) => (
          <Button asChild size="sm" type="button" variant="outline">
            <Link to={pathFor.platformEmailTemplateDetail(row.original.templateKey)}>
              {t("actions.viewDetail")}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ),
      },
    ],
    [dateTimeFormatter, t],
  );

  return (
    <div className="space-y-7">
      <div className="max-w-3xl space-y-2">
        <p className="text-sm font-semibold text-primary">DentFlow Platform</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          {t("description")}
        </p>
      </div>

      {templatesQuery.isError ? (
        <Alert
          className="flex flex-wrap items-center justify-between gap-3"
          variant="destructive"
        >
          <span>{getErrorMessage(templatesQuery.error)}</span>
          <Button
            onClick={() => void templatesQuery.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            {t("actions.retry")}
          </Button>
        </Alert>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/70">
            <div>
              <CardTitle>{t("catalogTitle")}</CardTitle>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("catalogDescription")}
              </p>
            </div>
            {templatesQuery.isFetching && !templatesQuery.isLoading && (
              <Spinner aria-label={t("loading")} />
            )}
          </CardHeader>
          <CardContent className="p-6">
            <DataTable
              columns={columns}
              data={templates}
              emptyState={
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Mail aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("empty.title")}</EmptyTitle>
                    <EmptyDescription>{t("empty.description")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
              isFetching={templatesQuery.isFetching}
              isLoading={templatesQuery.isLoading}
              locale={dataTableLocale}
              pagination={{ pageSize: 10, pageSizeOptions: [10, 25, 50] }}
              toolbar={{ search: true, viewOptions: false }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
