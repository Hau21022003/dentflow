import { RHFTextarea } from "@/components/form";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
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
  useCompleteVisitMutation,
  useUpdateVisitMutation,
} from "@/features/visits/visits.hooks";
import {
  VISIT_CLINICAL_FIELDS,
  type UpdateVisitInput,
  type Visit,
  type VisitClinicalField,
} from "@/features/visits/visits.types";
import { handleApiError } from "@/shared/lib/error";
import { toast } from "sonner";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

const CLINICAL_TEXT_MAX_LENGTH = 10_000;

type VisitFormValues = Record<VisitClinicalField, string>;

type VisitClinicalFormProps = {
  appointmentId: string;
  branchSlug: string;
  tenantSlug: string;
  visit: Visit;
};

function formValuesForVisit(visit: Visit): VisitFormValues {
  return {
    symptoms: visit.symptoms ?? "",
    relevantHistory: visit.relevantHistory ?? "",
    examination: visit.examination ?? "",
    diagnosis: visit.diagnosis ?? "",
    clinicalNote: visit.clinicalNote ?? "",
  };
}

function updateInputForVisit(
  visit: Visit,
  values: VisitFormValues,
): UpdateVisitInput {
  const input: UpdateVisitInput = {};

  for (const field of VISIT_CLINICAL_FIELDS) {
    const next = values[field].trim() || null;
    if (next !== visit[field]) input[field] = next;
  }

  return input;
}

function hasClinicalContent(visit: Visit): boolean {
  return VISIT_CLINICAL_FIELDS.some((field) => Boolean(visit[field]?.trim()));
}

export function VisitClinicalForm({
  appointmentId,
  branchSlug,
  tenantSlug,
  visit,
}: VisitClinicalFormProps) {
  const { t } = useTranslation("visits");
  const updateMutation = useUpdateVisitMutation();
  const completeMutation = useCompleteVisitMutation();
  const [saveIntent, setSaveIntent] = useState<IdempotencyIntent | null>(null);
  const [completeIntent, setCompleteIntent] =
    useState<IdempotencyIntent | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const defaults = useMemo(() => formValuesForVisit(visit), [visit]);
  const schema = useMemo(
    () =>
      z.object({
        symptoms: z.string().max(CLINICAL_TEXT_MAX_LENGTH, t("validation.maxLength")),
        relevantHistory: z
          .string()
          .max(CLINICAL_TEXT_MAX_LENGTH, t("validation.maxLength")),
        examination: z
          .string()
          .max(CLINICAL_TEXT_MAX_LENGTH, t("validation.maxLength")),
        diagnosis: z.string().max(CLINICAL_TEXT_MAX_LENGTH, t("validation.maxLength")),
        clinicalNote: z
          .string()
          .max(CLINICAL_TEXT_MAX_LENGTH, t("validation.maxLength")),
      }),
    [t],
  );
  const {
    clearErrors,
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
    setError,
  } = useForm<VisitFormValues>({
    defaultValues: defaults,
    resolver: zodResolver(schema),
  });
  const isPending = updateMutation.isPending || completeMutation.isPending;
  const canComplete = hasClinicalContent(visit) && !isDirty && !isPending;

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  async function saveDraft(values: VisitFormValues) {
    clearErrors("root");
    const input = updateInputForVisit(visit, values);
    if (Object.keys(input).length === 0) {
      reset(defaults);
      return;
    }

    try {
      const nextIntent = idempotencyKeyForIntent(saveIntent, {
        operation: "clinical.visit.update",
        tenantSlug,
        branchSlug,
        appointmentId,
        input,
      });
      setSaveIntent(nextIntent);
      const saved = await updateMutation.mutateAsync({
        tenantSlug,
        branchSlug,
        appointmentId,
        input,
        idempotencyKey: nextIntent.key,
      });
      setSaveIntent(null);
      reset(formValuesForVisit(saved));
      toast.success(t("feedback.saved"));
    } catch (error) {
      handleApiError<VisitFormValues>({ error, setError });
    }
  }

  async function completeVisit() {
    setCompleteError("");
    try {
      const nextIntent = idempotencyKeyForIntent(completeIntent, {
        operation: "clinical.visit.complete",
        tenantSlug,
        branchSlug,
        appointmentId,
      });
      setCompleteIntent(nextIntent);
      await completeMutation.mutateAsync({
        tenantSlug,
        branchSlug,
        appointmentId,
        idempotencyKey: nextIntent.key,
      });
      setCompleteIntent(null);
      setCompleteDialogOpen(false);
      toast.success(t("feedback.completed"));
    } catch (error) {
      handleApiError({ error, onMessage: setCompleteError });
    }
  }

  if (visit.status === "COMPLETED") {
    return (
      <section className="space-y-5" aria-labelledby="visit-original-content">
        <div>
          <h2 className="text-lg font-semibold" id="visit-original-content">
            {t("completed.originalContent")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("completed.originalContentDescription")}
          </p>
        </div>
        <div className="grid gap-5">
          {VISIT_CLINICAL_FIELDS.map((field) => {
            const textareaId = `visit-${field}`;
            return (
              <div className="grid gap-2" key={field}>
                <Label htmlFor={textareaId}>{t(`fields.${field}`)}</Label>
                <Textarea
                  id={textareaId}
                  readOnly
                  rows={4}
                  value={visit[field] ?? ""}
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <>
      <form className="space-y-6" noValidate onSubmit={handleSubmit(saveDraft)}>
        <div>
          <h2 className="text-lg font-semibold">{t("open.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("open.description")}
          </p>
        </div>
        {errors.root?.server?.message && (
          <Alert variant="destructive">{errors.root.server.message}</Alert>
        )}
        <div className="grid gap-5">
          {VISIT_CLINICAL_FIELDS.map((field) => (
            <RHFTextarea
              control={control}
              fullWidth
              key={field}
              label={t(`fields.${field}`)}
              maxLength={CLINICAL_TEXT_MAX_LENGTH}
              name={field}
              rows={4}
            />
          ))}
        </div>
        {!hasClinicalContent(visit) && (
          <p className="text-sm text-muted-foreground">
            {t("open.completeRequiresContent")}
          </p>
        )}
        {isDirty && (
          <p className="text-sm text-muted-foreground">
            {t("open.saveBeforeComplete")}
          </p>
        )}
        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
          <Button disabled={!isDirty || isPending} type="submit" variant="outline">
            {updateMutation.isPending && <Spinner aria-label={t("actions.saving")} />}
            {t("actions.saveDraft")}
          </Button>
          <Button
            disabled={!canComplete}
            onClick={() => setCompleteDialogOpen(true)}
            type="button"
          >
            {t("actions.complete")}
          </Button>
        </div>
      </form>

      <AlertDialog
        onOpenChange={(open) => {
          if (!completeMutation.isPending) {
            setCompleteError("");
            if (!open) setCompleteIntent(null);
            setCompleteDialogOpen(open);
          }
        }}
        open={completeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("completeDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("completeDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {completeError && <Alert variant="destructive">{completeError}</Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completeMutation.isPending} type="button">
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={completeMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void completeVisit();
              }}
              type="button"
            >
              {completeMutation.isPending && (
                <Spinner aria-label={t("actions.completing")} />
              )}
              {t("actions.confirmComplete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
