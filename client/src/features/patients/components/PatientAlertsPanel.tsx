import { DataTable } from "@/components/shadcntable/data-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useCreatePatientAlertMutation,
  usePatientAlertsQuery,
  useResolvePatientAlertMutation,
  useUpdatePatientAlertMutation,
} from "@/features/patients/patients.hooks";
import {
  PATIENT_ALERT_CATEGORY_VISUALS,
  PATIENT_ALERT_SEVERITY_VISUALS,
} from "@/features/patients/patient-alert-visuals";
import type {
  PatientAlert,
  PatientAlertInput,
  ResolvePatientAlertReasonCode,
} from "@/features/patients/patients.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import { localeForLanguage } from "@/shared/lib/money";
import { cn } from "@/shared/lib/utils";
import {
  IconChevronDown,
  IconCircleCheck,
  IconInfoCircle,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconShieldCheck,
} from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type AlertFilter = "ACTIVE" | "RESOLVED" | "ALL";
type AlertCategory = PatientAlert["category"];
type AlertSeverity = PatientAlert["severity"];

const ALERT_FILTERS: AlertFilter[] = ["ACTIVE", "RESOLVED", "ALL"];
const ALERT_CATEGORIES: AlertCategory[] = [
  "ALLERGY",
  "MEDICAL_CONDITION",
  "MEDICATION",
  "OTHER",
];
const ALERT_SEVERITIES: AlertSeverity[] = ["INFO", "WARNING", "CRITICAL"];
const RESOLVE_REASON_CODES: ResolvePatientAlertReasonCode[] = [
  "NO_LONGER_APPLICABLE",
  "ENTERED_IN_ERROR",
  "DUPLICATE",
];
const ALERT_MESSAGE_MAX_LENGTH = 500;

const SEVERITY_FORM_VISUALS = {
  INFO: {
    iconClassName: "bg-blue-100 text-blue-600",
    selectedClassName: "border-blue-500 bg-blue-50/70 shadow-sm",
    radioClassName: "border-blue-500 bg-blue-500",
  },
  WARNING: {
    iconClassName: "bg-amber-100 text-amber-600",
    selectedClassName: "border-amber-500 bg-amber-50/70 shadow-sm",
    radioClassName: "border-amber-500 bg-amber-500",
  },
  CRITICAL: {
    iconClassName: "bg-red-100 text-red-600",
    selectedClassName: "border-red-500 bg-red-50/70 shadow-sm",
    radioClassName: "border-red-500 bg-red-500",
  },
} satisfies Record<
  AlertSeverity,
  {
    iconClassName: string;
    selectedClassName: string;
    radioClassName: string;
  }
>;

function CategoryLabel({ category }: { category: AlertCategory }) {
  const { t } = useTranslation("patients");
  const { Icon, className } = PATIENT_ALERT_CATEGORY_VISUALS[category];

  return (
    <div className="flex items-center gap-2.5" data-alert-category={category}>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg border",
          className,
        )}
        data-category-icon={category}
      >
        <Icon aria-hidden="true" size={18} stroke={2} />
      </span>
      <span className="text-sm font-medium text-foreground">
        {t(`detail.alerts.categories.${category}`)}
      </span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const { t } = useTranslation("patients");
  const { Icon, className } = PATIENT_ALERT_SEVERITY_VISUALS[severity];

  return (
    <Badge className={className} variant="outline">
      <Icon aria-hidden="true" stroke={2} />
      {t(`detail.alerts.severities.${severity}`)}
    </Badge>
  );
}

function StatusBadge({ resolved }: { resolved: boolean }) {
  const { t } = useTranslation("patients");

  return (
    <Badge
      className={cn(
        "border-transparent",
        resolved
          ? "bg-slate-100 text-slate-700"
          : "bg-emerald-100 text-emerald-700",
      )}
      variant="outline"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          resolved ? "bg-slate-500" : "bg-emerald-500",
        )}
      />
      {t(
        resolved
          ? "alertsManagement.statuses.RESOLVED"
          : "alertsManagement.statuses.ACTIVE",
      )}
    </Badge>
  );
}

