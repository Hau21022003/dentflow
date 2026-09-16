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
import { getErrorMessage } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";

type StaffActionDialogProps = {
  action:
    | "disable"
    | "enable"
    | "resend"
    | "revokeInvitation"
    | "revokeRole"
    | "removeFromBranch";
  description: string;
  intentCommand: Record<string, unknown>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string | undefined, idempotencyKey: string) => Promise<void>;
  open: boolean;
};

export function StaffActionDialog({
  action,
  description,
  intentCommand,
  onOpenChange,
  onSubmit,
  open,
}: StaffActionDialogProps) {
  const { t } = useTranslation("staff");
  const intent = useRef<IdempotencyIntent | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const reasonRequired = action !== "resend";
  const destructive =
    action === "disable" ||
    action.startsWith("revoke") ||
    action === "removeFromBranch";

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isPending) {
      setReason("");
      setError(null);
      intent.current = null;
      onOpenChange(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (reasonRequired && !normalizedReason) {
      setError(t("validation.reasonRequired"));
      return;
    }
    if (normalizedReason.length > 500) {
      setError(t("validation.reasonLength"));
      return;
    }

    try {
      setIsPending(true);
      intent.current = idempotencyKeyForIntent(intent.current, {
        ...intentCommand,
        ...(reasonRequired ? { reason: normalizedReason } : {}),
      });
      await onSubmit(reasonRequired ? normalizedReason : undefined, intent.current.key);
      onOpenChange(false);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={open}>
      <AlertDialogContent>
        <form className="grid gap-4" noValidate onSubmit={submit}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`actions.${action}.title`)}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          {reasonRequired && (
            <div className="grid gap-2">
              <Label htmlFor="staff-action-reason">
                {t("form.reason")}
                <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Textarea
                disabled={isPending}
                id="staff-action-reason"
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
            <Button disabled={isPending} type="submit" variant={destructive ? "destructive" : "default"}>
              {isPending && <Spinner aria-label={t("actions.saving")} />}
              {t(`actions.${action}.confirm`)}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
