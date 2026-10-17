import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SheetTitle } from "@/components/ui/sheet";
import { hasBranchPermission } from "@/features/auth/authorization";
import { PERMISSIONS, type AuthUser } from "@/features/auth/auth.types";
import {
  useCancelTreatmentPlanMutation,
  useRecordTreatmentItemEventMutation,
  useReopenTreatmentPlanMutation,
  useTreatmentItemEventsQuery,
} from "@/features/treatment-plans/treatment-plans.hooks";
import type { TreatmentPlanScope } from "@/features/treatment-plans/treatment-plans.service";
import {
  TREATMENT_ITEM_EVENT_TYPES,
  type TreatmentItemEvent,
  type TreatmentItemEventType,
  type TreatmentPlan,
  type TreatmentPlanItem,
  type TreatmentPlanListItem,
  type TreatmentPlanStatus,
} from "@/features/treatment-plans/treatment-plans.types";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { formatMinorAmount, localeForLanguage } from "@/shared/lib/money";
import { cn } from "@/shared/lib/utils";
import {
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleCheck,
  CircleDashed,
  Clock3,
  Ellipsis,
  History,
  ListChecks,
  Play,
  RotateCcw,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DentalChart } from "./DentalChart";
import { parseFdiPosition } from "./treatment-plan-odontogram";
import {
  PERMANENT_TOOTH_LAYOUT,
  PRIMARY_TOOTH_LAYOUT,
} from "./tooth-layout";
import {
  TreatmentPlanReasonDialog,
  type TreatmentReasonForm,
} from "./TreatmentPlanReasonDialog";

type Presentation = "page" | "sheet";
type ReasonAction = {
  kind: "reopen" | "cancelPlan" | "cancelItem";
  itemId?: string;
};

type Props = {
  onClose?: () => void;
  onPlanBecameDraft?: (planId: string) => void;
  plan: TreatmentPlan;
  plannedDentists?: TreatmentPlanListItem["plannedDentists"];
  presentation?: Presentation;
  scope: TreatmentPlanScope;
  user: AuthUser | null | undefined;
};

const planStatusStyles: Record<TreatmentPlanStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  PROPOSED: "border-blue-200 bg-blue-100 text-blue-800",
  ACCEPTED: "border-emerald-200 bg-emerald-100 text-emerald-800",
  PARTIALLY_COMPLETED: "border-orange-200 bg-orange-100 text-orange-800",
  COMPLETED: "border-slate-200 bg-slate-200 text-slate-800",
  CANCELLED: "border-red-200 bg-red-100 text-red-800",
};

const planStatusIcons = {
  DRAFT: CircleDashed,
  PROPOSED: Circle,
  ACCEPTED: CircleCheck,
  PARTIALLY_COMPLETED: Clock3,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
} satisfies Record<TreatmentPlanStatus, typeof Circle>;

const itemStatusStyles: Record<TreatmentPlanItem["status"], string> = {
  PENDING: "border-orange-200 bg-orange-50 text-orange-700",
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};

function PlanStatusBadge({ status }: { status: TreatmentPlanStatus }) {
  const { t } = useTranslation("treatmentPlans");
  const Icon = planStatusIcons[status];

  return (
    <Badge className={planStatusStyles[status]} variant="outline">
      <Icon aria-hidden="true" />
      {t(`statuses.plan.${status}`)}
    </Badge>
  );
}

function ItemStatusBadge({ status }: { status: TreatmentPlanItem["status"] }) {
  const { t } = useTranslation("treatmentPlans");
  return (
    <Badge className={itemStatusStyles[status]} variant="outline">
      {t(`statuses.item.${status}`)}
    </Badge>
  );
}

