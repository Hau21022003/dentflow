import { RHFTextField } from "@/components/form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { hasBranchPermission } from "@/features/auth/authorization";
import { PERMISSIONS, type AuthUser } from "@/features/auth/auth.types";
import {
  useCancelTreatmentPlanMutation,
  useCreateTreatmentPlanMutation,
  useRecordTreatmentItemEventMutation,
  useReopenTreatmentPlanMutation,
  useTreatmentItemEventsQuery,
  useTreatmentPlanQuery,
  useTreatmentPlansQuery,
} from "@/features/treatment-plans/treatment-plans.hooks";
import type { TreatmentPlanScope } from "@/features/treatment-plans/treatment-plans.service";
import type { TreatmentItemEventType, TreatmentPlan, TreatmentPlanItem, TreatmentPlanStatus } from "@/features/treatment-plans/treatment-plans.types";
import { getErrorMessage, handleApiError } from "@/shared/lib/error";
import { idempotencyKeyForIntent, type IdempotencyIntent } from "@/shared/lib/idempotency";
import { formatMinorAmount, localeForLanguage } from "@/shared/lib/money";
import { Check, History, Play, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DraftTreatmentPlanEditor } from "./DraftTreatmentPlanEditor";

type TreatmentPlansPanelProps = TreatmentPlanScope & {
  initialPlanId?: string;
  onDraftCancel?: () => void;
  onProposed?: () => void;
  showList?: boolean;
  user: AuthUser | null | undefined;
};
type ReasonForm = { reasonCode: string };

const reasonCodePattern = /^[A-Z][A-Z0-9_]{0,79}$/;

function statusVariant(status: TreatmentPlanStatus | TreatmentPlanItem["status"]) {
  if (status === "CANCELLED") return "destructive" as const;
  if (status === "COMPLETED" || status === "ACCEPTED") return "secondary" as const;
  return "outline" as const;
}

function PlanStatusBadge({ status }: { status: TreatmentPlanStatus }) {
  const { t } = useTranslation("treatmentPlans");
  return <Badge variant={statusVariant(status)}>{t(`statuses.plan.${status}`)}</Badge>;
}

function ItemStatusBadge({ status }: { status: TreatmentPlanItem["status"] }) {
  const { t } = useTranslation("treatmentPlans");
  return <Badge variant={statusVariant(status)}>{t(`statuses.item.${status}`)}</Badge>;
}

