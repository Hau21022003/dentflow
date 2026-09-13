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
  useActivateBranchMutation,
  useDeactivateBranchMutation,
} from "@/features/branches/branches.hooks";
import type { Branch } from "@/features/branches/branches.types";
import { getErrorMessage } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";

export type BranchLifecycleAction = "activate" | "deactivate";

type BranchLifecycleDialogProps = {
  action: BranchLifecycleAction;
  branch: Branch;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
};

export function BranchLifecycleDialog({
  action,
  branch,
  onOpenChange,
  tenantSlug,
}: BranchLifecycleDialogProps) {
  const { t } = useTranslation("branches");
  const activateMutation = useActivateBranchMutation();
  const deactivateMutation = useDeactivateBranchMutation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const intent = useRef<IdempotencyIntent | null>(null);
  const isPending = activateMutation.isPending || deactivateMutation.isPending;
  const isDestructive = action === "deactivate";

  function handleOpenChange(open: boolean) {
    if (!isPending) onOpenChange(open);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { reason: reason.trim() };

    if (!input.reason) {
      setError(t("lifecycle.reasonRequired"));
      return;
    }
    if (input.reason.length > 500) {
      setError(t("lifecycle.reasonTooLong"));
      return;
    }

    try {
      intent.current = idempotencyKeyForIntent(intent.current, {
        operation: `tenant.branch.${action}`,
        tenantSlug,
        branchSlug: branch.slug,
        input,
      });
      const command = {
        tenantSlug,
        branchSlug: branch.slug,
        input,
        idempotencyKey: intent.current.key,
      };
      if (action === "deactivate") {
        await deactivateMutation.mutateAsync(command);
      } else {
        await activateMutation.mutateAsync(command);
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
              {t(`lifecycle.${action}.description`, { name: branch.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isDestructive && (
            <Alert>{t("lifecycle.deactivate.notice")}</Alert>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid gap-2">
            <Label htmlFor="branch-lifecycle-reason">
              {t("fields.reason")}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Textarea
              disabled={isPending}
              id="branch-lifecycle-reason"
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
            <AlertDialogCancel disabled={isPending} type="button" variant="outline">
              {t("actions.cancel")}
            </AlertDialogCancel>
            <Button
              disabled={isPending}
              type="submit"
              variant={isDestructive ? "destructive" : "default"}
            >
              {isPending && <Spinner aria-label={t("actions.saving")} />}
              {t(`lifecycle.${action}.confirm`)}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
