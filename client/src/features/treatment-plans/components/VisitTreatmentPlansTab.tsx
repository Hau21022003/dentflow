import { pathFor } from "@/app/router/paths";
import { DataTable } from "@/components/shadcntable/data-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { PatientTreatmentPlanStatusBadge } from "@/features/patients/components/PatientTreatmentPlanStatusBadge";
import {
  useCreateTreatmentPlanMutation,
  useTreatmentPlansQuery,
} from "@/features/treatment-plans/treatment-plans.hooks";
import {
  TREATMENT_PLAN_STATUSES,
  type TreatmentPlanListItem,
  type TreatmentPlanListQuery,
  type TreatmentPlanStatus,
} from "@/features/treatment-plans/treatment-plans.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { formatMinorAmount } from "@/shared/lib/money";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, ClipboardList, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const ALL_STATUSES = "__all__";
const PAGE_SIZE_OPTIONS = [10, 20, 50];

type Props = {
  appointmentId: string;
  branchSlug: string;
  date: string;
  tenantSlug: string;
  visitId: string;
};

function planSummary(plan: TreatmentPlanListItem, fallback: string): string {
  const first = plan.items[0];
  if (!first) return fallback;
  return plan.items.length > 1
    ? `${first.serviceName} +${plan.items.length - 1}`
    : first.serviceName;
}

function completedItemCount(plan: TreatmentPlanListItem): number {
  return plan.items.filter((item) => item.status === "COMPLETED").length;
}

function dentistInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}

function PlannedDentists({
  dentists,
  notAssigned,
}: {
  dentists: TreatmentPlanListItem["plannedDentists"];
  notAssigned: string;
}) {
  const first = dentists[0];
  if (!first) {
    return <span className="text-sm text-muted-foreground">{notAssigned}</span>;
  }

  return (
    <div className="flex min-w-36 items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {dentistInitials(first.fullName)}
      </span>
      <span className="line-clamp-2 text-sm font-medium">{first.fullName}</span>
      {dentists.length > 1 && (
        <Badge className="shrink-0" variant="secondary">
          +{dentists.length - 1}
        </Badge>
      )}
    </div>
  );
}

function PlanProgress({
  completed,
  label,
  total,
}: {
  completed: number;
  label: string;
  total: number;
}) {
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex min-w-28 items-center gap-2">
      <div
        aria-label={label}
        aria-valuemax={total}
        aria-valuemin={0}
        aria-valuenow={completed}
        className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums">
        {completed}/{total}
      </span>
    </div>
  );
}

function PlanTotals({
  locale,
  plan,
}: {
  locale: string;
  plan: TreatmentPlanListItem;
}) {
  const totals = new Map<string, number>();
  for (const item of plan.items) {
    totals.set(
      item.currency,
      (totals.get(item.currency) ?? 0) + item.finalUnitAmount * item.quantity,
    );
  }

  if (!totals.size) {
    return <span className="text-muted-foreground">—</span>;
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => (
      <span className="block whitespace-nowrap" key={currency}>
        {formatMinorAmount(amount, currency, locale)}
      </span>
    ));
}

