import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePatientTreatmentPlansQuery,
} from "@/features/patients/patients.hooks";
import type {
  PatientTreatmentPlanListItem,
  PatientTreatmentPlanListQuery,
  SortOrder,
} from "@/features/patients/patients.types";
import {
  TREATMENT_PLAN_STATUSES,
  type TreatmentPlanStatus,
} from "@/features/treatment-plans/treatment-plans.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import { formatMinorAmount } from "@/shared/lib/money";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  ChevronRight,
  ClipboardList,
  RotateCcw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PatientTreatmentPlanSheet } from "./PatientTreatmentPlanSheet";
import { PatientTreatmentPlanStatusBadge } from "./PatientTreatmentPlanStatusBadge";

const ALL = "__all__";
const PAGE_SIZE_OPTIONS = [20, 50, 100];

type Props = {
  branchSlug: string;
  locale: string;
  patientId: string;
  tenantSlug: string;
  timeZone: string;
};

function PlanIdentity({
  plan,
  fallbackName,
}: {
  plan: PatientTreatmentPlanListItem;
  fallbackName: string;
}) {
  const description =
    plan.primaryItem?.indication ?? plan.primaryItem?.toothPosition;

  return (
    <div className="min-w-44">
      <p className="font-semibold">
        {plan.primaryItem?.serviceName ?? fallbackName}
      </p>
      <p className="text-xs font-medium text-muted-foreground">{plan.code}</p>
      {description && (
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

function PlannedDentists({
  dentists,
  notProvided,
}: {
  dentists: PatientTreatmentPlanListItem["plannedDentists"];
  notProvided: string;
}) {
  const first = dentists[0];
  if (!first) return <span className="text-muted-foreground">{notProvided}</span>;

  return (
    <div className="flex min-w-32 items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
        {first.fullName
          .trim()
          .split(/\s+/)
          .slice(-2)
          .map((part) => Array.from(part)[0] ?? "")
          .join("")
          .toUpperCase()}
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
  progress,
}: {
  progress: PatientTreatmentPlanListItem["progress"];
}) {
  const percentage = progress.totalItems
    ? Math.round((progress.completedItems / progress.totalItems) * 100)
    : 0;

  return (
    <div className="flex min-w-28 items-center gap-2">
      <div
        aria-hidden="true"
        className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="shrink-0 text-sm tabular-nums">
        {progress.completedItems}/{progress.totalItems}
      </span>
    </div>
  );
}

function PlanTotals({
  locale,
  totals,
}: {
  locale: string;
  totals: PatientTreatmentPlanListItem["totals"];
}) {
  if (!totals.length) {
    return <span className="text-muted-foreground">—</span>;
  }

  return totals.map((total) => (
    <span className="block whitespace-nowrap" key={total.currency}>
      {formatMinorAmount(total.amount, total.currency, locale)}
    </span>
  ));
}

export function PatientTreatmentPlansTab({
  branchSlug,
  locale,
  patientId,
  tenantSlug,
  timeZone,
}: Props) {
  const { t } = useTranslation("patients");
  const { t: tCommon } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [dentistId, setDentistId] = useState<string>(ALL);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const detailId = searchParams.get("planId");
  const sortOrder: SortOrder = sorting[0]?.desc === false ? "ASC" : "DESC";

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(globalFilter.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const query = useMemo<PatientTreatmentPlanListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      sortBy: "createdAt",
      sortOrder,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== ALL ? { status: status as TreatmentPlanStatus } : {}),
      ...(dentistId !== ALL ? { dentistUserId: dentistId } : {}),
    }),
    [debouncedSearch, dentistId, pagination, sortOrder, status],
  );
  const plansQuery = usePatientTreatmentPlansQuery(
    tenantSlug,
    branchSlug,
    patientId,
    query,
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }),
    [locale, timeZone],
  );
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        columnHeader: {
          sortAscending: t("detail.treatmentPlans.sortOldest"),
          sortDescending: t("detail.treatmentPlans.sortNewest"),
        },
      }),
    [t, tCommon],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function clearFilters() {
    setGlobalFilter("");
    setDebouncedSearch("");
    setStatus(ALL);
    setDentistId(ALL);
    resetToFirstPage();
  }

  const openDetail = useCallback(
    (planId: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("tab", "treatment-plans");
      params.set("planId", planId);
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  function closeDetail() {
    const params = new URLSearchParams(searchParams);
    params.delete("planId");
    setSearchParams(params, { replace: true });
  }

  const columns = useMemo<ColumnDef<PatientTreatmentPlanListItem>[]>(
    () => [
      {
        id: "plan",
        header: () => t("detail.treatmentPlans.columns.plan"),
        cell: ({ row }) => (
          <PlanIdentity
            fallbackName={t("detail.treatment.fallbackName")}
            plan={row.original}
          />
        ),
      },
      {
        id: "dentists",
        header: () => t("detail.treatmentPlans.columns.dentist"),
        cell: ({ row }) => (
          <PlannedDentists
            dentists={row.original.plannedDentists}
            notProvided={t("table.notProvided")}
          />
        ),
      },
      {
        id: "visit",
        header: () => t("detail.treatmentPlans.columns.visit"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm font-medium">
            {t("detail.treatmentPlans.visitLabel", {
              date: dateFormatter.format(
                new Date(row.original.originVisit.startedAt),
              ),
            })}
          </span>
        ),
      },
      {
        id: "createdAt",
        accessorFn: (plan) => plan.createdAt,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("detail.treatmentPlans.columns.createdAt")}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {dateFormatter.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
      {
        id: "status",
        header: () => t("detail.treatmentPlans.columns.status"),
        cell: ({ row }) => (
          <PatientTreatmentPlanStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "progress",
        header: () => t("detail.treatmentPlans.columns.progress"),
        cell: ({ row }) => <PlanProgress progress={row.original.progress} />,
      },
      {
        id: "total",
        header: () => t("detail.treatmentPlans.columns.total"),
        cell: ({ row }) => (
          <span className="font-medium">
            <PlanTotals locale={locale} totals={row.original.totals} />
          </span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => t("detail.treatmentPlans.columns.actions"),
        cell: ({ row }) => (
          <Button
            onClick={(event) => {
              event.stopPropagation();
              openDetail(row.original.id);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("detail.treatmentPlans.viewDetails")}
            <ChevronRight aria-hidden="true" />
          </Button>
        ),
      },
    ],
    [dateFormatter, locale, openDetail, t],
  );

  const hasActiveFilters = Boolean(
    globalFilter.trim() || status !== ALL || dentistId !== ALL,
  );
  const selectedPlan = plansQuery.data?.items.find(
    (plan) => plan.id === detailId,
  );

  return (
    <>
      <Card>
        <CardHeader className="border-b p-5">
          <CardTitle>{t("detail.treatmentPlans.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("detail.treatmentPlans.description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1.4fr)_minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_auto]">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label={t("detail.treatmentPlans.searchPlaceholder")}
                className="pl-9"
                disabled={plansQuery.isLoading}
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                  resetToFirstPage();
                }}
                placeholder={t("detail.treatmentPlans.searchPlaceholder")}
                value={globalFilter}
              />
            </div>
            <Select
              disabled={plansQuery.isLoading}
              onValueChange={(value) => {
                setStatus(value);
                resetToFirstPage();
              }}
              value={status}
            >
              <SelectTrigger
                aria-label={t("detail.treatmentPlans.allStatuses")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>
                  {t("detail.treatmentPlans.allStatuses")}
                </SelectItem>
                {TREATMENT_PLAN_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`detail.planStatuses.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              disabled={plansQuery.isLoading}
              onValueChange={(value) => {
                setDentistId(value);
                resetToFirstPage();
              }}
              value={dentistId}
            >
              <SelectTrigger
                aria-label={t("detail.treatmentPlans.allDentists")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>
                  {t("detail.treatmentPlans.allDentists")}
                </SelectItem>
                {(plansQuery.data?.filterOptions.dentists ?? []).map(
                  (dentist) => (
                    <SelectItem key={dentist.id} value={dentist.id}>
                      {dentist.fullName}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Button
              disabled={!hasActiveFilters || plansQuery.isLoading}
              onClick={clearFilters}
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" />
              {t("detail.treatmentPlans.clearFilters")}
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={plansQuery.data?.items ?? []}
            emptyState={
              plansQuery.isError ? (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ClipboardList aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>
                      {t("detail.treatmentPlans.loadErrorTitle")}
                    </EmptyTitle>
                    <EmptyDescription>
                      {getErrorMessage(plansQuery.error)}
                    </EmptyDescription>
                    <Button
                      onClick={() => void plansQuery.refetch()}
                      size="sm"
                      type="button"
                    >
                      {t("actions.retry")}
                    </Button>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ClipboardList aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>
                      {t(
                        hasActiveFilters
                          ? "detail.treatmentPlans.noResults.title"
                          : "detail.treatmentPlans.empty.title",
                      )}
                    </EmptyTitle>
                    <EmptyDescription>
                      {t(
                        hasActiveFilters
                          ? "detail.treatmentPlans.noResults.description"
                          : "detail.treatmentPlans.empty.description",
                      )}
                    </EmptyDescription>
                    {hasActiveFilters && (
                      <Button onClick={clearFilters} size="sm" type="button">
                        {t("detail.treatmentPlans.clearFilters")}
                      </Button>
                    )}
                  </EmptyHeader>
                </Empty>
              )
            }
            isFetching={plansQuery.isFetching}
            isLoading={plansQuery.isLoading}
            locale={dataTableLocale}
            onRowClick={(plan) => openDetail(plan.id)}
            pagination={{
              manual: true,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              rowCount: plansQuery.data?.meta.total ?? 0,
              onPaginationChange: (next) =>
                setPagination((current) => ({
                  pageIndex:
                    next.pageSize === current.pageSize ? next.pageIndex : 0,
                  pageSize: next.pageSize,
                })),
            }}
            renderMobileItem={(plan) => (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <PlanIdentity
                    fallbackName={t("detail.treatment.fallbackName")}
                    plan={plan}
                  />
                  <PatientTreatmentPlanStatusBadge status={plan.status} />
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">
                      {t("detail.treatmentPlans.columns.dentist")}
                    </p>
                    <PlannedDentists
                      dentists={plan.plannedDentists}
                      notProvided={t("table.notProvided")}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {t("detail.treatmentPlans.columns.visit")}
                    </p>
                    <p className="font-medium">
                      {t("detail.treatmentPlans.visitLabel", {
                        date: dateFormatter.format(
                          new Date(plan.originVisit.startedAt),
                        ),
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {t("detail.treatmentPlans.columns.progress")}
                    </p>
                    <PlanProgress progress={plan.progress} />
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {t("detail.treatmentPlans.columns.total")}
                    </p>
                    <p className="font-medium">
                      <PlanTotals locale={locale} totals={plan.totals} />
                    </p>
                  </div>
                </div>
                <Button
                  onClick={(event) => {
                    event.stopPropagation();
                    openDetail(plan.id);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("detail.treatmentPlans.viewDetails")}
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            )}
            serverState={{
              sorting: {
                value: sorting,
                onChange: (next) => {
                  setSorting(next);
                  resetToFirstPage();
                },
              },
            }}
            toolbar={{ search: false, viewOptions: false }}
          />
        </CardContent>
      </Card>

      <PatientTreatmentPlanSheet
        branchSlug={branchSlug}
        onOpenChange={(open) => !open && closeDetail()}
        open={Boolean(detailId)}
        patientId={patientId}
        planCode={selectedPlan?.code}
        planId={detailId}
        tenantSlug={tenantSlug}
      />
    </>
  );
}
