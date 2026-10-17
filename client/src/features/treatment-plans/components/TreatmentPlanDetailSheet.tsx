import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { AuthUser } from "@/features/auth/auth.types";
import { useTreatmentPlanQuery } from "@/features/treatment-plans/treatment-plans.hooks";
import type { TreatmentPlanScope } from "@/features/treatment-plans/treatment-plans.service";
import type { TreatmentPlanListItem } from "@/features/treatment-plans/treatment-plans.types";
import { getErrorMessage } from "@/shared/lib/error";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TreatmentPlanDetail } from "./TreatmentPlanDetail";

type Props = {
  onEditDraft: (planId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  plan: TreatmentPlanListItem | null;
  scope: TreatmentPlanScope;
  user: AuthUser | null | undefined;
};

export function TreatmentPlanDetailSheet({
  onEditDraft,
  onOpenChange,
  open,
  plan,
  scope,
  user,
}: Props) {
  const { t } = useTranslation("treatmentPlans");
  const detail = useTreatmentPlanQuery(scope, open ? (plan?.id ?? null) : null);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="w-full overflow-hidden p-0 data-[side=right]:max-w-full sm:data-[side=right]:max-w-[760px]"
        side="right"
      >
        {detail.data ? (
          <TreatmentPlanDetail
            onClose={() => onOpenChange(false)}
            onPlanBecameDraft={(planId) => {
              onOpenChange(false);
              onEditDraft(planId);
            }}
            plan={detail.data}
            plannedDentists={plan?.plannedDentists}
            presentation="sheet"
            scope={scope}
            user={user}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("title")}
                </p>
                <SheetTitle className="mt-1 text-xl sm:text-2xl">
                  {plan?.code ?? "—"} · {t("detail.title")}
                </SheetTitle>
              </div>
              <Button
                aria-label={t("actions.close")}
                onClick={() => onOpenChange(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {detail.isError ? (
                <Alert variant="destructive">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>{getErrorMessage(detail.error)}</span>
                    <Button
                      onClick={() => void detail.refetch()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {t("visitList.retry")}
                    </Button>
                  </div>
                </Alert>
              ) : (
                <div className="h-96 animate-pulse rounded-xl bg-muted" />
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
