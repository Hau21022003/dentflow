import { RHFTextField } from "@/components/form";
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
import { Spinner } from "@/components/ui/spinner";
import { handleApiError } from "@/shared/lib/error";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

export type TreatmentReasonForm = { reasonCode: string };

const reasonCodePattern = /^[A-Z][A-Z0-9_]{0,79}$/;

export function TreatmentPlanReasonDialog({
  description,
  onOpenChange,
  onSubmit,
  open,
  pending,
  submitLabel,
  title,
}: {
  description: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: TreatmentReasonForm) => Promise<void>;
  open: boolean;
  pending: boolean;
  submitLabel: string;
  title: string;
}) {
  const { t } = useTranslation("treatmentPlans");
  const form = useForm<TreatmentReasonForm>({
    defaultValues: { reasonCode: "" },
  });

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
              handleApiError<TreatmentReasonForm>({
                error,
                setError: form.setError,
              });
            }
          })}
        >
          {form.formState.errors.root?.server && (
            <Alert variant="destructive">
              {form.formState.errors.root.server.message}
            </Alert>
          )}
          <RHFTextField
            control={form.control}
            label={t("fields.reasonCode")}
            name="reasonCode"
            placeholder={t("fields.reasonCodePlaceholder")}
            required
            rules={{
              pattern: {
                value: reasonCodePattern,
                message: t("validation.reasonCode"),
              },
            }}
          />
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t("actions.close")}
            </Button>
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
