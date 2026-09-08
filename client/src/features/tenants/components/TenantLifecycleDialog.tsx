import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  useExtendTenantTrialMutation,
  useReactivateTenantMutation,
  useResendTenantOwnerInviteMutation,
  useSuspendTenantMutation,
} from "@/features/tenants/tenants.hooks";
import type { PlatformTenantDetail } from "@/features/tenants/tenants.types";
import { getErrorMessage } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";

export type TenantLifecycleAction =
  | "resendInvite"
  | "extendTrial"
  | "suspend"
  | "reactivate";

type TenantLifecycleDialogProps = {
  action: TenantLifecycleAction;
  onOpenChange: (open: boolean) => void;
  tenant: PlatformTenantDetail;
};

export function TenantLifecycleDialog({
  action,
  onOpenChange,
  tenant,
}: TenantLifecycleDialogProps) {
  const { t } = useTranslation("tenants");
  const resendMutation = useResendTenantOwnerInviteMutation();
  const extendMutation = useExtendTenantTrialMutation();
  const suspendMutation = useSuspendTenantMutation();
  const reactivateMutation = useReactivateTenantMutation();
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const intent = useRef<IdempotencyIntent | null>(null);
  const isPending =
    resendMutation.isPending ||
    extendMutation.isPending ||
    suspendMutation.isPending ||
    reactivateMutation.isPending;
  const requiresReason = action !== "resendInvite";
  const isDestructive = action === "suspend";

  function handleOpenChange(open: boolean) {
    if (!isPending) onOpenChange(open);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (requiresReason && !trimmedReason) {
      setError(t("lifecycle.reasonRequired"));
      return;
    }
    if (trimmedReason.length > 500) {
      setError(t("lifecycle.reasonTooLong"));
      return;
    }
    if (action === "extendTrial" && (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 32767)) {
      setError(t("lifecycle.daysInvalid"));
      return;
    }

    try {
      if (action === "resendInvite") {
        intent.current = idempotencyKeyForIntent(intent.current, {
          operation: "platform.tenant.owner-invitation.resend",
          tenantId: tenant.id,
        });
        await resendMutation.mutateAsync({
          tenantId: tenant.id,
          idempotencyKey: intent.current.key,
        });
      } else if (action === "extendTrial") {
        const input = { days: Number(days), reason: trimmedReason };
        intent.current = idempotencyKeyForIntent(intent.current, {
          operation: "platform.tenant.trial.extend",
          tenantId: tenant.id,
          input,
        });
        await extendMutation.mutateAsync({
          tenantId: tenant.id,
          input,
          idempotencyKey: intent.current.key,
        });
      } else if (action === "suspend") {
        const input = { reason: trimmedReason };
        intent.current = idempotencyKeyForIntent(intent.current, {
          operation: "platform.tenant.suspend",
          tenantId: tenant.id,
          input,
        });
        await suspendMutation.mutateAsync({
          tenantId: tenant.id,
          input,
          idempotencyKey: intent.current.key,
        });
      } else {
        const input = { reason: trimmedReason };
        intent.current = idempotencyKeyForIntent(intent.current, {
          operation: "platform.tenant.reactivate",
          tenantId: tenant.id,
          input,
        });
        await reactivateMutation.mutateAsync({
          tenantId: tenant.id,
          input,
          idempotencyKey: intent.current.key,
        });
      }
      onOpenChange(false);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    }
  }

  return (
    <AlertDialog onOpenChange={handleOpenChange} open>
      <AlertDialogContent>
        <form className="grid gap-4" noValidate onSubmit={submit}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`lifecycle.${action}.title`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(`lifecycle.${action}.description`, { name: tenant.displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}

          {action === "extendTrial" && (
            <div className="grid gap-2">
              <Label htmlFor="tenant-trial-days">{t("fields.trialDays")}</Label>
              <input
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                disabled={isPending}
                id="tenant-trial-days"
                inputMode="numeric"
                max="32767"
                min="1"
                onChange={(event) => {
                  setDays(event.target.value);
                  setError(null);
                }}
                type="number"
                value={days}
              />
            </div>
          )}

          {requiresReason && (
            <div className="grid gap-2">
              <Label htmlFor="tenant-lifecycle-reason">
                {t("fields.reason")}
                <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Textarea
                disabled={isPending}
                id="tenant-lifecycle-reason"
                maxLength={500}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError(null);
                }}
                rows={3}
                value={reason}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} type="button" variant="outline">
              {t("actions.cancel")}
            </AlertDialogCancel>
            <Button disabled={isPending} type="submit" variant={isDestructive ? "destructive" : "default"}>
              {isPending && <Spinner aria-label={t("actions.saving")} />}
              {t(`lifecycle.${action}.confirm`)}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
