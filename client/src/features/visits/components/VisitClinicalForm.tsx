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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { cn } from "@/shared/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ClipboardPenLine, CloudUpload } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

const CLINICAL_TEXT_MAX_LENGTH = 10_000;
const FORM_ID = "visit-clinical-form";

type VisitFormValues = Record<VisitClinicalField, string>;

type VisitClinicalFormProps = {
  appointmentId: string;
  aside?: ReactNode;
  branchSlug: string;
  completedExtras?: ReactNode;
  locale: string;
  tenantSlug: string;
  timeZone: string;
  visible?: boolean;
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
  aside,
  branchSlug,
  completedExtras,
  locale,
  tenantSlug,
  timeZone,
  visible = true,
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
  const savedTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }).format(new Date(visit.updatedAt)),
    [locale, timeZone, visit.updatedAt],
  );

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
      toast.success(t("feedback.saved"), { position: "top-right" });
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
      toast.success(t("feedback.completed"), { position: "top-right" });
    } catch (error) {
      handleApiError({ error, onMessage: setCompleteError });
    }
  }

  if (visit.status === "COMPLETED") {
    return (
      <Card className={cn(!visible && "hidden")}>
        <CardContent className="space-y-6 p-5 sm:p-6">
          <section className="space-y-5" aria-labelledby="visit-original-content">
            <div>
              <h2 className="text-lg font-semibold" id="visit-original-content">
                {t("completed.originalContent")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("completed.originalContentDescription")}
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {VISIT_CLINICAL_FIELDS.map((field, index) => {
                const textareaId = `visit-${field}`;
                const fullWidth = index === 0 || index >= 3;
                return (
                  <div
                    className={cn("grid gap-2", fullWidth && "md:col-span-2")}
                    key={field}
                  >
                    <Label htmlFor={textareaId}>{t(`fields.${field}`)}</Label>
                    <Textarea
                      id={textareaId}
                      readOnly
                      rows={field === "clinicalNote" ? 4 : 3}
                      value={visit[field] ?? ""}
                    />
                  </div>
                );
              })}
            </div>
          </section>
          {completedExtras}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <form
        className={cn(
          "grid items-start gap-4 lg:grid-cols-[minmax(0,13fr)_minmax(18rem,7fr)]",
          !visible && "hidden",
        )}
        id={FORM_ID}
        noValidate
        onSubmit={handleSubmit(saveDraft)}
      >
        <Card>
          <CardHeader className="flex-row items-start gap-3 border-b">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <ClipboardPenLine aria-hidden="true" className="size-5" />
            </span>
            <div>
              <CardTitle>{t("open.title")}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("open.description")}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {errors.root?.server?.message && (
              <Alert variant="destructive">{errors.root.server.message}</Alert>
            )}
            <RHFTextarea
              control={control}
              fullWidth
              label={t("fields.symptoms")}
              maxLength={CLINICAL_TEXT_MAX_LENGTH}
              name="symptoms"
              rows={3}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <RHFTextarea
                control={control}
                fullWidth
                label={t("fields.relevantHistory")}
                maxLength={CLINICAL_TEXT_MAX_LENGTH}
                name="relevantHistory"
                rows={3}
              />
              <RHFTextarea
                control={control}
                fullWidth
                label={t("fields.examination")}
                maxLength={CLINICAL_TEXT_MAX_LENGTH}
                name="examination"
                rows={3}
              />
            </div>
            <RHFTextarea
              control={control}
              fullWidth
              label={t("fields.diagnosis")}
              maxLength={CLINICAL_TEXT_MAX_LENGTH}
              name="diagnosis"
              rows={3}
            />
            <RHFTextarea
              control={control}
              fullWidth
              label={t("fields.clinicalNote")}
              maxLength={CLINICAL_TEXT_MAX_LENGTH}
              name="clinicalNote"
              rows={4}
            />
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
          </CardContent>
        </Card>
        <aside className="min-w-0 space-y-4">{aside}</aside>
      </form>

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 shadow-[0_-8px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur lg:left-[17rem]",
          !visible && "hidden",
        )}
      >
        <div className="mx-auto flex max-w-[96rem] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground sm:mr-2">
            {updateMutation.isPending ? (
              <Spinner aria-label={t("actions.saving")} />
            ) : isDirty ? (
              <CloudUpload aria-hidden="true" className="size-4 text-amber-600" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
            )}
            <span>
              {updateMutation.isPending
                ? t("saveStatus.saving")
                : isDirty
                  ? t("saveStatus.unsaved")
                  : t("saveStatus.savedAt", { time: savedTime })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              disabled={!isDirty || isPending}
              form={FORM_ID}
              type="submit"
              variant="outline"
            >
              {updateMutation.isPending && (
                <Spinner aria-label={t("actions.saving")} />
              )}
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
        </div>
      </div>

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