export function VisitTreatmentPlansTab({
  appointmentId,
  branchSlug,
  date,
  tenantSlug,
  visitId,
}: Props) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const scope = { tenantSlug, branchSlug, visitId };
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [createIntent, setCreateIntent] = useState<IdempotencyIntent | null>(
    null,
  );
  const [createError, setCreateError] = useState("");
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = useMemo<TreatmentPlanListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== ALL_STATUSES
        ? { status: status as TreatmentPlanStatus }
        : {}),
    }),
    [debouncedSearch, pagination, status],
  );
  const plans = useTreatmentPlansQuery(scope, query);
  const create = useCreateTreatmentPlanMutation();
  const dataTableLocale = useMemo(
    () => createDataTableLocale(tCommon),
    [tCommon],
  );
  const hasActiveFilters = Boolean(search.trim() || status !== ALL_STATUSES);

  const openDetail = useCallback(
    (planId: string) => {
      navigate(
        pathFor.workspaceDoctorTreatmentPlan(
          tenantSlug,
          branchSlug,
          appointmentId,
          planId,
          date,
        ),
      );
    },
    [appointmentId, branchSlug, date, navigate, tenantSlug],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  async function createDraft() {
    setCreateError("");
    try {
      const intent = idempotencyKeyForIntent(createIntent, {
        operation: "clinical.treatment-plan.create",
        ...scope,
      });
      setCreateIntent(intent);
      const plan = await create.mutateAsync({
        ...scope,
        idempotencyKey: intent.key,
      });
      setCreateIntent(null);
      openDetail(plan.id);
    } catch (error) {
      handleApiError({ error, onMessage: setCreateError });
    }
  }

  const columns = useMemo<ColumnDef<TreatmentPlanListItem>[]>(
    () => [
      {
        id: "plan",
        header: () => t("visitList.columns.plan"),
        cell: ({ row }) => {
          const first = row.original.items[0];
          return (
            <div className="min-w-48 max-w-72">
              <p className="font-semibold">{row.original.code}</p>
              <p className="mt-0.5 truncate text-sm font-medium">
                {planSummary(row.original, t("visitList.noItems"))}
              </p>
              {first && (first.indication || first.toothPosition) && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {first.indication ??
                    t("visitList.toothPositionValue", {
                      position: first.toothPosition,
                    })}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "dentists",
        header: () => t("visitList.columns.dentist"),
        cell: ({ row }) => (
          <PlannedDentists
            dentists={row.original.plannedDentists}
            notAssigned={t("visitList.notAssigned")}
          />
        ),
      },
      {
        id: "status",
        header: () => t("visitList.columns.status"),
        cell: ({ row }) => (
          <PatientTreatmentPlanStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "progress",
        header: () => t("visitList.columns.progress"),
        cell: ({ row }) => {
          const completed = completedItemCount(row.original);
          const total = row.original.items.length;
          return (
            <PlanProgress
              completed={completed}
              label={t("visitList.progress", { completed, total })}
              total={total}
            />
          );
        },
      },
      {
        id: "cost",
        header: () => t("visitList.columns.cost"),
        cell: ({ row }) => (
          <span className="text-sm font-semibold">
            <PlanTotals locale={locale} plan={row.original} />
          </span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => t("visitList.columns.actions"),
        cell: ({ row }) => (
          <Button
            onClick={() => openDetail(row.original.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("visitList.openDetail")}
            <ChevronRight aria-hidden="true" />
          </Button>
        ),
      },
    ],
    [locale, openDetail, t],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch justify-between gap-4 border-b p-5 sm:flex-row sm:items-start">
        <div>
          <CardTitle>{t("visitList.title")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("visitList.description")}
          </p>
        </div>
        <Button
          className="shrink-0"
          disabled={create.isPending}
          onClick={() => void createDraft()}
          type="button"
        >
          {create.isPending ? <Spinner /> : <Plus aria-hidden="true" />}
          {t("actions.createPlan")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {createError && <Alert variant="destructive">{createError}</Alert>}

        <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_minmax(12rem,14rem)]">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={t("visitList.searchPlaceholder")}
              className="pl-9"
              disabled={plans.isLoading}
              onChange={(event) => {
                setSearch(event.target.value);
                resetToFirstPage();
              }}
              placeholder={t("visitList.searchPlaceholder")}
              value={search}
            />
          </div>
          <Select
            disabled={plans.isLoading}
            onValueChange={(value) => {
              setStatus(value);
              resetToFirstPage();
            }}
            value={status}
          >
            <SelectTrigger aria-label={t("visitList.allStatuses")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>
                {t("visitList.allStatuses")}
              </SelectItem>
              {TREATMENT_PLAN_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`statuses.plan.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={plans.data?.items ?? []}
          emptyState={
            <div className="grid place-items-center gap-2 py-10 text-center">
              <ClipboardList className="size-8 text-muted-foreground" />
              <p className="font-medium">
                {plans.isError
                  ? t("errors.plansLoad")
                  : t(hasActiveFilters ? "visitList.noResults" : "empty")}
              </p>
              {plans.isError && (
                <Button
                  onClick={() => void plans.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("visitList.retry")}
                </Button>
              )}
            </div>
          }
          isFetching={plans.isFetching}
          isLoading={plans.isLoading}
          locale={dataTableLocale}
          pagination={{
            manual: true,
            pageIndex: pagination.pageIndex,
            pageSize: pagination.pageSize,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            rowCount: plans.data?.meta.total ?? 0,
            onPaginationChange: (next) =>
              setPagination((current) => ({
                pageIndex:
                  next.pageSize === current.pageSize ? next.pageIndex : 0,
                pageSize: next.pageSize,
              })),
          }}
          renderMobileItem={(plan) => {
            const completed = completedItemCount(plan);
            const total = plan.items.length;
            const first = plan.items[0];
            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{plan.code}</p>
                    <p className="truncate text-sm font-medium">
                      {planSummary(plan, t("visitList.noItems"))}
                    </p>
                    {first && (first.indication || first.toothPosition) && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {first.indication ??
                          t("visitList.toothPositionValue", {
                            position: first.toothPosition,
                          })}
                      </p>
                    )}
                  </div>
                  <PatientTreatmentPlanStatusBadge status={plan.status} />
                </div>
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t("visitList.columns.dentist")}
                    </p>
                    <PlannedDentists
                      dentists={plan.plannedDentists}
                      notAssigned={t("visitList.notAssigned")}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t("visitList.columns.cost")}
                    </p>
                    <p className="font-semibold">
                      <PlanTotals locale={locale} plan={plan} />
                    </p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-muted-foreground">
                      {t("visitList.columns.progress")}
                    </p>
                    <PlanProgress
                      completed={completed}
                      label={t("visitList.progress", { completed, total })}
                      total={total}
                    />
                  </div>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => openDetail(plan.id)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("visitList.openDetail")}
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            );
          }}
          toolbar={{ search: false, viewOptions: false }}
        />
      </CardContent>
    </Card>
  );
}
