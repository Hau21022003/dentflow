import { RHFTextarea } from "@/components/form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCreateVisitAddendumMutation } from "@/features/visits/visits.hooks";
import { useToast } from "@/shared/components/ToastProvider";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

const ADDENDUM_MAX_LENGTH = 10_000;

type AddendumFormValues = { content: string };

type VisitAddendumFormProps = {
  appointmentId: string;
  branchSlug: string;
  tenantSlug: string;
};

export function VisitAddendumForm({
  appointmentId,
  branchSlug,
  tenantSlug,
}: VisitAddendumFormProps) {
  const { t } = useTranslation("visits");
  const { success } = useToast();
  const mutation = useCreateVisitAddendumMutation();
  const [intent, setIntent] = useState<IdempotencyIntent | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        content: z
          .string()
          .trim()
          .min(1, t("validation.addendumRequired"))
          .max(ADDENDUM_MAX_LENGTH, t("validation.maxLength")),
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
  } = useForm<AddendumFormValues>({
    defaultValues: { content: "" },
    resolver: zodResolver(schema),
  });

  async function submit(values: AddendumFormValues) {
    clearErrors("root");
    const input = { content: values.content.trim() };

    try {
      const nextIntent = idempotencyKeyForIntent(intent, {
        operation: "clinical.visit.addendum.create",
        tenantSlug,
        branchSlug,
        appointmentId,
        input,
      });
      setIntent(nextIntent);
      await mutation.mutateAsync({
        tenantSlug,
        branchSlug,
        appointmentId,
        input,
        idempotencyKey: nextIntent.key,
      });
      setIntent(null);
      reset({ content: "" });
      success(t("feedback.addendumAdded"));
    } catch (error) {
      handleApiError<AddendumFormValues>({ error, setError });
    }
  }

  return (
    <section className="space-y-4 border-t pt-6" aria-labelledby="visit-addendum-form">
      <div>
        <h2 className="text-lg font-semibold" id="visit-addendum-form">
          {t("addendum.createTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("addendum.createDescription")}
        </p>
      </div>
      <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
        {errors.root?.server?.message && (
          <Alert variant="destructive">{errors.root.server.message}</Alert>
        )}
        <RHFTextarea
          control={control}
          fullWidth
          label={t("addendum.content")}
          maxLength={ADDENDUM_MAX_LENGTH}
          name="content"
          required
          rows={4}
        />
        <div className="flex justify-end">
          <Button disabled={!isDirty || mutation.isPending} type="submit">
            {mutation.isPending && <Spinner aria-label={t("actions.saving")} />}
            {t("actions.addAddendum")}
          </Button>
        </div>
      </form>
    </section>
  );
}
