import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { FormDialog } from "@/components/form";
import { RHFSelect, type RHFSelectOption } from "@/components/form/RHFSelect";
import { RHFTextField } from "@/components/form/RHFTextField";
import { useSubscriptionPlansQuery } from "@/features/subscription-plans/subscription-plans.hooks";
import {
  useCreatePlatformTenantMutation,
  useUpdatePlatformTenantMutation,
} from "@/features/tenants/tenants.hooks";
import type {
  CreatePlatformTenantInput,
  PlatformTenantDetail,
  UpdatePlatformTenantInput,
} from "@/features/tenants/tenants.types";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";

const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/;

type TenantFormValues = {
  legalName: string;
  displayName: string;
  slug: string;
  billingEmail: string;
  ownerEmail: string;
  ownerFullName: string;
  planId: string;
  trialDays: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
  defaultLocale: string;
  defaultTimezone: string;
};

type TenantFormDialogProps = {
  onCreated?: (tenant: PlatformTenantDetail) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tenant?: PlatformTenantDetail;
};

function initialValues(tenant?: PlatformTenantDetail): TenantFormValues {
  return {
    legalName: tenant?.legalName ?? "",
    displayName: tenant?.displayName ?? "",
    slug: tenant?.slug ?? "",
    billingEmail: tenant?.billingEmail ?? "",
    ownerEmail: "",
    ownerFullName: "",
    planId: tenant?.subscription?.plan.id ?? "",
    trialDays: "",
    contactEmail: tenant?.contactEmail ?? "",
    contactPhone: tenant?.contactPhone ?? "",
    logoUrl: tenant?.logoUrl ?? "",
    defaultLocale: tenant?.defaultLocale ?? "vi",
    defaultTimezone: tenant?.defaultTimezone ?? "Asia/Ho_Chi_Minh",
  };
}

function updateInput(
  values: TenantFormValues,
  tenant: PlatformTenantDetail,
): UpdatePlatformTenantInput {
  const input: UpdatePlatformTenantInput = {};
  const normalized = {
    legalName: values.legalName.trim(),
    displayName: values.displayName.trim(),
    billingEmail: values.billingEmail.trim(),
    contactEmail: values.contactEmail.trim() || null,
    contactPhone: values.contactPhone.trim() || null,
    logoUrl: values.logoUrl.trim() || null,
    defaultLocale: values.defaultLocale.trim(),
    defaultTimezone: values.defaultTimezone.trim(),
  };

  if (normalized.legalName !== tenant.legalName) input.legalName = normalized.legalName;
  if (normalized.displayName !== tenant.displayName) input.displayName = normalized.displayName;
  if (normalized.billingEmail !== tenant.billingEmail) input.billingEmail = normalized.billingEmail;
  if (normalized.contactEmail !== tenant.contactEmail) input.contactEmail = normalized.contactEmail;
  if (normalized.contactPhone !== tenant.contactPhone) input.contactPhone = normalized.contactPhone;
  if (normalized.logoUrl !== tenant.logoUrl) input.logoUrl = normalized.logoUrl;
  if (normalized.defaultLocale !== tenant.defaultLocale) input.defaultLocale = normalized.defaultLocale;
  if (normalized.defaultTimezone !== tenant.defaultTimezone) input.defaultTimezone = normalized.defaultTimezone;
  return input;
}

