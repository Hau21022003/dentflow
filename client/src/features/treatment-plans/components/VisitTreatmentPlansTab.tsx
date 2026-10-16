import { pathFor } from "@/app/router/paths";
import { DataTable } from "@/components/shadcntable/data-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { PatientTreatmentPlanStatusBadge } from "@/features/patients/components/PatientTreatmentPlanStatusBadge";
import {
  useCreateTreatmentPlanMutation,
  useTreatmentPlanQuery,
  useTreatmentPlansQuery,
} from "@/features/treatment-plans/treatment-plans.hooks";
import type { TreatmentPlan } from "@/features/treatment-plans/treatment-plans.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, ClipboardList, Eye, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

type Props = {
  appointmentId: string;
  branchSlug: string;
  date: string;
  tenantSlug: string;
  timeZone: string;
  visitId: string;
};

function planSummary(plan: TreatmentPlan, fallback: string): string {
  const first = plan.items[0];
  if (!first) return fallback;
  return plan.items.length > 1
    ? `${first.serviceName} +${plan.items.length - 1}`
    : first.serviceName;
}

function completedItemCount(plan: TreatmentPlan): number {
  return plan.items.filter((item) => item.status === "COMPLETED").length;
}

export function VisitTreatmentPlansTab({
  appointmentId,
  branchSlug,
  date,
  tenantSlug,
  timeZone,
  visitId,
}: Props) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const scope = { tenantSlug, branchSlug, visitId };
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [quickViewPlanId, setQuickViewPlanId] = useState<string | null>(null);
  const [createIntent, setCreateIntent] = useState<IdempotencyIntent | null>(null);
  const [createError, setCreateError] = useState("");
  const plans = useTreatmentPlansQuery(scope, {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });
  const quickView = useTreatmentPlanQuery(scope, quickViewPlanId);
  const create = useCreateTreatmentPlanMutation();
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }),
    [locale, timeZone],
  );
  const dataTableLocale = useMemo(() => createDataTableLocale(tCommon), [tCommon]);

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

  const columns = useMemo<ColumnDef<TreatmentPlan>[]>(
    () => [
      {
        id: "plan",
        header: () => t("visitList.columns.plan"),
        cell: ({ row }) => (
          <div className="min-w-48">
            <p className="font-semibold">{row.original.code}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {planSummary(row.original, t("visitList.noItems"))}
            </p>
          </div>
        ),
      },
      {
        id: "createdAt",
        header: () => t("visitList.columns.createdAt"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {dateFormatter.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
      {
        id: "progress",
        header: () => t("visitList.columns.progress"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm font-medium">
            {t("visitList.progress", {
              completed: completedItemCount(row.original),
              total: row.original.items.length,
            })}
          </span>
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
        id: "actions",
        enableHiding: false,
        header: () => t("visitList.columns.actions"),
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              aria-label={t("visitList.quickViewPlan", { code: row.original.code })}
              onClick={(event) => {
                event.stopPropagation();
                setQuickViewPlanId(row.original.id);
              }}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <Eye aria-hidden="true" />
            </Button>
            <Button
              onClick={(event) => {
                event.stopPropagation();
                openDetail(row.original.id);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("visitList.openDetail")}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        ),
      },
    ],
    [dateFormatter, openDetail, t],
  );

  const selectedPlan =
    quickView.data ??
    plans.data?.items.find((plan) => plan.id === quickViewPlanId) ??
    null;

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 border-b">
          <div>
            <CardTitle>{t("visitList.title")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("visitList.description")}
            </p>
          </div>
          <Button
            disabled={create.isPending}
            onClick={() => void createDraft()}
            type="button"
          >
            {create.isPending ? <Spinner /> : <Plus aria-hidden="true" />}
            {t("actions.createDraft")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {createError && <Alert variant="destructive">{createError}</Alert>}
          <DataTable
            columns={columns}
            data={plans.data?.items ?? []}
            emptyState={
              <div className="grid place-items-center gap-2 py-10 text-center">
                <ClipboardList className="size-8 text-muted-foreground" />
                <p className="font-medium">
                  {plans.isError ? t("errors.plansLoad") : t("empty")}
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
            onRowClick={(plan) => setQuickViewPlanId(plan.id)}
            pagination={{
              manual: true,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageSizeOptions: [5, 10, 20],
              rowCount: plans.data?.meta.total ?? 0,
              onPaginationChange: (next) => setPagination(next),
            }}
            renderMobileItem={(plan) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{plan.code}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {planSummary(plan, t("visitList.noItems"))}
                    </p>
                  </div>
                  <PatientTreatmentPlanStatusBadge status={plan.status} />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {dateFormatter.format(new Date(plan.createdAt))}
                  </span>
                  <span className="font-medium">
                    {t("visitList.progress", {
                      completed: completedItemCount(plan),
                      total: plan.items.length,
                    })}
                  </span>
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
                  {t("visitList.openDetail")}
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            )}
            toolbar={{ search: false, viewOptions: false }}
          />
        </CardContent>
      </Card>

      <Sheet
        onOpenChange={(open) => !open && setQuickViewPlanId(null)}
        open={Boolean(quickViewPlanId)}
      >
        <SheetContent className="max-w-xl overflow-y-auto" side="right">
          <div className="flex items-start justify-between gap-4 border-b p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>
                  {selectedPlan?.code ?? t("visitList.quickView")}
                </SheetTitle>
                {selectedPlan && (
                  <PatientTreatmentPlanStatusBadge status={selectedPlan.status} />
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("visitList.quickViewDescription")}
              </p>
            </div>
            <SheetCloseButton />
          </div>
          <div className="space-y-4 p-5">
            {quickView.isLoading && (
              <div className="h-56 animate-pulse rounded-xl bg-muted" />
            )}
            {quickView.isError && (
              <Alert variant="destructive">{t("errors.planLoad")}</Alert>
            )}
            {selectedPlan?.items.map((item) => (
              <article className="rounded-xl border p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{item.serviceName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.serviceCode}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {t(`statuses.item.${item.status}`)}
                  </Badge>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">
                      {t("fields.quantity")}
                    </dt>
                    <dd className="font-medium">{item.quantity}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("fields.toothPosition")}
                    </dt>
                    <dd className="font-medium">{item.toothPosition ?? "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">
                      {t("fields.indication")}
                    </dt>
                    <dd className="whitespace-pre-wrap font-medium">
                      {item.indication ?? "—"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
            {selectedPlan && selectedPlan.items.length === 0 && (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                {t("visitList.noItems")}
              </p>
            )}
            {selectedPlan && (
              <Button
                className="w-full"
                onClick={() => openDetail(selectedPlan.id)}
                type="button"
              >
                {t("visitList.openDetail")}
                <ChevronRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
