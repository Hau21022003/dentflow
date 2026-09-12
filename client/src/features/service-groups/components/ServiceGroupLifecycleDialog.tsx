import { useRef, useState, type FormEvent } from "react";
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
  useActivateServiceGroupMutation,
  useDeactivateServiceGroupMutation,
} from "@/features/service-groups/service-groups.hooks";
import type { ServiceGroup } from "@/features/service-groups/service-groups.types";
import { getErrorMessage } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";

export type ServiceGroupLifecycleAction = "activate" | "deactivate";

type ServiceGroupLifecycleDialogProps = {
  action: ServiceGroupLifecycleAction;
  onOpenChange: (open: boolean) => void;
  serviceGroup: ServiceGroup;
  tenantSlug: string;
};

export function ServiceGroupLifecycleDialog({
  action,
  onOpenChange,
  serviceGroup,
  tenantSlug,
}: ServiceGroupLifecycleDialogProps) {
  const { t } = useTranslation("serviceGroups");
  const activateMutation = useActivateServiceGroupMutation();
  const deactivateMutation = useDeactivateServiceGroupMutation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const intent = useRef<IdempotencyIntent | null>(null);
  const isPending = activateMutation.isPending || deactivateMutation.isPending;
  const isDeactivating = action === "deactivate";

  function handleOpenChange(open: boolean) {
    if (!isPending) onOpenChange(open);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
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
        operation: `tenant.service-group.${action}`,
        tenantSlug,
        serviceGroupId: serviceGroup.id,
        input,
      });
      const command = {
        tenantSlug,
        serviceGroupId: serviceGroup.id,
        input,
        idempotencyKey: intent.current.key,
      };
      if (isDeactivating) {
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
              {t(`lifecycle.${action}.description`, { name: serviceGroup.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isDeactivating && <Alert>{t("lifecycle.deactivate.notice")}</Alert>}
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid gap-2">
            <Label htmlFor="service-group-lifecycle-reason">
              {t("fields.reason")}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Textarea
              disabled={isPending}
              id="service-group-lifecycle-reason"
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
              variant={isDeactivating ? "destructive" : "default"}
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
