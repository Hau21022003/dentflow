import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { FormDialog, RHFTextField } from "@/components/form";
import { Alert } from "@/components/ui/alert";
import {
  useCreateServiceGroupMutation,
  useUpdateServiceGroupMutation,
} from "@/features/service-groups/service-groups.hooks";
import type {
  CreateServiceGroupInput,
  ServiceGroup,
  UpdateServiceGroupInput,
} from "@/features/service-groups/service-groups.types";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";

type ServiceGroupFormValues = {
  name: string;
};

type ServiceGroupFormDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  serviceGroup?: ServiceGroup;
  tenantSlug: string;
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function initialValues(
  serviceGroup?: ServiceGroup,
): ServiceGroupFormValues {
  return { name: serviceGroup?.name ?? "" };
}

export function ServiceGroupFormDialog({
  onOpenChange,
  open,
  serviceGroup,
  tenantSlug,
}: ServiceGroupFormDialogProps) {
  const { t } = useTranslation("serviceGroups");
  const { t: tValidation } = useTranslation("validation");
  const isCreate = serviceGroup === undefined;
  const defaults = useMemo(() => initialValues(serviceGroup), [serviceGroup]);
  const createMutation = useCreateServiceGroupMutation();
  const updateMutation = useUpdateServiceGroupMutation();
  const mutation = isCreate ? createMutation : updateMutation;
  const [idempotencyIntent, setIdempotencyIntent] =
    useState<IdempotencyIntent | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, tValidation("required", { field: t("fields.name") }))
          .max(
            100,
            tValidation("maxLength", { field: t("fields.name"), max: 100 }),
          ),
      }),
    [t, tValidation],
  );
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
    setError,
  } = useForm<ServiceGroupFormValues>({
    defaultValues: defaults,
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [defaults, open, reset]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setIdempotencyIntent(null);
      reset(defaults);
    }
    onOpenChange(nextOpen);
  }

  async function submit(values: ServiceGroupFormValues) {
    const name = normalizeWhitespace(values.name);

    try {
      if (serviceGroup) {
        if (name !== serviceGroup.name) {
          const input: UpdateServiceGroupInput = { name };
          const intent = idempotencyKeyForIntent(idempotencyIntent, {
            operation: "tenant.service-group.update",
            tenantSlug,
            serviceGroupId: serviceGroup.id,
            input,
          });
          setIdempotencyIntent(intent);
          await updateMutation.mutateAsync({
            tenantSlug,
            serviceGroupId: serviceGroup.id,
            input,
            idempotencyKey: intent.key,
          });
        }
      } else {
        const input: CreateServiceGroupInput = { name };
        const intent = idempotencyKeyForIntent(idempotencyIntent, {
          operation: "tenant.service-group.create",
          tenantSlug,
          input,
        });
        setIdempotencyIntent(intent);
        await createMutation.mutateAsync({
          tenantSlug,
          input,
          idempotencyKey: intent.key,
        });
      }
      handleOpenChange(false);
    } catch (error) {
      handleApiError<ServiceGroupFormValues>({ error, setError });
    }
  }

  return (
    <FormDialog
      description={t(isCreate ? "form.createDescription" : "form.editDescription")}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
      noValidate
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit(submit)}
      open={open}
      submitText={t(isCreate ? "actions.create" : "actions.save")}
      title={t(isCreate ? "form.createTitle" : "form.editTitle")}
    >
      <div className="space-y-5">
        {errors.root?.server?.message && (
          <Alert variant="destructive">{errors.root.server.message}</Alert>
        )}
        <RHFTextField
          control={control}
          fullWidth
          label={t("fields.name")}
          maxLength={100}
          name="name"
          required
        />
      </div>
    </FormDialog>
  );
}