function ReasonCodeDialog({
  open,
  title,
  description,
  submitLabel,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: ReasonForm) => Promise<void>;
  pending: boolean;
}) {
  const { t } = useTranslation("treatmentPlans");
  const form = useForm<ReasonForm>({ defaultValues: { reasonCode: "" } });

  useEffect(() => {
    if (open) form.reset({ reasonCode: "" });
  }, [form, open]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await onSubmit(values);
              onOpenChange(false);
            } catch (error) {
              handleApiError<ReasonForm>({ error, setError: form.setError });
            }
          })}
        >
          {form.formState.errors.root?.server && <Alert variant="destructive">{form.formState.errors.root.server.message}</Alert>}
          <RHFTextField
            control={form.control}
            label={t("fields.reasonCode")}
            name="reasonCode"
            placeholder={t("fields.reasonCodePlaceholder")}
            required
            rules={{
              pattern: { value: reasonCodePattern, message: t("validation.reasonCode") },
            }}
          />
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">{t("actions.close")}</Button>
            <Button disabled={pending} type="submit">
              {pending && <Spinner aria-label={t("actions.saving")} />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventHistory({ scope, planId, itemId }: { scope: TreatmentPlanScope; planId: string; itemId: string }) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const events = useTreatmentItemEventsQuery(scope, planId, itemId);
  const records = events.data?.pages.flatMap((page) => page.items) ?? [];
  const locale = localeForLanguage(i18n.resolvedLanguage);
  if (events.isLoading) return <p className="text-sm text-muted-foreground">{t("events.loading")}</p>;
  if (events.isError) return <Alert variant="destructive">{t("events.loadError")}</Alert>;
  return <div className="space-y-2 rounded-lg bg-muted/40 p-3">
    <p className="text-sm font-medium">{t("events.title")}</p>
    {records.length === 0 ? <p className="text-sm text-muted-foreground">{t("events.empty")}</p> : <ol className="space-y-1 text-sm">{records.map((event) => <li className="flex justify-between gap-2" key={event.id}><span>{t(`events.types.${event.eventType}`)}</span><time className="text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(event.createdAt))}</time></li>)}</ol>}
    {events.hasNextPage && <Button disabled={events.isFetchingNextPage} onClick={() => void events.fetchNextPage()} size="sm" type="button" variant="outline">{t("events.loadMore")}</Button>}
  </div>;
}

export function TreatmentPlansPanel({
  tenantSlug,
  branchSlug,
  visitId,
  initialPlanId,
  onDraftCancel,
  onProposed,
  showList = true,
  user,
}: TreatmentPlansPanelProps) {
  const { t } = useTranslation("treatmentPlans");
  const scope = { tenantSlug, branchSlug, visitId };
  const canWrite = hasBranchPermission(user, { slug: tenantSlug }, branchSlug, PERMISSIONS.treatmentPlanWrite);
  const canExecute = canWrite && hasBranchPermission(user, { slug: tenantSlug }, branchSlug, PERMISSIONS.treatmentItemExecute);
  const plans = useTreatmentPlansQuery(scope, { page: 1, limit: 100 }, canWrite);
  const create = useCreateTreatmentPlanMutation();
  const reopen = useReopenTreatmentPlanMutation();
  const cancel = useCancelTreatmentPlanMutation();
  const eventMutation = useRecordTreatmentItemEventMutation();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialPlanId ?? null,
  );
  const selected = useTreatmentPlanQuery(scope, selectedPlanId, canWrite);
  const [reasonAction, setReasonAction] = useState<{ kind: "reopen" | "cancelPlan" | "cancelItem"; itemId?: string } | null>(null);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [commandError, setCommandError] = useState("");
  const intents = useRef<Record<string, IdempotencyIntent | null>>({});
  const currentPlan = selected.data ?? plans.data?.items.find((plan) => plan.id === selectedPlanId);

  function keyFor(operation: string, command: unknown) {
    const prior = intents.current[operation] ?? null;
    const intent = idempotencyKeyForIntent(prior, command);
    intents.current[operation] = intent;
    return intent.key;
  }
  function completeIntent(operation: string) { intents.current[operation] = null; }

  async function createDraft() {
    const operation = "create";
    setCommandError("");
    try {
      const plan = await create.mutateAsync({ ...scope, idempotencyKey: keyFor(operation, { operation: "clinical.treatment-plan.create", ...scope }) });
      completeIntent(operation);
      setSelectedPlanId(plan.id);
    } catch (error) { handleApiError({ error, onMessage: setCommandError }); }
  }
  async function submitReason({ reasonCode }: ReasonForm) {
    if (!currentPlan || !reasonAction) return;
    const operation = `${reasonAction.kind}:${currentPlan.id}:${reasonAction.itemId ?? ""}`;
    const key = keyFor(operation, { operation: `clinical.treatment-plan.${reasonAction.kind}`, ...scope, planId: currentPlan.id, itemId: reasonAction.itemId, reasonCode });
    if (reasonAction.kind === "reopen") await reopen.mutateAsync({ ...scope, planId: currentPlan.id, input: { reasonCode }, idempotencyKey: key });
    if (reasonAction.kind === "cancelPlan") await cancel.mutateAsync({ ...scope, planId: currentPlan.id, input: { reasonCode }, idempotencyKey: key });
    if (reasonAction.kind === "cancelItem" && reasonAction.itemId) await eventMutation.mutateAsync({ ...scope, planId: currentPlan.id, itemId: reasonAction.itemId, input: { eventType: "CANCELLED", reasonCode }, idempotencyKey: key });
    completeIntent(operation);
  }
  async function recordEvent(itemId: string, eventType: Exclude<TreatmentItemEventType, "CANCELLED">) {
    if (!currentPlan) return;
    const operation = `event:${currentPlan.id}:${itemId}:${eventType}`;
    setCommandError("");
    try {
      await eventMutation.mutateAsync({ ...scope, planId: currentPlan.id, itemId, input: { eventType }, idempotencyKey: keyFor(operation, { operation: "clinical.treatment-item.event.record", ...scope, planId: currentPlan.id, itemId, eventType }) });
      completeIntent(operation);
    } catch (error) { handleApiError({ error, onMessage: setCommandError }); }
  }

  if (!canWrite) return null;
  const reasonTitle = reasonAction ? t(`dialogs.${reasonAction.kind}.title`) : "";
  const reasonDescription = reasonAction ? t(`dialogs.${reasonAction.kind}.description`) : "";
  const reasonPending = reopen.isPending || cancel.isPending || eventMutation.isPending;

  return <section className="space-y-4" aria-label={showList ? undefined : t("detail.title")} aria-labelledby={showList ? "treatment-plans-title" : undefined}>
    {showList && <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold" id="treatment-plans-title">{t("title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("description")}</p></div><Button disabled={create.isPending} onClick={() => void createDraft()} type="button"><Plus aria-hidden="true" />{t("actions.createDraft")}</Button></div>}
    {commandError && <Alert variant="destructive">{commandError}</Alert>}
    {showList && plans.isError && <Alert variant="destructive">{getErrorMessage(plans.error)}</Alert>}
    {showList && (plans.isLoading ? <div className="h-28 animate-pulse rounded-xl bg-muted" /> : <div className="grid gap-2">{(plans.data?.items ?? []).map((plan) => <button className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:bg-muted/50" key={plan.id} onClick={() => setSelectedPlanId(plan.id)} type="button"><span className="min-w-0"><span className="block font-medium">{plan.code}</span><span className="text-sm text-muted-foreground">{t("itemCount", { count: plan.items.length })}</span></span><PlanStatusBadge status={plan.status} /></button>)}{(plans.data?.items.length ?? 0) === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("empty")}</p>}</div>)}
    {selectedPlanId && selected.isError && <Alert variant="destructive">{getErrorMessage(selected.error)}</Alert>}
    {selectedPlanId && selected.isLoading && <div className="h-72 animate-pulse rounded-xl bg-muted" />}
    {currentPlan?.status === "DRAFT" && <DraftTreatmentPlanEditor onCancel={onDraftCancel} onCancelPlan={() => setReasonAction({ kind: "cancelPlan" })} onProposed={onProposed} plan={currentPlan} scope={scope} showMobileTitle={!showList} />}
    {currentPlan && currentPlan.status !== "DRAFT" && <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{t("detail.title")}</CardTitle><PlanStatusBadge status={currentPlan.status} /></div><CardDescription>{t("detail.originVisit", { id: currentPlan.originVisitId.slice(0, 8) })}</CardDescription></CardHeader><CardContent className="space-y-5">
      <PlanItems canExecute={canExecute} historyItemId={historyItemId} onCancelItem={(itemId) => setReasonAction({ kind: "cancelItem", itemId })} onHistory={setHistoryItemId} onRecordEvent={recordEvent} plan={currentPlan} scope={scope} />
      <div className="flex flex-wrap gap-2">{currentPlan.status === "PROPOSED" && <Button onClick={() => setReasonAction({ kind: "reopen" })} type="button" variant="outline"><RotateCcw aria-hidden="true" />{t("actions.reopen")}</Button>}{["PROPOSED", "ACCEPTED"].includes(currentPlan.status) && currentPlan.items.every((item) => item.status === "PENDING") && <Button onClick={() => setReasonAction({ kind: "cancelPlan" })} type="button" variant="destructive"><X aria-hidden="true" />{t("actions.cancelPlan")}</Button>}</div>
    </CardContent></Card>}
    <ReasonCodeDialog description={reasonDescription} onOpenChange={(open) => !open && setReasonAction(null)} onSubmit={submitReason} open={Boolean(reasonAction)} pending={reasonPending} submitLabel={reasonAction ? t(`dialogs.${reasonAction.kind}.submit`) : ""} title={reasonTitle} />
  </section>;
}

function PlanItems({ plan, scope, canExecute, onRecordEvent, onCancelItem, historyItemId, onHistory }: { plan: TreatmentPlan; scope: TreatmentPlanScope; canExecute: boolean; onRecordEvent: (itemId: string, type: Exclude<TreatmentItemEventType, "CANCELLED">) => Promise<void>; onCancelItem: (itemId: string) => void; historyItemId: string | null; onHistory: (itemId: string | null) => void }) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const eligible = plan.status === "ACCEPTED" || plan.status === "PARTIALLY_COMPLETED";
  return <div className="space-y-3">{plan.items.map((item) => <article className="rounded-xl border p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{item.serviceCode} · {item.serviceName}</p><p className="mt-1 text-sm text-muted-foreground">{t("detail.quantity", { count: item.quantity })} · {formatMinorAmount(item.finalUnitAmount, item.currency, locale)}</p></div><ItemStatusBadge status={item.status} /></div>{item.toothPosition && <p className="mt-2 text-sm"><span className="text-muted-foreground">{t("fields.toothPosition")}: </span>{item.toothPosition}</p>}{item.indication && <p className="mt-1 whitespace-pre-wrap text-sm"><span className="text-muted-foreground">{t("fields.indication")}: </span>{item.indication}</p>}<div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => onHistory(historyItemId === item.id ? null : item.id)} size="sm" type="button" variant="outline"><History aria-hidden="true" />{t("actions.history")}</Button>{canExecute && eligible && item.status === "PENDING" && <><Button onClick={() => void onRecordEvent(item.id, "IN_PROGRESS")} size="sm" type="button"><Play aria-hidden="true" />{t("actions.start")}</Button><Button onClick={() => onCancelItem(item.id)} size="sm" type="button" variant="outline"><X aria-hidden="true" />{t("actions.cancelItem")}</Button></>}{canExecute && eligible && item.status === "IN_PROGRESS" && <><Button onClick={() => void onRecordEvent(item.id, "IN_PROGRESS")} size="sm" type="button" variant="outline"><Play aria-hidden="true" />{t("actions.recordProgress")}</Button><Button onClick={() => void onRecordEvent(item.id, "COMPLETED")} size="sm" type="button"><Check aria-hidden="true" />{t("actions.complete")}</Button><Button onClick={() => onCancelItem(item.id)} size="sm" type="button" variant="outline"><X aria-hidden="true" />{t("actions.cancelItem")}</Button></>}</div>{historyItemId === item.id && <div className="mt-3"><EventHistory itemId={item.id} planId={plan.id} scope={scope} /></div>}</article>)}</div>;
}