export function TenantFormDialog({
  onCreated,
  onOpenChange,
  open,
  tenant,
}: TenantFormDialogProps) {
  const { t } = useTranslation("tenants");
  const { t: tValidation } = useTranslation("validation");
  const isCreate = tenant === undefined;
  const plansQuery = useSubscriptionPlansQuery();
  const activePlans = useMemo(
    () => (plansQuery.data ?? []).filter((plan) => plan.isActive),
    [plansQuery.data],
  );
  const schema = useMemo(
    () =>
      z.object({
        legalName: z.string().trim().min(1, tValidation("required", { field: t("fields.legalName") })).max(200, tValidation("maxLength", { field: t("fields.legalName"), max: 200 })),
        displayName: z.string().trim().min(1, tValidation("required", { field: t("fields.displayName") })).max(150, tValidation("maxLength", { field: t("fields.displayName"), max: 150 })),
        slug: z.string().trim().min(1, tValidation("required", { field: t("fields.slug") })).max(100, tValidation("maxLength", { field: t("fields.slug"), max: 100 })).regex(TENANT_SLUG_PATTERN, tValidation("pattern", { field: t("fields.slug") })),
        billingEmail: z.string().trim().email(tValidation("email", { field: t("fields.billingEmail") })).max(254, tValidation("maxLength", { field: t("fields.billingEmail"), max: 254 })),
        ownerEmail: isCreate
          ? z.string().trim().email(tValidation("email", { field: t("fields.ownerEmail") })).max(254, tValidation("maxLength", { field: t("fields.ownerEmail"), max: 254 }))
          : z.string(),
        ownerFullName: isCreate
          ? z.string().trim().min(1, tValidation("required", { field: t("fields.ownerFullName") })).max(150, tValidation("maxLength", { field: t("fields.ownerFullName"), max: 150 }))
          : z.string(),
        planId: isCreate
          ? z.string().min(1, tValidation("selectionRequired", { field: t("fields.plan") }))
          : z.string(),
        trialDays: z.string().refine((value) => value.length === 0 || /^\d+$/.test(value), tValidation("integer", { field: t("fields.trialDays") })).refine((value) => value.length === 0 || (Number(value) >= 1 && Number(value) <= 32767), tValidation("minNumber", { field: t("fields.trialDays"), min: 1 })),
        contactEmail: z.string().trim().refine((value) => value.length === 0 || z.email().safeParse(value).success, tValidation("email", { field: t("fields.contactEmail") })).max(254, tValidation("maxLength", { field: t("fields.contactEmail"), max: 254 })),
        contactPhone: z.string().trim().max(30, tValidation("maxLength", { field: t("fields.contactPhone"), max: 30 })),
        logoUrl: z.string().trim().max(2048, tValidation("maxLength", { field: t("fields.logoUrl"), max: 2048 })),
        defaultLocale: z.string().trim().regex(LOCALE_PATTERN, tValidation("pattern", { field: t("fields.defaultLocale") })).max(10, tValidation("maxLength", { field: t("fields.defaultLocale"), max: 10 })),
        defaultTimezone: z.string().trim().min(1, tValidation("required", { field: t("fields.defaultTimezone") })).max(64, tValidation("maxLength", { field: t("fields.defaultTimezone"), max: 64 })),
      }),
    [isCreate, t, tValidation],
  );
  const defaults = useMemo(() => initialValues(tenant), [tenant]);
  const createMutation = useCreatePlatformTenantMutation();
  const updateMutation = useUpdatePlatformTenantMutation();
  const mutation = isCreate ? createMutation : updateMutation;
  const [idempotencyIntent, setIdempotencyIntent] =
    useState<IdempotencyIntent | null>(null);
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
    setError,
  } = useForm<TenantFormValues>({
    defaultValues: defaults,
    resolver: zodResolver(schema),
  });
  const selectedPlanId = useWatch({ control, name: "planId" });
  const selectedPlan = activePlans.find((plan) => plan.id === selectedPlanId);
  const planOptions = useMemo(
    () =>
      activePlans.map((plan) => ({
        label: `${plan.name} · ${plan.code}`,
        value: plan.id,
      })) satisfies RHFSelectOption[],
    [activePlans],
  );

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

  async function submit(values: TenantFormValues) {
    if (isCreate && !selectedPlan?.trialDays && values.trialDays.trim().length === 0) {
      setError("trialDays", {
        type: "validate",
        message: t("form.trialDaysRequired"),
      });
      return;
    }

    try {
      if (tenant) {
        const input = updateInput(values, tenant);
        if (Object.keys(input).length > 0) {
          const intent = idempotencyKeyForIntent(idempotencyIntent, {
            operation: "platform.tenant.update",
            tenantId: tenant.id,
            input,
          });
          setIdempotencyIntent(intent);
          await updateMutation.mutateAsync({
            tenantId: tenant.id,
            input,
            idempotencyKey: intent.key,
          });
        }
        handleOpenChange(false);
        return;
      }

      const input: CreatePlatformTenantInput = {
        legalName: values.legalName.trim(),
        displayName: values.displayName.trim(),
        slug: values.slug.trim(),
        billingEmail: values.billingEmail.trim(),
        ownerEmail: values.ownerEmail.trim(),
        ownerFullName: values.ownerFullName.trim(),
        planId: values.planId,
        ...(values.trialDays.trim()
          ? { trialDays: Number(values.trialDays) }
          : {}),
        defaultLocale: values.defaultLocale.trim(),
        defaultTimezone: values.defaultTimezone.trim(),
      };
      const intent = idempotencyKeyForIntent(idempotencyIntent, {
        operation: "platform.tenant.create",
        input,
      });
      setIdempotencyIntent(intent);
      const created = await createMutation.mutateAsync({
        input,
        idempotencyKey: intent.key,
      });
      handleOpenChange(false);
      onCreated?.(created);
    } catch (error) {
      handleApiError<TenantFormValues>({ error, setError });
    }
  }

  return (
    <FormDialog
      contentClassName="sm:max-w-2xl"
      description={t(isCreate ? "form.createDescription" : "form.editDescription")}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
      noValidate
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit(submit)}
      open={open}
      submitDisabled={isCreate && activePlans.length === 0}
      submitText={t(isCreate ? "actions.create" : "actions.save")}
      title={t(isCreate ? "form.createTitle" : "form.editTitle")}
    >
      <div className="space-y-5">
        {errors.root?.server?.message && (
          <Alert variant="destructive">{errors.root.server.message}</Alert>
        )}
        {isCreate && plansQuery.isSuccess && activePlans.length === 0 && (
          <Alert variant="destructive">{t("form.noActivePlans")}</Alert>
        )}

        <div className="grid items-start gap-5 sm:grid-cols-2">
          <RHFTextField control={control} fullWidth label={t("fields.legalName")} maxLength={200} name="legalName" required />
          <RHFTextField control={control} fullWidth label={t("fields.displayName")} maxLength={150} name="displayName" required />
          <RHFTextField control={control} disabled={!isCreate} fullWidth helperText={!isCreate ? t("form.slugLocked") : t("form.slugHint")} maxLength={100} name="slug" required label={t("fields.slug")} />
          <RHFTextField control={control} fullWidth label={t("fields.billingEmail")} maxLength={254} name="billingEmail" required type="email" />
        </div>

        {isCreate ? (
          <div className="space-y-4 rounded-xl border border-border/70 p-4">
            <h3 className="font-semibold">{t("form.ownerAndPlan")}</h3>
            <div className="grid items-start gap-5 sm:grid-cols-2">
              <RHFTextField control={control} fullWidth label={t("fields.ownerFullName")} maxLength={150} name="ownerFullName" required />
              <RHFTextField control={control} fullWidth label={t("fields.ownerEmail")} maxLength={254} name="ownerEmail" required type="email" />
              <RHFSelect control={control} fullWidth label={t("fields.plan")} name="planId" options={planOptions} placeholder={t("form.planPlaceholder")} required />
              <RHFTextField control={control} fullWidth helperText={selectedPlan?.trialDays ? t("form.planTrialDays", { days: selectedPlan.trialDays }) : t("form.trialOverrideHint")} inputMode="numeric" label={t("fields.trialDays")} name="trialDays" />
            </div>
          </div>
        ) : null}

        {!isCreate && (
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <RHFTextField control={control} fullWidth label={t("fields.contactEmail")} maxLength={254} name="contactEmail" type="email" />
            <RHFTextField control={control} fullWidth label={t("fields.contactPhone")} maxLength={30} name="contactPhone" />
            <div className="sm:col-span-2">
              <RHFTextField control={control} fullWidth label={t("fields.logoUrl")} maxLength={2048} name="logoUrl" />
            </div>
          </div>
        )}

        <div className="grid items-start gap-5 sm:grid-cols-2">
          <RHFTextField control={control} fullWidth label={t("fields.defaultLocale")} maxLength={10} name="defaultLocale" required />
          <RHFTextField control={control} fullWidth label={t("fields.defaultTimezone")} maxLength={64} name="defaultTimezone" required />
        </div>
      </div>
    </FormDialog>
  );
}
