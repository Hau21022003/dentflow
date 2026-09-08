import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateSubscriptionPlanMutation } from "@/features/subscription-plans/subscription-plans.hooks";
import type { SubscriptionPlan } from "@/features/subscription-plans/subscription-plans.types";
import { getErrorMessage } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";

type SubscriptionPlanAvailabilityDialogProps = {
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan;
};

export function SubscriptionPlanAvailabilityDialog({
  onOpenChange,
  plan,
}: SubscriptionPlanAvailabilityDialogProps) {
  const { t } = useTranslation("plans");
  const updateMutation = useUpdateSubscriptionPlanMutation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idempotencyIntent = useRef<IdempotencyIntent | null>(null);
  const isActivating = Boolean(plan && !plan.isActive);

  function handleOpenChange(open: boolean) {
    if (!updateMutation.isPending) {
      onOpenChange(open);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setError(t("availability.reasonRequired"));
      return;
    }

    if (trimmedReason.length > 500) {
      setError(t("availability.reasonTooLong"));
      return;
    }

    try {
      const input = {
        isActive: !plan.isActive,
        reason: trimmedReason,
      };
      idempotencyIntent.current = idempotencyKeyForIntent(
        idempotencyIntent.current,
        { operation: "platform.plan.update", planId: plan.id, input },
      );
      await updateMutation.mutateAsync({
        planId: plan.id,
        input,
        idempotencyKey: idempotencyIntent.current.key,
      });
      onOpenChange(false);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    }
  }

  return (
    <AlertDialog onOpenChange={handleOpenChange} open>
      <AlertDialogContent>
        <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                isActivating
                  ? "availability.activateTitle"
                  : "availability.deactivateTitle",
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                isActivating
                  ? "availability.activateDescription"
                  : "availability.deactivateDescription",
                { name: plan.name },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && <Alert variant="destructive">{error}</Alert>}

          <div className="grid gap-2">
            <Label htmlFor="subscription-plan-availability-reason">
              {t("availability.reason")}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Textarea
              aria-invalid={Boolean(error)}
              disabled={updateMutation.isPending}
              id="subscription-plan-availability-reason"
              maxLength={500}
              onChange={(event) => {
                setReason(event.target.value);
                setError(null);
              }}
              rows={3}
              value={reason}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={updateMutation.isPending}
              type="button"
              variant="outline"
            >
              {t("actions.cancel")}
            </AlertDialogCancel>
            <Button
              disabled={updateMutation.isPending}
              type="submit"
              variant={isActivating ? "default" : "destructive"}
            >
              {updateMutation.isPending && (
                <Spinner aria-label={t("actions.saving")} />
              )}
              {t(
                isActivating
                  ? "availability.activateConfirm"
                  : "availability.deactivateConfirm",
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
