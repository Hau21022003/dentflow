import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { FormDialog } from "@/components/form";
import { RHFTextField } from "@/components/form/RHFTextField";
import { Alert } from "@/components/ui/alert";
import {
  useCreateBranchMutation,
  useUpdateBranchMutation,
} from "@/features/branches/branches.hooks";
import type {
  Branch,
  CreateBranchInput,
  UpdateBranchInput,
} from "@/features/branches/branches.types";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";

const BRANCH_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type BranchFormValues = {
  slug: string;
  name: string;
  address: string;
  phone: string;
  timezone: string;
};

type BranchFormDialogProps = {
  branch?: Branch;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tenantSlug: string;
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isValidTimeZone(value: string): boolean {
  if (value.length === 0) return true;

  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function initialValues(branch?: Branch): BranchFormValues {
  return {
    slug: branch?.slug ?? "",
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
    timezone: branch?.timezone ?? "",
  };
}

function updateInput(values: BranchFormValues, branch: Branch): UpdateBranchInput {
  const input: UpdateBranchInput = {};
  const normalized = {
    name: normalizeWhitespace(values.name),
    address: normalizeWhitespace(values.address),
    phone: values.phone.trim(),
    timezone: values.timezone.trim() || null,
  };

  if (normalized.name !== branch.name) input.name = normalized.name;
  if (normalized.address !== branch.address) input.address = normalized.address;
  if (normalized.phone !== branch.phone) input.phone = normalized.phone;
  if (normalized.timezone !== branch.timezone) input.timezone = normalized.timezone;

  return input;
}

export function BranchFormDialog({
  branch,
  onOpenChange,
  open,
  tenantSlug,
}: BranchFormDialogProps) {
  const { t } = useTranslation("branches");
  const { t: tValidation } = useTranslation("validation");
  const isCreate = branch === undefined;
  const defaults = useMemo(() => initialValues(branch), [branch]);
  const createMutation = useCreateBranchMutation();
  const updateMutation = useUpdateBranchMutation();
  const mutation = isCreate ? createMutation : updateMutation;
  const [idempotencyIntent, setIdempotencyIntent] =
    useState<IdempotencyIntent | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        slug: z
          .string()
          .trim()
          .min(1, tValidation("required", { field: t("fields.slug") }))
          .max(100, tValidation("maxLength", { field: t("fields.slug"), max: 100 }))
          .regex(
            BRANCH_SLUG_PATTERN,
            tValidation("pattern", { field: t("fields.slug") }),
          ),
        name: z
          .string()
          .trim()
          .min(1, tValidation("required", { field: t("fields.name") }))
          .max(150, tValidation("maxLength", { field: t("fields.name"), max: 150 })),
        address: z
          .string()
          .trim()
          .min(1, tValidation("required", { field: t("fields.address") }))
          .max(500, tValidation("maxLength", { field: t("fields.address"), max: 500 })),
        phone: z
          .string()
          .trim()
          .min(1, tValidation("required", { field: t("fields.phone") }))
          .max(30, tValidation("maxLength", { field: t("fields.phone"), max: 30 })),
        timezone: z
          .string()
          .trim()
          .max(64, tValidation("maxLength", { field: t("fields.timezone"), max: 64 }))
          .refine(
            isValidTimeZone,
            tValidation("invalid", { field: t("fields.timezone") }),
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
  } = useForm<BranchFormValues>({
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

  async function submit(values: BranchFormValues) {
    try {
      if (branch) {
        const input = updateInput(values, branch);
        if (Object.keys(input).length > 0) {
          const intent = idempotencyKeyForIntent(idempotencyIntent, {
            operation: "tenant.branch.update",
            tenantSlug,
            branchSlug: branch.slug,
            input,
          });
          setIdempotencyIntent(intent);
          await updateMutation.mutateAsync({
            tenantSlug,
            branchSlug: branch.slug,
            input,
            idempotencyKey: intent.key,
          });
        }
        handleOpenChange(false);
        return;
      }

      const timezone = values.timezone.trim();
      const input: CreateBranchInput = {
        slug: values.slug.trim(),
        name: normalizeWhitespace(values.name),
        address: normalizeWhitespace(values.address),
        phone: values.phone.trim(),
        ...(timezone ? { timezone } : {}),
      };
      const intent = idempotencyKeyForIntent(idempotencyIntent, {
        operation: "tenant.branch.create",
        tenantSlug,
        input,
      });
      setIdempotencyIntent(intent);
      await createMutation.mutateAsync({
        tenantSlug,
        input,
        idempotencyKey: intent.key,
      });
      handleOpenChange(false);
    } catch (error) {
      handleApiError<BranchFormValues>({ error, setError });
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
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <RHFTextField
            control={control}
            disabled={!isCreate}
            fullWidth
            helperText={!isCreate ? t("form.slugLocked") : t("form.slugHint")}
            label={t("fields.slug")}
            maxLength={100}
            name="slug"
            required
          />
          <RHFTextField
            control={control}
            fullWidth
            label={t("fields.name")}
            maxLength={150}
            name="name"
            required
          />
          <div className="sm:col-span-2">
            <RHFTextField
              control={control}
              fullWidth
              label={t("fields.address")}
              maxLength={500}
              name="address"
              required
            />
          </div>
          <RHFTextField
            control={control}
            fullWidth
            label={t("fields.phone")}
            maxLength={30}
            name="phone"
            required
            type="tel"
          />
          <RHFTextField
            control={control}
            fullWidth
            helperText={t("form.timezoneHint")}
            label={t("fields.timezone")}
            maxLength={64}
            name="timezone"
          />
        </div>
      </div>
    </FormDialog>
  );
}
