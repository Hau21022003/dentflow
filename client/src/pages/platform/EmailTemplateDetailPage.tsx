import { PATHS } from "@/app/router/paths";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { EmailTemplateEditor } from "@/features/email-templates/components/EmailTemplateEditor";
import {
  useEmailTemplateDetailQuery,
  useEmailTemplatesQuery,
} from "@/features/email-templates/email-templates.hooks";
import {
  groupEmailTemplates,
  type EmailTemplateLocaleEntry,
  type EmailTemplateRevision,
} from "@/features/email-templates/email-templates.types";
import { getErrorMessage } from "@/shared/lib/error";
import { cn } from "@/shared/lib/utils";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  useBeforeUnload,
  useBlocker,
  useParams,
} from "react-router-dom";

type DiscardTarget = "locale" | "navigation";

function formatLocale(locale: string, t: (key: string) => string): string {
  if (locale === "vi" || locale === "en") {
    return t(`locales.${locale}`);
  }

  return locale.toUpperCase();
}

function RevisionSummary({
  entry,
  formatter,
  t,
}: {
  entry: EmailTemplateLocaleEntry;
  formatter: Intl.DateTimeFormat;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const published = entry.published;
  const draft = entry.draft;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="rounded-lg border border-border/70 p-4">
        <p className="text-sm text-muted-foreground">
          {t("detail.publishedTitle")}
        </p>
        {published ? (
          <>
            <p className="mt-1 font-semibold">
              {t("detail.version", { version: published.version })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("detail.publishedAt", {
                date: formatter.format(
                  new Date(published.publishedAt ?? published.updatedAt),
                ),
              })}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-medium">{t("status.noPublished")}</p>
        )}
      </div>

      <div className="rounded-lg border border-border/70 p-4">
        <p className="text-sm text-muted-foreground">
          {t("detail.draftTitle")}
        </p>
        {draft ? (
          <>
            <p className="mt-1 font-semibold">
              {t("detail.version", { version: draft.version })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("detail.updatedAt", {
                date: formatter.format(new Date(draft.updatedAt)),
              })}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-medium">{t("status.noDraft")}</p>
        )}
      </div>
    </div>
  );
}