function UpdateMetadata({
  alert,
  dateFormatter,
}: {
  alert: PatientAlert;
  dateFormatter: Intl.DateTimeFormat;
}) {
  const { t } = useTranslation("patients");

  return (
    <div className="space-y-0.5 text-xs leading-5 text-muted-foreground">
      <time dateTime={alert.updatedAt}>
        {dateFormatter.format(new Date(alert.updatedAt))}
      </time>
      <p>
        {t("alertsManagement.updatedBy", { name: alert.updatedBy.fullName })}
      </p>
    </div>
  );
}

function AlertActions({
  alert,
  onEdit,
  onResolve,
}: {
  alert: PatientAlert;
  onEdit: (alert: PatientAlert) => void;
  onResolve: (alert: PatientAlert) => void;
}) {
  const { t } = useTranslation("patients");

  if (alert.resolvedAt) return null;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={t("actions.edit")}
            onClick={() => onEdit(alert)}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <IconPencil aria-hidden="true" size={16} stroke={2} />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          {t("alertsManagement.editActionDescription")}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={t("alertsManagement.resolve")}
            className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={() => onResolve(alert)}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <IconCircleCheck aria-hidden="true" size={16} stroke={2} />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          {t("alertsManagement.resolveActionDescription")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function PatientAlertsPanel({
  branchSlug,
  patientId,
  tenantSlug,
  timeZone,
}: {
  branchSlug: string;
  patientId: string;
  tenantSlug: string;
  timeZone: string;
}) {
  const { i18n, t } = useTranslation("patients");
  const { t: tCommon } = useTranslation("common");
  const query = usePatientAlertsQuery(tenantSlug, branchSlug, patientId);
  const [filter, setFilter] = useState<AlertFilter>("ACTIVE");
  const [editing, setEditing] = useState<PatientAlert | null | undefined>();
  const [resolving, setResolving] = useState<PatientAlert | null>(null);
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }),
    [locale, timeZone],
  );
  const alerts = query.data?.items ?? [];
  const visibleAlerts = alerts.filter((alert) => {
    if (filter === "ACTIVE") return !alert.resolvedAt;
    if (filter === "RESOLVED") return Boolean(alert.resolvedAt);
    return true;
  });
  const emptyMessage =
    alerts.length === 0
      ? t("alertsManagement.empty")
      : filter === "ACTIVE"
        ? t("alertsManagement.emptyActive")
        : t("alertsManagement.emptyResolved");
  const dataTableLocale = useMemo(
    () => createDataTableLocale(tCommon),
    [tCommon],
  );
  const columns = useMemo<ColumnDef<PatientAlert>[]>(
    () => [
      {
        id: "category",
        header: () => t("alertsManagement.columns.category"),
        cell: ({ row }) => (
          <div className="min-w-36 py-1">
            <CategoryLabel category={row.original.category} />
          </div>
        ),
      },
      {
        id: "severity",
        header: () => t("alertsManagement.columns.severity"),
        cell: ({ row }) => (
          <div className="min-w-28 py-1">
            <SeverityBadge severity={row.original.severity} />
          </div>
        ),
      },
      {
        id: "message",
        header: () => t("alertsManagement.columns.message"),
        cell: ({ row }) => (
          <p className="min-w-56 max-w-md whitespace-pre-wrap break-words py-1 text-sm leading-5 text-foreground">
            {row.original.message}
          </p>
        ),
      },
      {
        id: "updated",
        header: () => t("alertsManagement.columns.updated"),
        cell: ({ row }) => (
          <div className="min-w-36 py-1">
            <UpdateMetadata
              alert={row.original}
              dateFormatter={dateFormatter}
            />
          </div>
        ),
      },
      {
        id: "status",
        header: () => t("alertsManagement.columns.status"),
        cell: ({ row }) => (
          <div className="min-w-32 py-1">
            <StatusBadge resolved={Boolean(row.original.resolvedAt)} />
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => (
          <span className="block text-right">
            {t("alertsManagement.columns.actions")}
          </span>
        ),
        cell: ({ row }) => (
          <div className="min-w-18 py-1">
            <AlertActions
              alert={row.original}
              onEdit={setEditing}
              onResolve={setResolving}
            />
          </div>
        ),
      },
    ],
    [dateFormatter, t],
  );

  return (
    <TooltipProvider>
      <Card
        aria-labelledby="patient-alerts-title"
        className="overflow-hidden"
        role="region"
      >
        <CardHeader className="flex-row items-center justify-between gap-4 border-b p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700">
              <IconShieldCheck aria-hidden="true" size={22} stroke={2} />
            </span>
            <div className="min-w-0">
              <CardTitle id="patient-alerts-title">
                {t("alertsManagement.title")}
              </CardTitle>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {t("alertsManagement.description")}
              </p>
            </div>
          </div>
          <Button
            className="shrink-0"
            onClick={() => setEditing(null)}
            size="sm"
          >
            <IconPlus aria-hidden="true" size={16} stroke={2} />
            <span className="hidden sm:inline">
              {t("alertsManagement.add")}
            </span>
            <span className="sm:hidden">{t("alertsManagement.addShort")}</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 p-4 pt-4 sm:p-5 sm:pt-5">
          <div
            aria-label={t("alertsManagement.filters.label")}
            className="flex flex-wrap gap-2"
            role="group"
          >
            {ALERT_FILTERS.map((value) => (
              <Button
                aria-pressed={filter === value}
                className="h-9 px-4"
                key={value}
                onClick={() => setFilter(value)}
                size="sm"
                type="button"
                variant={filter === value ? "default" : "outline"}
              >
                {t(`alertsManagement.filters.${value}`)}
              </Button>
            ))}
          </div>

          {query.isError && (
            <Alert variant="destructive">{getErrorMessage(query.error)}</Alert>
          )}

          {!query.isError && (
            <DataTable
              columns={columns}
              data={visibleAlerts}
              emptyState={
                <div className="px-5 py-10 text-center">
                  <IconShieldCheck
                    aria-hidden="true"
                    className="mx-auto text-muted-foreground"
                    size={28}
                    stroke={1.8}
                  />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {emptyMessage}
                  </p>
                </div>
              }
              isFetching={query.isFetching}
              isLoading={query.isLoading}
              locale={dataTableLocale}
              mobileLayout="cards"
              pagination={{ enabled: false }}
              renderMobileItem={(alert) => (
                <article
                  className="rounded-xl border bg-card p-4"
                  data-alert-id={alert.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <CategoryLabel category={alert.category} />
                    <StatusBadge resolved={Boolean(alert.resolvedAt)} />
                  </div>
                  <div className="mt-3">
                    <SeverityBadge severity={alert.severity} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                    {alert.message}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
                    <UpdateMetadata
                      alert={alert}
                      dateFormatter={dateFormatter}
                    />
                    <AlertActions
                      alert={alert}
                      onEdit={setEditing}
                      onResolve={setResolving}
                    />
                  </div>
                </article>
              )}
              toolbar={{ search: false, viewOptions: false }}
            />
          )}
        </CardContent>

        {editing !== undefined && (
          <AlertFormDialog
            alert={editing}
            branchSlug={branchSlug}
            onClose={() => setEditing(undefined)}
            patientId={patientId}
            tenantSlug={tenantSlug}
          />
        )}
        {resolving && (
          <ResolveAlertDialog
            alert={resolving}
            branchSlug={branchSlug}
            onClose={() => setResolving(null)}
            patientId={patientId}
            tenantSlug={tenantSlug}
          />
        )}
      </Card>
    </TooltipProvider>
  );
}

function AlertFormDialog({
  alert,
  branchSlug,
  onClose,
  patientId,
  tenantSlug,
}: {
  alert: PatientAlert | null;
  branchSlug: string;
  onClose: () => void;
  patientId: string;
  tenantSlug: string;
}) {
  const { t } = useTranslation("patients");
  const [category, setCategory] = useState<PatientAlertInput["category"]>(
    alert?.category ?? "ALLERGY",
  );
  const [severity, setSeverity] = useState<PatientAlertInput["severity"]>(
    alert?.severity ?? "WARNING",
  );
  const [message, setMessage] = useState(alert?.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreatePatientAlertMutation();
  const updateMutation = useUpdatePatientAlertMutation();
  const pending = createMutation.isPending || updateMutation.isPending;
  const SelectedCategoryIcon = PATIENT_ALERT_CATEGORY_VISUALS[category].Icon;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    const input = { category, severity, message: message.trim() };
    setError(null);
    try {
      if (alert) {
        await updateMutation.mutateAsync({
          tenantSlug,
          branchSlug,
          patientId,
          alertId: alert.id,
          input,
          idempotencyKey: crypto.randomUUID(),
        });
      } else {
        await createMutation.mutateAsync({
          tenantSlug,
          branchSlug,
          patientId,
          input,
          idempotencyKey: crypto.randomUUID(),
        });
      }
      onClose();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl [&>[data-slot=dialog-close]]:top-5 [&>[data-slot=dialog-close]]:right-5">
        <form
          className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col overflow-hidden"
          onSubmit={submit}
        >
          <DialogHeader className="shrink-0 flex-row items-center gap-4 border-b px-5 py-5 pr-16 text-left sm:px-7 sm:py-6 sm:pr-16">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700 sm:size-14">
              <IconShieldCheck aria-hidden="true" size={28} stroke={2} />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-xl leading-tight font-semibold sm:text-2xl">
                {t(
                  alert
                    ? "alertsManagement.editTitle"
                    : "alertsManagement.createTitle",
                )}
              </DialogTitle>
              <DialogDescription className="text-sm leading-5 sm:text-base">
                {t("alertsManagement.formDescription")}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            {error && <Alert variant="destructive">{error}</Alert>}

            <div className="space-y-2.5">
              <Label className="text-sm font-semibold" htmlFor="alert-category">
                {t("alertsManagement.category")}
                <span aria-hidden="true" className="ml-1 text-red-500">
                  *
                </span>
              </Label>
              <div className="relative">
                <span
                  className={cn(
                    "pointer-events-none absolute top-1/2 left-3.5 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-lg border",
                    PATIENT_ALERT_CATEGORY_VISUALS[category].className,
                  )}
                >
                  <SelectedCategoryIcon
                    aria-hidden="true"
                    size={18}
                    stroke={2}
                  />
                </span>
                <select
                  className="h-13 w-full appearance-none rounded-xl border border-input bg-background pr-11 pl-14 text-sm font-medium shadow-xs outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pending}
                  id="alert-category"
                  onChange={(event) =>
                    setCategory(
                      event.target.value as PatientAlertInput["category"],
                    )
                  }
                  required
                  value={category}
                >
                  {ALERT_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {t(`detail.alerts.categories.${value}`)}
                    </option>
                  ))}
                </select>
                <IconChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground"
                  size={18}
                  stroke={2}
                />
              </div>
            </div>

            <fieldset className="space-y-2.5">
              <legend className="text-sm font-semibold">
                {t("alertsManagement.severity")}
                <span aria-hidden="true" className="ml-1 text-red-500">
                  *
                </span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {ALERT_SEVERITIES.map((value) => {
                  const { Icon } = PATIENT_ALERT_SEVERITY_VISUALS[value];
                  const visual = SEVERITY_FORM_VISUALS[value];
                  const selected = severity === value;

                  return (
                    <label
                      className={cn(
                        "relative flex min-h-40 cursor-pointer flex-col rounded-xl border bg-background p-4 transition-[border-color,background-color,box-shadow] hover:border-foreground/30 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30",
                        selected && visual.selectedClassName,
                        pending && "cursor-not-allowed opacity-60",
                      )}
                      key={value}
                    >
                      <input
                        checked={selected}
                        className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                        disabled={pending}
                        name="alert-severity"
                        onChange={() => setSeverity(value)}
                        required
                        type="radio"
                        value={value}
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute top-4 right-4 grid size-5 place-items-center rounded-full border-2 border-muted-foreground/40 bg-background",
                          selected && visual.radioClassName,
                        )}
                      >
                        {selected && (
                          <span className="size-2 rounded-full bg-white" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "grid size-11 place-items-center rounded-full",
                          visual.iconClassName,
                        )}
                      >
                        <Icon aria-hidden="true" size={25} stroke={2.1} />
                      </span>
                      <span className="mt-3 text-base font-semibold text-foreground">
                        {t(`detail.alerts.severities.${value}`)}
                      </span>
                      <span className="mt-1 text-sm leading-5 text-muted-foreground">
                        {t(`alertsManagement.severityDescriptions.${value}`)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2.5">
              <Label className="text-sm font-semibold" htmlFor="alert-message">
                {t("alertsManagement.message")}
                <span aria-hidden="true" className="ml-1 text-red-500">
                  *
                </span>
              </Label>
              <Textarea
                aria-describedby="alert-message-help alert-message-count"
                className="min-h-36 resize-y rounded-xl px-4 py-3 text-sm leading-6"
                disabled={pending}
                id="alert-message"
                maxLength={ALERT_MESSAGE_MAX_LENGTH}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("alertsManagement.messagePlaceholder")}
                required
                rows={5}
                value={message}
              />
              <div className="flex items-start justify-between gap-4 text-xs leading-5 text-muted-foreground sm:text-sm">
                <p id="alert-message-help">
                  {t("alertsManagement.messageHelp")}
                </p>
                <p className="shrink-0 tabular-nums" id="alert-message-count">
                  {t("alertsManagement.characterCount", {
                    count: message.length,
                    max: ALERT_MESSAGE_MAX_LENGTH,
                  })}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none bg-muted/20 px-5 py-4 sm:px-7">
            <Button
              disabled={pending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              {t("alertsManagement.cancel")}
            </Button>
            <Button
              aria-busy={pending}
              className="min-w-36"
              disabled={pending || !message.trim()}
              type="submit"
            >
              {pending ? (
                <IconLoader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <IconShieldCheck aria-hidden="true" />
              )}
              {t(
                alert
                  ? "alertsManagement.editSubmit"
                  : "alertsManagement.createSubmit",
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolveAlertDialog({
  alert,
  branchSlug,
  onClose,
  patientId,
  tenantSlug,
}: {
  alert: PatientAlert;
  branchSlug: string;
  onClose: () => void;
  patientId: string;
  tenantSlug: string;
}) {
  const { t } = useTranslation("patients");
  const [reasonCode, setReasonCode] = useState<ResolvePatientAlertReasonCode>(
    "NO_LONGER_APPLICABLE",
  );
  const [error, setError] = useState<string | null>(null);
  const mutation = useResolvePatientAlertMutation();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({
        tenantSlug,
        branchSlug,
        patientId,
        alertId: alert.id,
        reasonCode,
        idempotencyKey: crypto.randomUUID(),
      });
      onClose();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
      open
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl [&>[data-slot=dialog-close]]:top-5 [&>[data-slot=dialog-close]]:right-5">
        <form onSubmit={submit}>
          <DialogHeader className="flex-row items-center gap-4 border-b px-5 py-5 pr-16 text-left sm:px-7 sm:py-6 sm:pr-16">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700 sm:size-14">
              <IconCircleCheck aria-hidden="true" size={29} stroke={2.1} />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-xl leading-tight font-semibold">
                {t("alertsManagement.resolveTitle")}
              </DialogTitle>
              <DialogDescription className="leading-5">
                {t("alertsManagement.resolveDescription")}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
            {error && <Alert variant="destructive">{error}</Alert>}

            <div className="space-y-2.5">
              <Label className="text-sm font-semibold" htmlFor="resolve-reason">
                {t("alertsManagement.reason")}
                <span aria-hidden="true" className="ml-1 text-red-500">
                  *
                </span>
              </Label>
              <Select
                disabled={mutation.isPending}
                onValueChange={(value) =>
                  setReasonCode(value as ResolvePatientAlertReasonCode)
                }
                required
                value={reasonCode}
              >
                <SelectTrigger
                  className="h-13 rounded-xl px-4 text-base shadow-xs"
                  id="resolve-reason"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOLVE_REASON_CODES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`alertsManagement.reasons.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm leading-5 text-slate-600">
              <IconInfoCircle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-slate-500"
                size={20}
                stroke={2}
              />
              <p>{t("alertsManagement.resolveNotice")}</p>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-none bg-muted/20 px-5 py-4 sm:px-7">
            <Button
              disabled={mutation.isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              {t("alertsManagement.cancel")}
            </Button>
            <Button
              aria-busy={mutation.isPending}
              className="min-w-32"
              disabled={mutation.isPending}
              type="submit"
            >
              {mutation.isPending ? (
                <IconLoader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <IconCircleCheck aria-hidden="true" />
              )}
              {t("alertsManagement.resolve")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
