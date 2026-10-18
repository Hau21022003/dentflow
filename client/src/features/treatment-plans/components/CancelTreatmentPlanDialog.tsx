import { RHFTextarea } from "@/components/form";
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
import {
  TREATMENT_PLAN_CANCELLATION_REASON_CODES,
  type CancelTreatmentPlanInput,
  type TreatmentPlanCancellationReasonCode,
} from "@/features/treatment-plans/treatment-plans.types";
import { handleApiError } from "@/shared/lib/error";
import { cn } from "@/shared/lib/utils";
import {
  ArrowRightLeft,
  Ban,
  Copy,
  Ellipsis,
  FileText,
  History,
  Trash2,
  TriangleAlert,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

type CancelTreatmentPlanForm = {
  note: string;
  reasonCode: TreatmentPlanCancellationReasonCode;
};

const reasonIcons: Record<TreatmentPlanCancellationReasonCode, LucideIcon> = {
  PATIENT_REQUEST: UserRound,
  ENTERED_IN_ERROR: FileText,
  DUPLICATE: Copy,
  NO_LONGER_APPLICABLE: Ban,
  TRANSFER_OF_CARE: ArrowRightLeft,
  OTHER: Ellipsis,
};

export function CancelTreatmentPlanDialog({
  onOpenChange,
  onSubmit,
  open,
  pending,
}: {
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: CancelTreatmentPlanInput) => Promise<void>;
  open: boolean;
  pending: boolean;
}) {
  const { t } = useTranslation("treatmentPlans");
  const form = useForm<CancelTreatmentPlanForm>({
    defaultValues: { note: "", reasonCode: "PATIENT_REQUEST" },
    mode: "onChange",
  });
  const note = useWatch({ control: form.control, name: "note" }) ?? "";
  const reasonCode = useWatch({
    control: form.control,
    name: "reasonCode",
  });
  const noteRequired = reasonCode === "OTHER";
  const hasFieldErrors = Boolean(
    form.formState.errors.note || form.formState.errors.reasonCode,
  );

  useEffect(() => {
    if (open) {
      form.reset({ note: "", reasonCode: "PATIENT_REQUEST" });
    }
  }, [form, open]);

  useEffect(() => {
    if (open) void form.trigger("note");
  }, [form, open, reasonCode]);

  function handleOpenChange(nextOpen: boolean) {
    if (pending && !nextOpen) return;
    onOpenChange(nextOpen);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit(async (values) => {
            if (pending) return;
            form.clearErrors("root.server");
            try {
              const trimmedNote = values.note.trim();
              await onSubmit({
                reasonCode: values.reasonCode,
                ...(trimmedNote ? { note: trimmedNote } : {}),
              });
              onOpenChange(false);
            } catch (error) {
              handleApiError<CancelTreatmentPlanForm>({
                error,
                setError: form.setError,
              });
            }
          })}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
            <DialogHeader className="gap-3 pr-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-600">
                  <TriangleAlert aria-hidden="true" className="size-5" />
                </span>
                <DialogTitle className="text-xl font-semibold">
                  {t("dialogs.cancelPlan.title")}
                </DialogTitle>
              </div>
              <DialogDescription className="text-left leading-6">
                {t("dialogs.cancelPlan.description")}
              </DialogDescription>
            </DialogHeader>
            <Button
              aria-label={t("actions.close")}
              className="shrink-0"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {form.formState.errors.root?.server && (
              <Alert variant="destructive">
                {form.formState.errors.root.server.message}
              </Alert>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t("dialogs.cancelPlan.reasonLabel")}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </legend>
              <Controller
                control={form.control}
                name="reasonCode"
                rules={{ required: true }}
                render={({ field, fieldState }) => (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {TREATMENT_PLAN_CANCELLATION_REASON_CODES.map((code) => {
                        const Icon = reasonIcons[code];
                        const checked = field.value === code;
                        return (
                          <label
                            className={cn(
                              "flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/40 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
                              checked &&
                                "border-primary bg-primary/5 ring-1 ring-primary/20",
                              pending && "pointer-events-none opacity-60",
                            )}
                            key={code}
                          >
                            <input
                              aria-invalid={Boolean(fieldState.error)}
                              checked={checked}
                              className="sr-only"
                              disabled={pending}
                              name={field.name}
                              onBlur={field.onBlur}
                              onChange={() => field.onChange(code)}
                              ref={field.ref}
                              type="radio"
                              value={code}
                            />
                            <span
                              aria-hidden="true"
                              className={cn(
                                "mt-1 grid size-5 shrink-0 place-items-center rounded-full border",
                                checked
                                  ? "border-primary bg-primary"
                                  : "border-input bg-background",
                              )}
                            >
                              {checked && (
                                <span className="size-1.5 rounded-full bg-primary-foreground" />
                              )}
                            </span>
                            <Icon
                              aria-hidden="true"
                              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">
                                {t(`dialogs.cancelPlan.reasons.${code}.label`)}
                              </span>
                              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                                {t(
                                  `dialogs.cancelPlan.reasons.${code}.description`,
                                )}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {fieldState.error?.message && (
                      <p className="text-xs text-destructive">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </fieldset>

            <RHFTextarea
              className="min-h-20 resize-none text-sm"
              control={form.control}
              disabled={pending}
              label={
                <>
                  {t("dialogs.cancelPlan.noteLabel")}{" "}
                  <span className="font-normal text-muted-foreground">
                    {t(
                      noteRequired
                        ? "dialogs.cancelPlan.noteRequired"
                        : "dialogs.cancelPlan.noteOptional",
                    )}
                  </span>
                </>
              }
              maxLength={500}
              name="note"
              placeholder={t("dialogs.cancelPlan.notePlaceholder")}
              required={noteRequired}
              rules={{
                maxLength: {
                  value: 500,
                  message: t("dialogs.cancelPlan.validation.noteMax"),
                },
                validate: (value) =>
                  reasonCode !== "OTHER" || value.trim().length > 0
                    ? true
                    : t("dialogs.cancelPlan.validation.noteRequired"),
              }}
            />
            <p className="-mt-2 text-right text-xs text-muted-foreground tabular-nums">
              {t("dialogs.cancelPlan.noteCount", { count: note.length })}
            </p>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-5 py-4 sm:justify-between">
            <p className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <History aria-hidden="true" className="size-4" />
              {t("dialogs.cancelPlan.auditHint")}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                disabled={pending}
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                {t("actions.close")}
              </Button>
              <Button
                className="bg-destructive text-white hover:bg-destructive/90 hover:text-white"
                disabled={
                  pending ||
                  hasFieldErrors ||
                  !reasonCode ||
                  (noteRequired && note.trim().length === 0)
                }
                type="submit"
                variant="destructive"
              >
                {pending ? (
                  <Spinner aria-label={t("actions.saving")} />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                {t("dialogs.cancelPlan.submit")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