function ReadOnlyOdontogram({ plan }: { plan: TreatmentPlan }) {
  const { t } = useTranslation("treatmentPlans");
  const permanentNumbers = useMemo(
    () => new Set(PERMANENT_TOOTH_LAYOUT.map(({ number }) => number)),
    [],
  );
  const primaryNumbers = useMemo(
    () => new Set(PRIMARY_TOOTH_LAYOUT.map(({ number }) => number)),
    [],
  );
  const selection = useMemo(() => {
    const codes = new Set<string>();
    const legacy = new Set<string>();
    for (const item of plan.items) {
      const parsed = parseFdiPosition(item.toothPosition);
      parsed.codes.forEach((code) => codes.add(code));
      if (parsed.hasLegacyText && item.toothPosition) {
        legacy.add(item.toothPosition);
      }
    }
    return {
      legacy: [...legacy],
      permanent: [...codes].filter((code) => permanentNumbers.has(code)),
      primary: [...codes].filter((code) => primaryNumbers.has(code)),
    };
  }, [permanentNumbers, plan.items, primaryNumbers]);

  const charts = selection.primary.length
    ? [
        ...(selection.permanent.length
          ? [
              {
                key: "permanent",
                label: t("odontogram.dentitions.permanent"),
                selectedCodes: selection.permanent,
                teeth: PERMANENT_TOOTH_LAYOUT,
              },
            ]
          : []),
        {
          key: "primary",
          label: t("odontogram.dentitions.primary"),
          selectedCodes: selection.primary,
          teeth: PRIMARY_TOOTH_LAYOUT,
        },
      ]
    : [
        {
          key: "permanent",
          label: t("odontogram.dentitions.permanent"),
          selectedCodes: selection.permanent,
          teeth: PERMANENT_TOOTH_LAYOUT,
        },
      ];

  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t("detail.assignedTeeth")}</h3>
        <span className="text-xs text-muted-foreground">
          {t("toothCount", {
            count: selection.permanent.length + selection.primary.length,
          })}
        </span>
      </div>
      <div className="space-y-4">
        {charts.map((chart) => {
          const selected = new Set(chart.selectedCodes);
          return (
            <div className="space-y-2" key={chart.key}>
              {charts.length > 1 && (
                <p className="text-center text-xs font-medium text-muted-foreground">
                  {chart.label}
                </p>
              )}
              <DentalChart
                lowerLabel={t("odontogram.lowerArch")}
                onToggle={() => undefined}
                readOnly
                selectedCodes={chart.selectedCodes}
                teeth={chart.teeth}
                toothLabel={(code) =>
                  t(
                    selected.has(code)
                      ? "detail.assignedToothLabel"
                      : "odontogram.toothLabel",
                    { code },
                  )
                }
                upperLabel={t("odontogram.upperArch")}
              />
            </div>
          );
        })}
        {selection.legacy.length > 0 && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {t("detail.otherPositions", {
              positions: selection.legacy.join(" · "),
            })}
          </p>
        )}
      </div>
    </section>
  );
}

function EventIcon({ type }: { type: TreatmentItemEventType }) {
  const className = "size-4";
  if (type === "COMPLETED") return <Check aria-hidden="true" className={className} />;
  if (type === "CANCELLED") return <X aria-hidden="true" className={className} />;
  return <Play aria-hidden="true" className={className} />;
}

function EventRow({ event, locale }: { event: TreatmentItemEvent; locale: string }) {
  const { t } = useTranslation("treatmentPlans");
  return (
    <li className="flex gap-3 border-b py-3 last:border-b-0">
      <span
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
          event.eventType === "COMPLETED" && "bg-emerald-100 text-emerald-700",
          event.eventType === "IN_PROGRESS" && "bg-blue-100 text-blue-700",
          event.eventType === "CANCELLED" && "bg-red-100 text-red-700",
        )}
      >
        <EventIcon type={event.eventType} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t(`events.types.${event.eventType}`)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("events.performedBy", {
            id: event.performedByUserId.slice(0, 8),
          })}
        </p>
      </div>
      <time className="shrink-0 text-right text-xs text-muted-foreground">
        {new Intl.DateTimeFormat(locale, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(event.createdAt))}
      </time>
    </li>
  );
}

