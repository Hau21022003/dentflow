import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasBranchPermission } from "@/features/auth/authorization";
import { PERMISSIONS, type AuthUser } from "@/features/auth/auth.types";
import {
  useCancelTreatmentPlanMutation,
  useCreateTreatmentPlanMutation,
  useTreatmentPlanQuery,
  useTreatmentPlansQuery,
} from "@/features/treatment-plans/treatment-plans.hooks";
import type { TreatmentPlanScope } from "@/features/treatment-plans/treatment-plans.service";
import type {
  CancelTreatmentPlanInput,
  TreatmentPlanStatus,
} from "@/features/treatment-plans/treatment-plans.types";
import { getErrorMessage, handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CancelTreatmentPlanDialog } from "./CancelTreatmentPlanDialog";
import { DraftTreatmentPlanEditor } from "./DraftTreatmentPlanEditor";
import { TreatmentPlanDetail } from "./TreatmentPlanDetail";

type TreatmentPlansPanelProps = TreatmentPlanScope & {
  initialPlanId?: string;
  onDraftCancel?: () => void;
  onProposed?: () => void;
  showList?: boolean;
  timeZone: string;
  user: AuthUser | null | undefined;
};

function statusVariant(status: TreatmentPlanStatus) {
  if (status === "CANCELLED") return "destructive" as const;
  if (status === "COMPLETED" || status === "ACCEPTED") {
    return "secondary" as const;
  }
  return "outline" as const;
}

function PlanStatusBadge({ status }: { status: TreatmentPlanStatus }) {
  const { t } = useTranslation("treatmentPlans");
  return (
    <Badge variant={statusVariant(status)}>
      {t(`statuses.plan.${status}`)}
    </Badge>
  );
}

export function TreatmentPlansPanel({
  tenantSlug,
  branchSlug,
  visitId,
  initialPlanId,
  onDraftCancel,
  onProposed,
  showList = true,
  timeZone,
  user,
}: TreatmentPlansPanelProps) {
  const { t } = useTranslation("treatmentPlans");
  const scope = { tenantSlug, branchSlug, visitId };
  const canWrite = hasBranchPermission(
    user,
    { slug: tenantSlug },
    branchSlug,
    PERMISSIONS.treatmentPlanWrite,
  );
  const plans = useTreatmentPlansQuery(
    scope,
    { page: 1, limit: 100 },
    canWrite,
  );
  const create = useCreateTreatmentPlanMutation();
  const cancel = useCancelTreatmentPlanMutation();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialPlanId ?? null,
  );
  const selected = useTreatmentPlanQuery(scope, selectedPlanId, canWrite);
  const [cancelDraftOpen, setCancelDraftOpen] = useState(false);
  const [commandError, setCommandError] = useState("");
  const intents = useRef<Record<string, IdempotencyIntent | null>>({});
  const selectedSummary = plans.data?.items.find(
    (plan) => plan.id === selectedPlanId,
  );
  const currentPlan = selected.data ?? selectedSummary;

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

  async function createDraft() {
    const operation = "create";
    setCommandError("");
    try {
      const plan = await create.mutateAsync({
        ...scope,
        idempotencyKey: keyFor(operation, {
          operation: "clinical.treatment-plan.create",
          ...scope,
        }),
      });
      completeIntent(operation);
      setSelectedPlanId(plan.id);
    } catch (error) {
      handleApiError({ error, onMessage: setCommandError });
    }
  }

  async function cancelDraft(input: CancelTreatmentPlanInput) {
    if (!currentPlan) return;
    const operation = `cancel:${currentPlan.id}`;
    await cancel.mutateAsync({
      ...scope,
      idempotencyKey: keyFor(operation, {
        operation: "clinical.treatment-plan.cancel",
        ...scope,
        planId: currentPlan.id,
        ...input,
      }),
      input,
      planId: currentPlan.id,
    });
    completeIntent(operation);
  }

  if (!canWrite) return null;

  return (
    <section
      aria-label={showList ? undefined : t("detail.title")}
      aria-labelledby={showList ? "treatment-plans-title" : undefined}
      className="space-y-4"
    >
      {showList && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold" id="treatment-plans-title">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
          <Button
            disabled={create.isPending}
            onClick={() => void createDraft()}
            type="button"
          >
            <Plus aria-hidden="true" />
            {t("actions.createDraft")}
          </Button>
        </div>
      )}
      {commandError && <Alert variant="destructive">{commandError}</Alert>}
      {showList && plans.isError && (
        <Alert variant="destructive">{getErrorMessage(plans.error)}</Alert>
      )}
      {showList &&
        (plans.isLoading ? (
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
        ) : (
          <div className="grid gap-2">
            {(plans.data?.items ?? []).map((plan) => (
              <button
                className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:bg-muted/50"
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{plan.code}</span>
                  <span className="text-sm text-muted-foreground">
                    {t("itemCount", { count: plan.items.length })}
                  </span>
                </span>
                <PlanStatusBadge status={plan.status} />
              </button>
            ))}
            {(plans.data?.items.length ?? 0) === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {t("empty")}
              </p>
            )}
          </div>
        ))}
      {selectedPlanId && selected.isError && (
        <Alert variant="destructive">{getErrorMessage(selected.error)}</Alert>
      )}
      {selectedPlanId && selected.isLoading && (
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      )}
      {currentPlan?.status === "DRAFT" && (
        <DraftTreatmentPlanEditor
          onCancel={onDraftCancel}
          onCancelPlan={() => setCancelDraftOpen(true)}
          onProposed={onProposed}
          plan={currentPlan}
          scope={scope}
          showMobileTitle={!showList}
        />
      )}
      {currentPlan && currentPlan.status !== "DRAFT" && (
        <TreatmentPlanDetail
          plan={currentPlan}
          plannedDentists={selectedSummary?.plannedDentists}
          scope={scope}
          timeZone={timeZone}
          user={user}
        />
      )}
      <CancelTreatmentPlanDialog
        onOpenChange={setCancelDraftOpen}
        onSubmit={cancelDraft}
        open={cancelDraftOpen}
        pending={cancel.isPending}
      />
    </section>
  );
}
