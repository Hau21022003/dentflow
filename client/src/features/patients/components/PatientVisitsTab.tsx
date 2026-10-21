import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  addDaysInTimeZone,
  formatAppointmentTime,
  fromAppointmentDateAndTime,
} from "@/features/appointments/appointment-time";
import { usePatientVisitsQuery } from "@/features/patients/patients.hooks";
import type {
  PatientVisitListItem,
  PatientVisitListQuery,
  SortOrder,
} from "@/features/patients/patients.types";
import type { VisitStatus } from "@/features/visits/visits.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Stethoscope,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DateRange } from "react-day-picker";

const ALL = "__all__";
const VISIT_STATUSES: VisitStatus[] = ["OPEN", "COMPLETED"];
const PAGE_SIZE_OPTIONS = [20, 50, 100];

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type Props = {
  branchSlug: string;
  locale: string;
  patientId: string;
  tenantSlug: string;
  timeZone: string;
};

type SummaryCardProps = {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  tone: "blue" | "emerald" | "orange";
  value: number;
};

const summaryTone = {
  blue: "bg-blue-100 text-blue-700",
  emerald: "bg-emerald-100 text-emerald-700",
  orange: "bg-orange-100 text-orange-700",
} as const;

function SummaryCard({ icon, label, loading, tone, value }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full ${summaryTone[tone]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-12 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VisitStatusBadge({
  label,
  status,
}: {
  label: string;
  status: VisitStatus;
}) {
  return (
    <Badge
      className={
        status === "COMPLETED"
          ? "border-emerald-200 bg-emerald-100 text-emerald-800"
          : "border-orange-200 bg-orange-100 text-orange-800"
      }
      variant="outline"
    >
      {status === "COMPLETED" ? (
        <CheckCircle2 aria-hidden="true" />
      ) : (
        <Clock3 aria-hidden="true" />
      )}
      {label}
    </Badge>
  );
}

function VisitDateTime({
  dateFormatter,
  inProgressLabel,
  locale,
  notProvided,
  timeZone,
  visit,
}: {
  dateFormatter: Intl.DateTimeFormat;
  inProgressLabel: string;
  locale: string;
  notProvided: string;
  timeZone: string;
  visit: PatientVisitListItem;
}) {
  if (!visit.startedAt) {
    return <span className="text-muted-foreground">{notProvided}</span>;
  }

  const startedAt = new Date(visit.startedAt);
  const completedAt = visit.completedAt ? new Date(visit.completedAt) : null;
  const hasValidCompletedAt =
    visit.status === "COMPLETED" &&
    completedAt !== null &&
    completedAt.getTime() >= startedAt.getTime();

  return (
    <div className="min-w-32">
      <p className="font-medium">{dateFormatter.format(startedAt)}</p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {formatAppointmentTime(visit.startedAt, timeZone, locale)}
        {hasValidCompletedAt
          ? ` – ${formatAppointmentTime(visit.completedAt!, timeZone, locale)}`
          : visit.status === "OPEN"
            ? ` · ${inProgressLabel}`
            : ""}
      </p>
    </div>
  );
}

function DisabledDetailsButton({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-disabled="true"
          aria-label={`${label}. ${tooltip}`}
          className="inline-flex w-fit"
          tabIndex={0}
        >
          <Button disabled size="sm" type="button" variant="outline">
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function PatientVisitsTab({
  branchSlug,
  locale,
  patientId,
  tenantSlug,
  timeZone,
}: Props) {
  const { t } = useTranslation("patients");
  const { t: tCommon } = useTranslation("common");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });
  const [status, setStatus] = useState<string>(ALL);
  const [dentistId, setDentistId] = useState<string>(ALL);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "dateTime", desc: true },
  ]);

  const selectedRange = useMemo(() => {
    if (!dateRange?.from || !dateRange.to) return null;
    const fromDate = dateInputValue(dateRange.from);
    const throughDate = dateInputValue(dateRange.to);
    const toDate = addDaysInTimeZone(throughDate, 1, timeZone);
    const from = fromAppointmentDateAndTime(fromDate, "00:00", timeZone);
    const to = fromAppointmentDateAndTime(toDate, "00:00", timeZone);
    return from && to ? { from, to } : null;
  }, [dateRange, timeZone]);
  const sortOrder: SortOrder = sorting[0]?.desc === false ? "ASC" : "DESC";

  const query = useMemo<PatientVisitListQuery>(() => {
    return {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      sortOrder,
      ...(status !== ALL ? { status: status as VisitStatus } : {}),
      ...(dentistId !== ALL ? { dentistUserId: dentistId } : {}),
      ...(selectedRange ?? {}),
    };
  }, [dentistId, pagination, selectedRange, sortOrder, status]);
  const visitsQuery = usePatientVisitsQuery(
    tenantSlug,
    branchSlug,
    patientId,
    query,
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }),
    [locale, timeZone],
  );
  const calendarDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        columnHeader: {
          sortAscending: t("detail.visits.filters.oldest"),
          sortDescending: t("detail.visits.filters.newest"),
        },
      }),
    [t, tCommon],
  );
  const hasActiveFilters =
    status !== ALL || dentistId !== ALL || Boolean(dateRange);

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function clearFilters() {
    setStatus(ALL);
    setDentistId(ALL);
    setDateRange(undefined);
    resetToFirstPage();
  }

  const columns = useMemo<ColumnDef<PatientVisitListItem>[]>(
    () => [
      {
        id: "dateTime",
        accessorFn: (visit) => visit.startedAt,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("detail.visits.columns.dateTime")}
          />
        ),
        cell: ({ row }) => (
          <VisitDateTime
            dateFormatter={dateFormatter}
            inProgressLabel={t("detail.visits.statuses.OPEN")}
            locale={locale}
            notProvided={t("table.notProvided")}
            timeZone={timeZone}
            visit={row.original}
          />
        ),
      },
      {
        id: "dentist",
        header: () => t("detail.visits.columns.dentist"),
        cell: ({ row }) => row.original.dentist.fullName,
      },
      {
        id: "operatory",
        header: () => t("detail.visits.columns.operatory"),
        cell: ({ row }) =>
          row.original.operatory?.name ?? t("table.notProvided"),
      },
      {
        id: "diagnosis",
        header: () => t("detail.visits.columns.diagnosis"),
        cell: ({ row }) => (
          <span className="line-clamp-2 min-w-40">
            {row.original.diagnosisSummary ?? t("table.notProvided")}
          </span>
        ),
      },
      {
        id: "status",
        header: () => t("detail.visits.columns.status"),
        cell: ({ row }) => (
          <VisitStatusBadge
            label={t(`detail.visits.statuses.${row.original.status}`)}
            status={row.original.status}
          />
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => t("detail.visits.columns.actions"),
        cell: () => (
          <DisabledDetailsButton
            label={t("detail.visits.viewDetails")}
            tooltip={t("detail.visits.comingSoon")}
          />
        ),
      },
    ],
    [dateFormatter, locale, t, timeZone],
  );

  const dateRangeLabel = dateRange?.from
    ? dateRange.to
      ? t("detail.visits.filters.dateRangeValue", {
          from: calendarDateFormatter.format(dateRange.from),
          to: calendarDateFormatter.format(dateRange.to),
        })
      : calendarDateFormatter.format(dateRange.from)
    : t("detail.visits.filters.dateRangePlaceholder");

  const summary = visitsQuery.data?.summary;
  const hasNoVisits = !visitsQuery.isLoading && summary?.total === 0;
  const hasNoFilterResults =
    !visitsQuery.isLoading &&
    Boolean(summary?.total) &&
    visitsQuery.data?.meta.total === 0;

  if (visitsQuery.isError) {
    return (
      <Card>
        <CardContent className="p-5">
          <Empty className="min-h-72">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Stethoscope aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("detail.visits.loadErrorTitle")}</EmptyTitle>
              <EmptyDescription>
                {getErrorMessage(visitsQuery.error)}
              </EmptyDescription>
              <Button onClick={() => void visitsQuery.refetch()} type="button">
                {t("actions.retry")}
              </Button>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard
            icon={<CalendarDays aria-hidden="true" className="size-6" />}
            label={t("detail.visits.summary.total")}
            loading={visitsQuery.isLoading}
            tone="blue"
            value={summary?.total ?? 0}
          />
          <SummaryCard
            icon={<CheckCircle2 aria-hidden="true" className="size-6" />}
            label={t("detail.visits.summary.completed")}
            loading={visitsQuery.isLoading}
            tone="emerald"
            value={summary?.completed ?? 0}
          />
          <SummaryCard
            icon={<Clock3 aria-hidden="true" className="size-6" />}
            label={t("detail.visits.summary.inProgress")}
            loading={visitsQuery.isLoading}
            tone="orange"
            value={summary?.inProgress ?? 0}
          />
        </div>

        <Card>
          <CardHeader className="border-b p-5">
            <CardTitle>{t("detail.visits.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("detail.visits.description")}
            </p>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_minmax(16rem,1.3fr)_auto]">
              <div className="space-y-2">
                <Label>{t("detail.visits.filters.status")}</Label>
                <Select
                  disabled={visitsQuery.isLoading}
                  onValueChange={(value) => {
                    setStatus(value);
                    resetToFirstPage();
                  }}
                  value={status}
                >
                  <SelectTrigger aria-label={t("detail.visits.filters.status")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      {t("detail.visits.filters.allStatuses")}
                    </SelectItem>
                    {VISIT_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`detail.visits.statuses.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("detail.visits.filters.dentist")}</Label>
                <Select
                  disabled={visitsQuery.isLoading}
                  onValueChange={(value) => {
                    setDentistId(value);
                    resetToFirstPage();
                  }}
                  value={dentistId}
                >
                  <SelectTrigger
                    aria-label={t("detail.visits.filters.dentist")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      {t("detail.visits.filters.allDentists")}
                    </SelectItem>
                    {(visitsQuery.data?.filterOptions.dentists ?? []).map(
                      (dentist) => (
                        <SelectItem key={dentist.id} value={dentist.id}>
                          {dentist.fullName}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("detail.visits.filters.dateRange")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      aria-label={dateRangeLabel}
                      className="w-full min-w-0 justify-start overflow-hidden font-normal"
                      disabled={visitsQuery.isLoading}
                      type="button"
                      variant="outline"
                    >
                      <CalendarDays aria-hidden="true" />
                      <span className="truncate">{dateRangeLabel}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-0">
                    <Calendar
                      captionLayout="dropdown"
                      mode="range"
                      numberOfMonths={1}
                      onSelect={(range) => {
                        setDateRange(range);
                        resetToFirstPage();
                      }}
                      selected={dateRange}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-end">
                <Button
                  className="w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-200 dark:bg-blue-50 dark:text-blue-700 dark:hover:bg-blue-100 dark:hover:text-blue-800"
                  disabled={!hasActiveFilters || visitsQuery.isLoading}
                  onClick={clearFilters}
                  type="button"
                  variant="outline"
                >
                  <RotateCcw aria-hidden="true" />
                  {t("detail.visits.filters.clear")}
                </Button>
              </div>
            </div>

            {hasNoVisits ? (
              <Empty className="min-h-72 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Stethoscope aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("detail.visits.empty.title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("detail.visits.empty.description")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <DataTable
                columns={columns}
                data={visitsQuery.data?.items ?? []}
                emptyState={
                  hasNoFilterResults ? (
                    <Empty className="border-0 py-10">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Stethoscope aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>
                          {t("detail.visits.noResults.title")}
                        </EmptyTitle>
                        <EmptyDescription>
                          {t("detail.visits.noResults.description")}
                        </EmptyDescription>
                        <Button onClick={clearFilters} size="sm" type="button">
                          {t("detail.visits.filters.clear")}
                        </Button>
                      </EmptyHeader>
                    </Empty>
                  ) : undefined
                }
                isFetching={visitsQuery.isFetching}
                isLoading={visitsQuery.isLoading}
                locale={dataTableLocale}
                mobileLayout="cards"
                pagination={{
                  enabled: Boolean(visitsQuery.data?.meta.total),
                  manual: true,
                  pageIndex: pagination.pageIndex,
                  pageSize: pagination.pageSize,
                  pageSizeOptions: PAGE_SIZE_OPTIONS,
                  rowCount: visitsQuery.data?.meta.total ?? 0,
                  onPaginationChange: (next) =>
                    setPagination((current) => ({
                      pageIndex:
                        next.pageSize === current.pageSize ? next.pageIndex : 0,
                      pageSize: next.pageSize,
                    })),
                }}
                serverState={{
                  sorting: {
                    value: sorting,
                    onChange: (next) => {
                      setSorting(next);
                      resetToFirstPage();
                    },
                  },
                }}
                renderMobileItem={(visit) => (
                  <div className="space-y-4 rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <VisitDateTime
                        dateFormatter={dateFormatter}
                        inProgressLabel={t("detail.visits.statuses.OPEN")}
                        locale={locale}
                        notProvided={t("table.notProvided")}
                        timeZone={timeZone}
                        visit={visit}
                      />
                      <VisitStatusBadge
                        label={t(`detail.visits.statuses.${visit.status}`)}
                        status={visit.status}
                      />
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">
                          {t("detail.visits.columns.dentist")}
                        </dt>
                        <dd className="font-medium">
                          {visit.dentist.fullName}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {t("detail.visits.columns.operatory")}
                        </dt>
                        <dd className="font-medium">
                          {visit.operatory?.name ?? t("table.notProvided")}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">
                          {t("detail.visits.columns.diagnosis")}
                        </dt>
                        <dd className="line-clamp-3 font-medium">
                          {visit.diagnosisSummary ?? t("table.notProvided")}
                        </dd>
                      </div>
                    </dl>
                    <DisabledDetailsButton
                      label={t("detail.visits.viewDetails")}
                      tooltip={t("detail.visits.comingSoon")}
                    />
                  </div>
                )}
                toolbar={{ search: false, viewOptions: false }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