function RevisionHistory({
  formatter,
  revisions,
  t,
}: {
  formatter: Intl.DateTimeFormat;
  revisions: EmailTemplateRevision[];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <CardTitle>{t("history.title")}</CardTitle>
        <CardDescription>{t("history.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        {revisions.map((revision) => (
          <details
            className="rounded-lg border border-border/70 p-4"
            key={revision.id}
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                {t("detail.version", { version: revision.version })}
                <Badge
                  variant={
                    revision.status === "PUBLISHED" ? "default" : "secondary"
                  }
                >
                  {t(`history.status.${revision.status}`)}
                </Badge>
              </span>
              <span className="text-sm text-muted-foreground">
                {formatter.format(new Date(revision.updatedAt))}
              </span>
            </summary>
            <div className="mt-4 grid gap-4 border-t border-border/70 pt-4">
              <RevisionSource
                label={t("editor.fields.subject")}
                value={revision.subject}
              />
              <RevisionSource
                label={t("editor.fields.text")}
                value={revision.text}
              />
              <RevisionSource
                label={t("editor.fields.html")}
                value={revision.html}
              />
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}

function RevisionSource({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs text-foreground">
        {value}
      </pre>
    </div>
  );
}

export function EmailTemplateDetailPage() {
  const { templateKey = "" } = useParams();
  const { i18n, t } = useTranslation("emailTemplates");
  const templatesQuery = useEmailTemplatesQuery();
  const [selectedLocale, setSelectedLocale] = useState("vi");
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget | null>(
    null,
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "vi", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [i18n.resolvedLanguage],
  );
  const template = useMemo(
    () =>
      groupEmailTemplates(templatesQuery.data ?? []).find(
        (item) => item.templateKey === templateKey,
      ),
    [templateKey, templatesQuery.data],
  );
  const activeLocale = template?.locales.some(
    (entry) => entry.locale === selectedLocale,
  )
    ? selectedLocale
    : (template?.locales[0]?.locale ?? "");
  const activeEntry = template?.locales.find(
    (entry) => entry.locale === activeLocale,
  );
  const detailQuery = useEmailTemplateDetailQuery(templateKey, activeLocale);
  const blocker = useBlocker(isEditorDirty);
  const isNavigationBlocked = blocker.state === "blocked";

  useBeforeUnload(
    (event) => {
      if (!isEditorDirty) return;
      event.preventDefault();
      event.returnValue = "";
    },
    { capture: true },
  );

  function requestLocaleChange(locale: string) {
    if (locale === activeLocale) return;
    if (!isEditorDirty) {
      setSelectedLocale(locale);
      return;
    }

    setPendingLocale(locale);
    setDiscardTarget("locale");
  }

  function keepEditing() {
    if (isNavigationBlocked) {
      blocker.reset();
    }
    setPendingLocale(null);
    setDiscardTarget(null);
  }

  function discardChanges() {
    const target: DiscardTarget | null = isNavigationBlocked
      ? "navigation"
      : discardTarget;
    setIsEditorDirty(false);
    setDiscardTarget(null);

    if (target === "locale" && pendingLocale) {
      setSelectedLocale(pendingLocale);
      setPendingLocale(null);
      return;
    }

    if (target === "navigation" && isNavigationBlocked) {
      blocker.proceed();
    }
  }

  if (templatesQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Spinner aria-label={t("loading")} />
      </div>
    );
  }

  if (templatesQuery.isError) {
    return (
      <div className="space-y-4">
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
        <Button asChild variant="outline">
          <Link to={PATHS.platformEmailTemplates}>{t("actions.backToList")}</Link>
        </Button>
      </div>
    );
  }

  if (!template || !activeEntry || !activeLocale) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">{t("errors.notFound")}</Alert>
        <Button asChild variant="outline">
          <Link to={PATHS.platformEmailTemplates}>{t("actions.backToList")}</Link>
        </Button>
      </div>
    );
  }

  const tabId = `email-template-tab-${template.templateKey}-${activeLocale}`;
  const panelId = `email-template-panel-${template.templateKey}-${activeLocale}`;

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <Button asChild size="sm" type="button" variant="ghost">
          <Link to={PATHS.platformEmailTemplates}>
            <ArrowLeft aria-hidden="true" />
            {t("actions.backToList")}
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t(`templateKeys.${template.templateKey}`, {
              defaultValue: template.templateKey,
            })}
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {template.templateKey}
          </p>
        </div>
      </div>

      <div
        aria-label={t("detail.localeTabsLabel")}
        className="flex flex-wrap gap-2 border-b border-border/70 pb-3"
        role="tablist"
      >
        {template.locales.map((entry) => {
          const isActive = entry.locale === activeLocale;
          const entryTabId = `email-template-tab-${template.templateKey}-${entry.locale}`;
          const entryPanelId = `email-template-panel-${template.templateKey}-${entry.locale}`;

          return (
            <button
              aria-controls={entryPanelId}
              aria-selected={isActive}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
              id={entryTabId}
              key={entry.locale}
              onClick={() => requestLocaleChange(entry.locale)}
              role="tab"
              type="button"
            >
              {formatLocale(entry.locale, t)}
              {entry.draft && <Badge variant="secondary">{t("status.draft")}</Badge>}
            </button>
          );
        })}
      </div>

      <section aria-labelledby={tabId} id={panelId} role="tabpanel">
        {detailQuery.isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Spinner aria-label={t("loading")} />
          </div>
        ) : detailQuery.isError ? (
          <Alert
            className="flex flex-wrap items-center justify-between gap-3"
            variant="destructive"
          >
            <span>{getErrorMessage(detailQuery.error)}</span>
            <Button
              onClick={() => void detailQuery.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              {t("actions.retry")}
            </Button>
          </Alert>
        ) : detailQuery.data ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="border-b border-border/70">
                <CardTitle>{formatLocale(activeEntry.locale, t)}</CardTitle>
                <CardDescription>{t("editor.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <RevisionSummary
                  entry={detailQuery.data}
                  formatter={dateTimeFormatter}
                  t={t}
                />
                <EmailTemplateEditor
                  detail={detailQuery.data}
                  key={`${templateKey}-${activeLocale}`}
                  locale={activeLocale}
                  onDirtyChange={setIsEditorDirty}
                  onServerStateChange={async () => {
                    await detailQuery.refetch();
                  }}
                  templateKey={templateKey}
                />
              </CardContent>
            </Card>
            <RevisionHistory
              formatter={dateTimeFormatter}
              revisions={detailQuery.data.revisions}
              t={t}
            />
          </div>
        ) : (
          <Alert variant="destructive">{t("errors.notFound")}</Alert>
        )}
      </section>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) keepEditing();
        }}
        open={discardTarget === "locale" || isNavigationBlocked}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discardDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("discardDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t("discardDialog.keepEditing")}</AlertDialogCancel>
            <Button onClick={discardChanges} type="button" variant="destructive">
              {t("discardDialog.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
