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
import { useSubscriptionPlansQuery } from "@/features/subscription-plans/subscription-plans.hooks";
import {
  formatSubscriptionPlanAmount,
  localeForLanguage,
} from "@/features/subscription-plans/subscription-plans.price";
import type { SubscriptionPlan } from "@/features/subscription-plans/subscription-plans.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Power, PowerOff, RefreshCw, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SubscriptionPlanAvailabilityDialog } from "../../features/subscription-plans/components/SubscriptionPlanAvailabilityDialog";
import { SubscriptionPlanFormDialog } from "../../features/subscription-plans/components/SubscriptionPlanFormDialog";

function formatEntitlementValue(value: unknown, fallback: string): string {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? String(value)
    : fallback;
}

export function SubscriptionPlanManagementPage() {
  const { i18n, t } = useTranslation("plans");
  const { t: tCommon } = useTranslation("common");
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const catalogQuery = useSubscriptionPlansQuery();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<
    SubscriptionPlan | undefined
  >();
  const [availabilityPlan, setAvailabilityPlan] =
    useState<SubscriptionPlan | null>(null);
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("table.searchPlaceholder") },
      }),
    [t, tCommon],
  );

  const columns = useMemo<ColumnDef<SubscriptionPlan>[]>(
    () => [
      {
        id: "plan",
        accessorFn: (plan) => `${plan.name} ${plan.code}`,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.columns.plan")}
          />
        ),
        cell: ({ row }) => (
          <div className="min-w-44">
            <p className="font-semibold">{row.original.name}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {row.original.code}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "billingInterval",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.columns.billingInterval")}
          />
        ),
        cell: ({ row }) =>
          t(`billingIntervals.${row.original.billingInterval}`),
        meta: {
          filterConfig: {
            description: t("table.filters.billingIntervalDescription"),
            options: ["MONTHLY", "YEARLY"].map((value) => ({
              label: t(`billingIntervals.${value}`),
              value,
            })),
            title: t("table.filters.billingInterval"),
            variant: "select",
          },
        },
      },
      {
        id: "price",
        accessorFn: (plan) => plan.amount,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.columns.price")}
          />
        ),
        cell: ({ row }) =>
          formatSubscriptionPlanAmount(
            row.original.amount,
            row.original.currency,
            locale,
          ),
      },
      {
        accessorKey: "trialDays",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.columns.trial")}
          />
        ),
        cell: ({ row }) =>
          row.original.trialDays === null
            ? t("table.noTrial")
            : t("table.trialDays", { days: row.original.trialDays }),
      },
      {
        id: "entitlements",
        accessorFn: (plan) => JSON.stringify(plan.entitlements),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.columns.entitlements")}
          />
        ),
        cell: ({ row }) => {
          const { analytics, maxBranches, maxUsers } =
            row.original.entitlements;
          const analyticsLabel =
            typeof analytics === "boolean"
              ? t(
                  analytics
                    ? "analyticsOptions.enabled"
                    : "analyticsOptions.disabled",
                )
              : t("entitlements.notConfigured");

          return (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <p>
                {t("entitlements.maxBranches")}:{" "}
                {formatEntitlementValue(
                  maxBranches,
                  t("entitlements.notConfigured"),
                )}
              </p>
              <p>
                {t("entitlements.maxUsers")}:{" "}
                {formatEntitlementValue(
                  maxUsers,
                  t("entitlements.notConfigured"),
                )}
              </p>
              <p>
                {t("entitlements.analytics")}: {analyticsLabel}
              </p>
            </div>
          );
        },
      },
      {
        id: "availability",
        accessorFn: (plan) => (plan.isActive ? "ACTIVE" : "INACTIVE"),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.columns.availability")}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "outline"}>
            {t(
              row.original.isActive
                ? "availability.active"
                : "availability.inactive",
            )}
          </Badge>
        ),
        meta: {
          filterConfig: {
            description: t("table.filters.availabilityDescription"),
            options: ["ACTIVE", "INACTIVE"].map((value) => ({
              label: t(
                value === "ACTIVE"
                  ? "availability.active"
                  : "availability.inactive",
              ),
              value,
            })),
            title: t("table.filters.availability"),
            variant: "select",
          },
        },
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => (
          <span className="sr-only">{t("table.columns.actions")}</span>
        ),
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              aria-label={t("actions.editPlan", { name: row.original.name })}
              onClick={() => setEditingPlan(row.original)}
              size="icon-sm"
              title={t("actions.edit")}
              type="button"
              variant="ghost"
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              aria-label={t(
                row.original.isActive
                  ? "actions.deactivatePlan"
                  : "actions.activatePlan",
                { name: row.original.name },
              )}
              onClick={() => setAvailabilityPlan(row.original)}
              size="icon-sm"
              title={t(
                row.original.isActive
                  ? "actions.deactivate"
                  : "actions.activate",
              )}
              type="button"
              variant={row.original.isActive ? "ghost" : "secondary"}
            >
              {row.original.isActive ? (
                <PowerOff aria-hidden="true" />
              ) : (
                <Power aria-hidden="true" />
              )}
            </Button>
          </div>
        ),
      },
    ],
    [locale, t],
  );

  function handlePlanDialogOpenChange(open: boolean) {
    if (!open) {
      setCreateDialogOpen(false);
      setEditingPlan(undefined);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-primary">
            DentFlow Platform
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} type="button">
          <Plus aria-hidden="true" />
          {t("actions.create")}
        </Button>
      </div>

      {catalogQuery.isError ? (
        <Alert
          className="flex flex-wrap items-center justify-between gap-3"
          variant="destructive"
        >
          <span>{getErrorMessage(catalogQuery.error)}</span>
          <Button
            onClick={() => void catalogQuery.refetch()}
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
            {catalogQuery.isFetching && !catalogQuery.isLoading && (
              <Spinner aria-label={t("loading")} />
            )}
          </CardHeader>
          <CardContent className="p-6">
            <DataTable
              columns={columns}
              data={catalogQuery.data ?? []}
              emptyState={
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Tags aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("empty.title")}</EmptyTitle>
                    <EmptyDescription>
                      {t("empty.description")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
              isFetching={catalogQuery.isFetching}
              isLoading={catalogQuery.isLoading}
              locale={dataTableLocale}
              pagination={{ pageSize: 10, pageSizeOptions: [5, 10, 25] }}
              toolbar={{ search: true, viewOptions: true }}
            />
          </CardContent>
        </Card>
      )}

      <SubscriptionPlanFormDialog
        onOpenChange={handlePlanDialogOpenChange}
        open={createDialogOpen || Boolean(editingPlan)}
        plan={editingPlan}
      />
      {availabilityPlan && (
        <SubscriptionPlanAvailabilityDialog
          key={availabilityPlan.id}
          onOpenChange={(open) => {
            if (!open) {
              setAvailabilityPlan(null);
            }
          }}
          plan={availabilityPlan}
        />
      )}
    </div>
  );
}
