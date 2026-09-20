import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCancelAppointmentMutation,
  useCheckInAppointmentMutation,
  useConfirmAppointmentMutation,
  useNoShowAppointmentMutation,
} from "@/features/appointments/appointments.hooks";
import type { Appointment, CancellationReasonCode, NoShowReasonCode } from "@/features/appointments/appointments.types";
import { handleApiError } from "@/shared/lib/error";
import { idempotencyKeyForIntent, type IdempotencyIntent } from "@/shared/lib/idempotency";
import { useToast } from "@/shared/components/ToastProvider";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AppointmentAction = "confirm" | "checkIn" | "cancel" | "noShow";
type Props = { action: AppointmentAction; appointment: Appointment; branchSlug: string; open: boolean; onOpenChange: (open: boolean) => void; tenantSlug: string };

export function AppointmentActionDialog({ action, appointment, branchSlug, open, onOpenChange, tenantSlug }: Props) {
  const { t } = useTranslation("appointments");
  const { success } = useToast();
  const [reasonCode, setReasonCode] = useState<CancellationReasonCode>("PATIENT_CANCELLED");
  const [noShowReasonCode, setNoShowReasonCode] = useState<NoShowReasonCode>("PATIENT_NO_SHOW");
  const [errorMessage, setErrorMessage] = useState("");
  const [intent, setIntent] = useState<IdempotencyIntent | null>(null);
  const confirm = useConfirmAppointmentMutation();
  const checkIn = useCheckInAppointmentMutation();
  const cancel = useCancelAppointmentMutation();
  const noShow = useNoShowAppointmentMutation();
  const pending = confirm.isPending || checkIn.isPending || cancel.isPending || noShow.isPending;
  const titleKey = action === "confirm" ? "confirmTitle" : action === "checkIn" ? "checkInTitle" : action === "cancel" ? "cancelTitle" : "noShowTitle";
  const descriptionKey = action === "confirm" ? "confirmDescription" : action === "checkIn" ? "checkInDescription" : action === "cancel" ? "cancelDescription" : "noShowDescription";

  async function submit() {
    setErrorMessage("");
    try {
      const command = { operation: `clinical.appointment.${action}`, tenantSlug, branchSlug, appointmentId: appointment.id, ...(action === "cancel" ? { reasonCode } : action === "noShow" ? { reasonCode: noShowReasonCode } : {}) };
      const nextIntent = idempotencyKeyForIntent(intent, command);
      setIntent(nextIntent);
      if (action === "confirm") await confirm.mutateAsync({ tenantSlug, branchSlug, appointmentId: appointment.id, idempotencyKey: nextIntent.key });
      if (action === "checkIn") await checkIn.mutateAsync({ tenantSlug, branchSlug, appointmentId: appointment.id, idempotencyKey: nextIntent.key });
      if (action === "cancel") await cancel.mutateAsync({ tenantSlug, branchSlug, appointmentId: appointment.id, input: { reasonCode }, idempotencyKey: nextIntent.key });
      if (action === "noShow") await noShow.mutateAsync({ tenantSlug, branchSlug, appointmentId: appointment.id, input: { reasonCode: noShowReasonCode }, idempotencyKey: nextIntent.key });
      onOpenChange(false);
      success(
        t(
          `feedback.${
            action === "checkIn"
              ? "checkedIn"
              : action === "noShow"
                ? "noShow"
                : action === "cancel"
                  ? "cancelled"
                  : "confirmed"
          }`,
        ),
      );
    } catch (error) {
      handleApiError({ error, onMessage: setErrorMessage });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) { setErrorMessage(""); setIntent(null); onOpenChange(next); } }}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader><DialogTitle>{t(`actionDialog.${titleKey}`)}</DialogTitle><DialogDescription>{t(`actionDialog.${descriptionKey}`)}</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}
          {action === "cancel" && (
            <div className="grid gap-2"><label className="text-sm font-medium">{t("actionDialog.reason")}</label><Select onValueChange={(value) => setReasonCode(value as CancellationReasonCode)} value={reasonCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["PATIENT_CANCELLED", "CLINIC_CANCELLED", "DUPLICATE_BOOKING"] as const).map((reason) => <SelectItem key={reason} value={reason}>{t(`cancellationReasons.${reason}`)}</SelectItem>)}</SelectContent></Select></div>
          )}
          {action === "noShow" && (
            <div className="grid gap-2"><label className="text-sm font-medium">{t("actionDialog.reason")}</label><Select onValueChange={(value) => setNoShowReasonCode(value as NoShowReasonCode)} value={noShowReasonCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PATIENT_NO_SHOW">{t("noShowReasons.PATIENT_NO_SHOW")}</SelectItem></SelectContent></Select></div>
          )}
        </div>
        <DialogFooter><Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="outline">{t("actions.close")}</Button><Button disabled={pending} onClick={() => void submit()} type="button" variant={action === "cancel" || action === "noShow" ? "destructive" : "default"}>{t("actionDialog.submit")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { AppointmentAction };
