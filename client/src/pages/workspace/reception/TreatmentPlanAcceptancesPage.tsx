import { DataTable } from "@/components/shadcntable/data-table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useAcceptTreatmentPlanMutation, useTreatmentPlanAcceptancesQuery } from "@/features/treatment-plan-acceptances/treatment-plan-acceptances.hooks";
import type { TreatmentPlanAcceptanceQueueItem } from "@/features/treatment-plan-acceptances/treatment-plan-acceptances.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { ApiError, getErrorMessage, handleApiError } from "@/shared/lib/error";
import { idempotencyKeyForIntent, type IdempotencyIntent } from "@/shared/lib/idempotency";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

const PAGE_SIZE_OPTIONS = [5, 10, 25];

export function TreatmentPlanAcceptancesPage() {
  const { i18n, t } = useTranslation("treatmentPlanAcceptances");
  const { t: tCommon } = useTranslation("common");
  const { branch, branchSlug, tenant, tenantSlug } = useRouteWorkspaceContext();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [selected, setSelected] = useState<TreatmentPlanAcceptanceQueueItem | null>(null);
  const [intent, setIntent] = useState<IdempotencyIntent | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const query = useTreatmentPlanAcceptancesQuery(
    { tenantSlug, branchSlug },
    pagination.pageIndex + 1,
    pagination.pageSize,
  );
  const accept = useAcceptTreatmentPlanMutation();
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  const dataTableLocale = useMemo(() => createDataTableLocale(tCommon), [tCommon]);
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;
  const branchName = branch?.branch.name ?? branchSlug;

  const columns = useMemo<ColumnDef<TreatmentPlanAcceptanceQueueItem>[]>(
    () => [
      { accessorKey: "patient.fullName", header: () => t("table.patient"), cell: ({ row }) => <div><p className="font-semibold">{row.original.patient.fullName}</p><p className="text-sm text-muted-foreground">{row.original.patient.phone}</p></div> },
      { accessorKey: "id", header: () => t("table.plan"), cell: ({ row }) => <span className="font-mono text-sm">{row.original.id.slice(0, 8)}</span> },
      { accessorKey: "status", header: () => t("table.status"), cell: () => <Badge variant="secondary">{t("status.proposed")}</Badge> },
      { accessorKey: "createdAt", header: () => t("table.createdAt"), cell: ({ row }) => dateTimeFormatter.format(new Date(row.original.createdAt)) },
      { accessorKey: "updatedAt", header: () => t("table.updatedAt"), cell: ({ row }) => dateTimeFormatter.format(new Date(row.original.updatedAt)) },
      { id: "actions", enableHiding: false, enableSorting: false, header: () => <span className="sr-only">{t("table.actions")}</span>, cell: ({ row }) => <Button size="sm" type="button" onClick={() => { setDialogError(null); setSelected(row.original); }}>{t("actions.accept")}</Button> },
    ],
    [dateTimeFormatter, t],
  );

  async function confirmAccept() {
    if (!selected) return;
    const nextIntent = idempotencyKeyForIntent(intent, { planId: selected.id });
    setIntent(nextIntent);
    setDialogError(null);
    try {
      await accept.mutateAsync({ tenantSlug, branchSlug, planId: selected.id, idempotencyKey: nextIntent.key });
      setSelected(null);
      toast.success(t("feedback.accepted"));
    } catch (error) {
      const apiError = handleApiError({ error, onMessage: () => undefined });
      setDialogError(errorMessageForStatus(apiError, t));
    }
  }

  return <div className="space-y-7">
    <div className="space-y-2"><p className="text-sm font-semibold text-primary">{t("eyebrow", { tenantName, branchName })}</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1><p className="text-sm leading-6 text-muted-foreground sm:text-base">{t("description")}</p></div>
    <Card><CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>{t("table.title")}</CardTitle><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("table.description")}</p></div>{query.isFetching && !query.isLoading && <RefreshCw aria-label={t("loading")} className="size-4 animate-spin text-muted-foreground" />}</CardHeader><CardContent className="p-6"><DataTable columns={columns} data={query.data?.items ?? []} emptyState={query.isError ? <Empty className="border-0 py-10"><EmptyHeader><EmptyMedia variant="icon"><ClipboardCheck aria-hidden="true" /></EmptyMedia><EmptyTitle>{t("errors.listTitle")}</EmptyTitle><EmptyDescription>{getErrorMessage(query.error)}</EmptyDescription><Button size="sm" type="button" onClick={() => void query.refetch()}>{t("actions.retry")}</Button></EmptyHeader></Empty> : <Empty className="border-0 py-10"><EmptyHeader><EmptyMedia variant="icon"><ClipboardCheck aria-hidden="true" /></EmptyMedia><EmptyTitle>{t("empty.title")}</EmptyTitle><EmptyDescription>{t("empty.description")}</EmptyDescription></EmptyHeader></Empty>} isFetching={query.isFetching} isLoading={query.isLoading} locale={dataTableLocale} pagination={{ manual: true, pageIndex: pagination.pageIndex, pageSize: pagination.pageSize, pageSizeOptions: PAGE_SIZE_OPTIONS, rowCount: query.data?.meta.total ?? 0, onPaginationChange: (next) => setPagination((current) => ({ pageIndex: next.pageSize === current.pageSize ? next.pageIndex : 0, pageSize: next.pageSize })) }} toolbar={{ viewOptions: true }} /></CardContent></Card>
    <AlertDialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !accept.isPending) { setSelected(null); setDialogError(null); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("dialog.title")}</AlertDialogTitle><AlertDialogDescription>{selected ? t("dialog.description", { name: selected.patient.fullName, planId: selected.id.slice(0, 8) }) : ""}</AlertDialogDescription></AlertDialogHeader>{dialogError && <Alert variant="destructive">{dialogError}</Alert>}<AlertDialogFooter><AlertDialogCancel disabled={accept.isPending}>{t("actions.cancel")}</AlertDialogCancel><Button disabled={accept.isPending} type="button" onClick={() => void confirmAccept()}>{accept.isPending ? t("actions.accepting") : t("actions.accept")}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function errorMessageForStatus(error: ApiError, t: (key: string) => string) {
  if (error.status === 403) return t("errors.forbidden");
  if (error.status === 404) return t("errors.notFound");
  if (error.status === 409) return t("errors.conflict");
  if (error.status === 422) return t("errors.invalid");
  return error.message;
}