function EventHistoryPreview({
  item,
  onViewAll,
  planId,
  scope,
}: {
  item: TreatmentPlanItem;
  onViewAll: () => void;
  planId: string;
  scope: TreatmentPlanScope;
}) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const events = useTreatmentItemEventsQuery(scope, planId, item.id);
  const records = events.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mt-3 rounded-xl border bg-muted/20 px-3 sm:px-4">
      <div className="flex items-center justify-between gap-3 border-b py-3">
        <p className="text-sm font-semibold">{t("events.title")}</p>
        <span className="text-xs text-muted-foreground">
          {t("events.recent", { count: Math.min(records.length, 3) })}
        </span>
      </div>
      {events.isLoading ? (
        <div className="my-4 h-16 animate-pulse rounded-lg bg-muted" />
      ) : events.isError ? (
        <Alert className="my-3" variant="destructive">
          {t("events.loadError")}
        </Alert>
      ) : records.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t("events.empty")}</p>
      ) : (
        <ol>
          {records.slice(0, 3).map((event) => (
            <EventRow event={event} key={event.id} locale={locale} />
          ))}
        </ol>
      )}
      <div className="flex justify-end py-2">
        <Button onClick={onViewAll} size="sm" type="button" variant="ghost">
          {t("events.viewAll")}
          <ChevronDown aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function TreatmentHistoryDialog({
  item,
  onOpenChange,
  open,
  planId,
  scope,
}: {
  item: TreatmentPlanItem | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  planId: string;
  scope: TreatmentPlanScope;
}) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | TreatmentItemEventType>("ALL");
  const events = useTreatmentItemEventsQuery(
    scope,
    planId,
    item?.id ?? null,
    open,
  );
  const records = events.data?.pages.flatMap((page) => page.items) ?? [];
  const normalizedSearch = search.trim().toLocaleLowerCase(locale);
  const filtered = records.filter((event) => {
    if (type !== "ALL" && event.eventType !== type) return false;
    if (!normalizedSearch) return true;
    return `${t(`events.types.${event.eventType}`)} ${event.performedByUserId}`
      .toLocaleLowerCase(locale)
      .includes(normalizedSearch);
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSearch("");
      setType("ALL");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[86svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton={false}
      >
        <DialogHeader className="border-b p-5 pr-14">
          <DialogTitle className="text-xl">{t("events.fullTitle")}</DialogTitle>
          {item && (
            <p className="text-sm text-muted-foreground">
              {item.serviceName}
              {item.toothPosition
                ? ` · ${t("detail.toothValue", { position: item.toothPosition })}`
                : ""}
            </p>
          )}
          <DialogClose asChild>
            <Button
              aria-label={t("actions.close")}
              className="absolute top-4 right-4"
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
          <div className="grid gap-3 pt-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label={t("events.searchPlaceholder")}
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("events.searchPlaceholder")}
                value={search}
              />
            </div>
            <div className="flex flex-wrap gap-1" role="group">
              {(["ALL", ...TREATMENT_ITEM_EVENT_TYPES] as const).map((value) => (
                <Button
                  aria-pressed={type === value}
                  key={value}
                  onClick={() => setType(value)}
                  size="sm"
                  type="button"
                  variant={type === value ? "secondary" : "ghost"}
                >
                  {value === "ALL"
                    ? t("events.all")
                    : t(`events.types.${value}`)}
                </Button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-2">
          {events.isLoading ? (
            <div className="my-4 h-44 animate-pulse rounded-xl bg-muted" />
          ) : events.isError ? (
            <Alert className="my-4" variant="destructive">
              {t("events.loadError")}
            </Alert>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {records.length === 0 ? t("events.empty") : t("events.noResults")}
            </p>
          ) : (
            <ol>
              {filtered.map((event) => (
                <EventRow event={event} key={event.id} locale={locale} />
              ))}
            </ol>
          )}
          {events.hasNextPage && (
            <div className="flex justify-center py-4">
              <Button
                disabled={events.isFetchingNextPage}
                onClick={() => void events.fetchNextPage()}
                size="sm"
                type="button"
                variant="outline"
              >
                {events.isFetchingNextPage && <Spinner />}
                {t("events.loadMore")}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="m-0 rounded-none px-5 py-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X aria-hidden="true" />
              {t("actions.close")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgressSummary({ plan }: { plan: TreatmentPlan }) {
  const { t } = useTranslation("treatmentPlans");
  const counts = {
    cancelled: plan.items.filter((item) => item.status === "CANCELLED").length,
    completed: plan.items.filter((item) => item.status === "COMPLETED").length,
    inProgress: plan.items.filter((item) => item.status === "IN_PROGRESS").length,
    pending: plan.items.filter((item) => item.status === "PENDING").length,
  };
  const total = plan.items.length;
  const percentage = total ? Math.round((counts.completed / total) * 100) : 0;

  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t("detail.progressTitle")}</h3>
        <span className="text-xs font-medium text-muted-foreground">
          {t("detail.progressValue", {
            completed: counts.completed,
            percentage,
            total,
          })}
        </span>
      </div>
      <div
        aria-label={t("visitList.progress", {
          completed: counts.completed,
          total,
        })}
        aria-valuemax={total}
        aria-valuemin={0}
        aria-valuenow={counts.completed}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-emerald-500" />
          {t("detail.completedCount", { count: counts.completed })}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-blue-500" />
          {t("detail.inProgressCount", { count: counts.inProgress })}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-slate-300" />
          {t("detail.pendingCount", { count: counts.pending })}
        </span>
        {counts.cancelled > 0 && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-400" />
            {t("detail.cancelledCount", { count: counts.cancelled })}
          </span>
        )}
      </div>
    </section>
  );
}

function PlanTotals({ plan }: { plan: TreatmentPlan }) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const totals = new Map<string, number>();
  for (const item of plan.items) {
    totals.set(
      item.currency,
      (totals.get(item.currency) ?? 0) + item.finalUnitAmount * item.quantity,
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
          <Calculator aria-hidden="true" className="size-4" />
        </span>
        <p className="font-semibold">{t("editor.estimatedTotal")}</p>
      </div>
      <div className="text-right text-lg font-bold text-primary">
        {totals.size === 0
          ? "—"
          : [...totals.entries()]
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([currency, amount]) => (
                <span className="block" key={currency}>
                  {formatMinorAmount(amount, currency, locale)}
                </span>
              ))}
      </div>
    </div>
  );
}

export function TreatmentPlanDetail({
  onClose,
  onPlanBecameDraft,
  plan,
  plannedDentists = [],
  presentation = "page",
  scope,
  user,
}: Props) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const canWrite = hasBranchPermission(
    user,
    { slug: scope.tenantSlug },
    scope.branchSlug,
    PERMISSIONS.treatmentPlanWrite,
  );
  const canExecute =
    canWrite &&
    hasBranchPermission(
      user,
      { slug: scope.tenantSlug },
      scope.branchSlug,
      PERMISSIONS.treatmentItemExecute,
    );
  const reopen = useReopenTreatmentPlanMutation();
  const cancel = useCancelTreatmentPlanMutation();
  const eventMutation = useRecordTreatmentItemEventMutation();
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [commandError, setCommandError] = useState("");
  const intents = useRef<Record<string, IdempotencyIntent | null>>({});
  const historyItem =
    plan.items.find((item) => item.id === historyItemId) ?? null;
  const dentistNames = useMemo(() => {
    const byId = new Map(
      plannedDentists.map((dentist) => [dentist.id, dentist.fullName]),
    );
    return Array.from(
      new Set(
        plan.items
          .map((item) => byId.get(item.plannedDentistUserId))
          .filter((name): name is string => Boolean(name)),
      ),
    );
  }, [plan.items, plannedDentists]);
  const dentistById = useMemo(
    () =>
      new Map(
        plannedDentists.map((dentist) => [dentist.id, dentist.fullName]),
      ),
    [plannedDentists],
  );
  const readOnly = plan.status === "COMPLETED" || plan.status === "CANCELLED";
  const canCancelPlan =
    canWrite &&
    (plan.status === "PROPOSED" || plan.status === "ACCEPTED") &&
    plan.items.every((item) => item.status === "PENDING");
  const canReopen = canWrite && plan.status === "PROPOSED";
  const hasPlanActions = canCancelPlan || canReopen;
  const eligibleForExecution =
    plan.status === "ACCEPTED" || plan.status === "PARTIALLY_COMPLETED";

  function keyFor(operation: string, command: unknown) {
    const intent = idempotencyKeyForIntent(
      intents.current[operation] ?? null,
      command,
    );
    intents.current[operation] = intent;
    return intent.key;
  }

  function completeIntent(operation: string) {
    intents.current[operation] = null;
  }

  async function submitReason({ reasonCode }: TreatmentReasonForm) {
    if (!reasonAction) return;
    const operation = `${reasonAction.kind}:${plan.id}:${reasonAction.itemId ?? ""}`;
    const command = {
      operation: `clinical.treatment-plan.${reasonAction.kind}`,
      ...scope,
      planId: plan.id,
      itemId: reasonAction.itemId,
      reasonCode,
    };

    if (reasonAction.kind === "reopen") {
      const updated = await reopen.mutateAsync({
        ...scope,
        idempotencyKey: keyFor(operation, command),
        input: { reasonCode },
        planId: plan.id,
      });
      completeIntent(operation);
      onPlanBecameDraft?.(updated.id);
      return;
    }
    if (reasonAction.kind === "cancelPlan") {
      await cancel.mutateAsync({
        ...scope,
        idempotencyKey: keyFor(operation, command),
        input: { reasonCode },
        planId: plan.id,
      });
      completeIntent(operation);
      return;
    }
    if (reasonAction.itemId) {
      await eventMutation.mutateAsync({
        ...scope,
        idempotencyKey: keyFor(operation, command),
        input: { eventType: "CANCELLED", reasonCode },
        itemId: reasonAction.itemId,
        planId: plan.id,
      });
      completeIntent(operation);
    }
  }

  async function recordEvent(
    itemId: string,
    eventType: Exclude<TreatmentItemEventType, "CANCELLED">,
  ) {
    const operation = `event:${plan.id}:${itemId}:${eventType}`;
    setCommandError("");
    try {
      await eventMutation.mutateAsync({
        ...scope,
        idempotencyKey: keyFor(operation, {
          operation: "clinical.treatment-item.event.record",
          ...scope,
          eventType,
          itemId,
          planId: plan.id,
        }),
        input: { eventType },
        itemId,
        planId: plan.id,
      });
      completeIntent(operation);
    } catch (error) {
      handleApiError({ error, onMessage: setCommandError });
    }
  }

  const header = (
    <header className="shrink-0 border-b bg-background px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("title")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {presentation === "sheet" ? (
              <SheetTitle className="text-xl sm:text-2xl">
                {plan.code} · {t("detail.title")}
              </SheetTitle>
            ) : (
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                {plan.code} · {t("detail.title")}
              </h2>
            )}
            <PlanStatusBadge status={plan.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("detail.createdAt", {
              date: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
              }).format(new Date(plan.createdAt)),
            })}
          </p>
        </div>
        {presentation === "sheet" && (
          <Button
            aria-label={t("actions.close")}
            className="shrink-0"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
    </header>
  );

  const body = (
    <div
      className={cn(
        "space-y-3 bg-muted/10 p-3 sm:space-y-4 sm:p-5",
        presentation === "sheet" && "min-h-0 flex-1 overflow-y-auto",
      )}
    >
      {commandError && <Alert variant="destructive">{commandError}</Alert>}

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">
              {t("detail.responsibleDentist")}
            </dt>
            <dd className="truncate text-sm font-semibold">
              {dentistNames[0] ?? t("visitList.notAssigned")}
              {dentistNames.length > 1
                ? ` +${dentistNames.length - 1}`
                : ""}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <ListChecks aria-hidden="true" className="size-5" />
          </span>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("detail.itemTotal")}
            </dt>
            <dd className="text-sm font-semibold">
              {t("itemCount", { count: plan.items.length })}
            </dd>
          </div>
        </div>
      </dl>

      <ProgressSummary plan={plan} />
      <ReadOnlyOdontogram plan={plan} />

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">
            {t("detail.itemsTitle", { count: plan.items.length })}
          </h3>
          {readOnly && (
            <span className="text-xs text-muted-foreground">
              {t("detail.readOnly")}
            </span>
          )}
        </div>
        <div className="space-y-2.5">
          {plan.items.map((item, index) => {
            const isExpanded = expandedItemId === item.id;
            const canActOnItem = canExecute && eligibleForExecution;
            return (
              <article className="rounded-xl border bg-card p-3 sm:p-4" key={item.id}>
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold">{item.serviceName}</h4>
                      <ItemStatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.toothPosition
                        ? t("detail.toothValue", {
                            position: item.toothPosition,
                          })
                        : t("detail.noTooth")}
                      {" · "}
                      {t("detail.quantity", { count: item.quantity })}
                      {" · "}
                      {t("detail.unitPrice", {
                        amount: formatMinorAmount(
                          item.finalUnitAmount,
                          item.currency,
                          locale,
                        ),
                      })}
                    </p>
                    {item.indication && (
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {t("detail.indicationValue", {
                          indication: item.indication,
                        })}
                      </p>
                    )}
                    {dentistById.get(item.plannedDentistUserId) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("detail.dentistValue", {
                          name: dentistById.get(item.plannedDentistUserId),
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="hidden text-sm font-bold sm:inline">
                      {formatMinorAmount(
                        item.finalUnitAmount * item.quantity,
                        item.currency,
                        locale,
                      )}
                    </span>
                    <Button
                      aria-label={t(
                        isExpanded
                          ? "detail.collapseItem"
                          : "detail.expandItem",
                        { count: index + 1 },
                      )}
                      onClick={() =>
                        setExpandedItemId(isExpanded ? null : item.id)
                      }
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      {isExpanded ? (
                        <ChevronUp aria-hidden="true" />
                      ) : (
                        <ChevronDown aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>

                <p className="mt-2 text-right text-sm font-bold sm:hidden">
                  {formatMinorAmount(
                    item.finalUnitAmount * item.quantity,
                    item.currency,
                    locale,
                  )}
                </p>

                <div className="mt-3 hidden flex-wrap items-center justify-between gap-2 sm:flex">
                  <Button
                    onClick={() =>
                      setExpandedItemId(isExpanded ? null : item.id)
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <History aria-hidden="true" />
                    {t(isExpanded ? "actions.hideHistory" : "actions.history")}
                  </Button>
                  {canActOnItem && item.status === "PENDING" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={eventMutation.isPending}
                        onClick={() =>
                          setReasonAction({
                            kind: "cancelItem",
                            itemId: item.id,
                          })
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <X aria-hidden="true" />
                        {t("actions.cancelItem")}
                      </Button>
                      <Button
                        disabled={eventMutation.isPending}
                        onClick={() =>
                          void recordEvent(item.id, "IN_PROGRESS")
                        }
                        size="sm"
                        type="button"
                      >
                        <Play aria-hidden="true" />
                        {t("actions.start")}
                      </Button>
                    </div>
                  )}
                  {canActOnItem && item.status === "IN_PROGRESS" && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={eventMutation.isPending}
                        onClick={() =>
                          setReasonAction({
                            kind: "cancelItem",
                            itemId: item.id,
                          })
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <X aria-hidden="true" />
                        {t("actions.cancelItem")}
                      </Button>
                      <Button
                        disabled={eventMutation.isPending}
                        onClick={() =>
                          void recordEvent(item.id, "IN_PROGRESS")
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Play aria-hidden="true" />
                        {t("actions.recordProgress")}
                      </Button>
                      <Button
                        disabled={eventMutation.isPending}
                        onClick={() => void recordEvent(item.id, "COMPLETED")}
                        size="sm"
                        type="button"
                      >
                        <Check aria-hidden="true" />
                        {t("actions.complete")}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex min-w-0 items-center gap-1.5 sm:hidden">
                  <Button
                    className="min-w-0 flex-1 px-1.5 text-xs"
                    onClick={() =>
                      setExpandedItemId(isExpanded ? null : item.id)
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <History aria-hidden="true" />
                    <span className="truncate">
                      {t(
                        isExpanded
                          ? "actions.hideHistory"
                          : "actions.historyShort",
                      )}
                    </span>
                  </Button>

                  {canActOnItem && item.status === "PENDING" && (
                    <Button
                      className="min-w-0 flex-1 px-1.5 text-xs"
                      disabled={eventMutation.isPending}
                      onClick={() => void recordEvent(item.id, "IN_PROGRESS")}
                      size="sm"
                      type="button"
                    >
                      <Play aria-hidden="true" />
                      <span className="truncate">{t("actions.start")}</span>
                    </Button>
                  )}

                  {canActOnItem && item.status === "IN_PROGRESS" && (
                    <>
                      <Button
                        className="min-w-0 flex-1 px-1.5 text-xs"
                        disabled={eventMutation.isPending}
                        onClick={() =>
                          void recordEvent(item.id, "IN_PROGRESS")
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Play aria-hidden="true" />
                        <span className="truncate">
                          {t("actions.recordProgressShort")}
                        </span>
                      </Button>
                      <Button
                        className="min-w-0 flex-1 px-1.5 text-xs"
                        disabled={eventMutation.isPending}
                        onClick={() => void recordEvent(item.id, "COMPLETED")}
                        size="sm"
                        type="button"
                      >
                        <Check aria-hidden="true" />
                        <span className="truncate">{t("actions.complete")}</span>
                      </Button>
                    </>
                  )}

                  {canActOnItem &&
                    (item.status === "PENDING" ||
                      item.status === "IN_PROGRESS") && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={t("actions.more")}
                            className="shrink-0"
                            disabled={eventMutation.isPending}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            <Ellipsis aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-auto min-w-40"
                        >
                          <DropdownMenuItem
                            onSelect={() =>
                              setReasonAction({
                                kind: "cancelItem",
                                itemId: item.id,
                              })
                            }
                            variant="destructive"
                          >
                            <X aria-hidden="true" />
                            {t("actions.cancelItem")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                </div>

                {isExpanded && (
                  <EventHistoryPreview
                    item={item}
                    onViewAll={() => setHistoryItemId(item.id)}
                    planId={plan.id}
                    scope={scope}
                  />
                )}
              </article>
            );
          })}
        </div>
      </section>

      <PlanTotals plan={plan} />
    </div>
  );

  const footer = (
    <footer
      className={cn(
        "flex flex-col-reverse gap-2 border-t bg-background p-4 sm:flex-row sm:items-center",
        presentation === "sheet" && "shrink-0 sm:justify-between",
        presentation === "page" && "sm:justify-end",
      )}
    >
      {presentation === "sheet" && (
        <Button onClick={onClose} type="button" variant="outline">
          <X aria-hidden="true" />
          {t("actions.close")}
        </Button>
      )}
      {hasPlanActions && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {canReopen && (
            <Button
              disabled={reopen.isPending}
              onClick={() => setReasonAction({ kind: "reopen" })}
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" />
              {t("actions.reopen")}
            </Button>
          )}
          {canCancelPlan && (
            <Button
              disabled={cancel.isPending}
              onClick={() => setReasonAction({ kind: "cancelPlan" })}
              type="button"
              variant="destructive"
            >
              <X aria-hidden="true" />
              {t("actions.cancelPlan")}
            </Button>
          )}
        </div>
      )}
    </footer>
  );

  const reasonPending =
    reopen.isPending || cancel.isPending || eventMutation.isPending;
  const reasonTitle = reasonAction
    ? t(`dialogs.${reasonAction.kind}.title`)
    : "";
  const reasonDescription = reasonAction
    ? t(`dialogs.${reasonAction.kind}.description`)
    : "";

  return (
    <div
      className={cn(
        presentation === "sheet"
          ? "flex min-h-0 flex-1 flex-col"
          : "overflow-hidden rounded-xl border bg-card",
      )}
    >
      {header}
      {body}
      {(presentation === "sheet" || hasPlanActions) && footer}

      <TreatmentPlanReasonDialog
        description={reasonDescription}
        onOpenChange={(open) => !open && setReasonAction(null)}
        onSubmit={submitReason}
        open={Boolean(reasonAction)}
        pending={reasonPending}
        submitLabel={
          reasonAction ? t(`dialogs.${reasonAction.kind}.submit`) : ""
        }
        title={reasonTitle}
      />
      <TreatmentHistoryDialog
        item={historyItem}
        onOpenChange={(open) => !open && setHistoryItemId(null)}
        open={Boolean(historyItem)}
        planId={plan.id}
        scope={scope}
      />
    </div>
  );
}
