import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  FormDialog,
  RHFSelect,
  RHFTextField,
  type RHFSelectOption,
} from "@/components/form";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateSubscriptionPlanMutation,
  useUpdateSubscriptionPlanMutation,
} from "@/features/subscription-plans/subscription-plans.hooks";
import {
  MAX_SUBSCRIPTION_PLAN_AMOUNT,
  PLAN_CURRENCY_CODES,
  formatCurrencyOption,
  formatMajorAmountForInput,
  localeForLanguage,
  parseMajorAmount,
} from "@/features/subscription-plans/subscription-plans.price";
import type {
  CreateSubscriptionPlanInput,
  SubscriptionPlan,
  UpdateSubscriptionPlanInput,
} from "@/features/subscription-plans/subscription-plans.types";
import {
  createValidationMessages,
  type Translate,
  type ValidationMessages,
} from "@/i18n/validation";
import { handleApiError } from "@/shared/lib/error";

const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MAX_TRIAL_DAYS = 32_767;
const KNOWN_ENTITLEMENT_KEYS = [
  "maxBranches",
  "maxUsers",
  "analytics",
] as const;

type KnownEntitlementKey = (typeof KNOWN_ENTITLEMENT_KEYS)[number];

type PlanFormValues = {
  code: string;
  name: string;
  description: string;
  billingInterval: string;
  price: string;
  currency: string;
  providerPlanId: string;
  trialDays: string;
  maxBranches: string;
  maxUsers: string;
  analytics: string;
};

type SubscriptionPlanFormDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  plan?: SubscriptionPlan;
};

function createPlanFormSchema({
  isCreate,
  locale,
  tPlans,
  validation,
}: {
  isCreate: boolean;
  locale: string;
  tPlans: Translate;
  validation: ValidationMessages;
}) {
  const fields = (key: string) => tPlans(`form.fields.${key}`);

  return z
    .object({
      code: z
        .string()
        .trim()
        .min(1, validation.required(fields("code")))
        .max(100, validation.maxLength(fields("code"), 100))
        .regex(CODE_PATTERN, validation.pattern(fields("code"))),
      name: z
        .string()
        .trim()
        .min(1, validation.required(fields("name")))
        .max(150, validation.maxLength(fields("name"), 150)),
      description: z
        .string()
        .trim()
        .max(1000, validation.maxLength(fields("description"), 1000)),
      billingInterval: z
        .string()
        .refine(
          (value) => value === "MONTHLY" || value === "YEARLY",
          validation.selectionRequired(fields("billingInterval")),
        ),
      price: z
        .string()
        .trim()
        .min(1, validation.required(fields("price"))),
      currency: z
        .string()
        .trim()
        .regex(CURRENCY_PATTERN, validation.pattern(fields("currency"))),
      providerPlanId: z
        .string()
        .trim()
        .max(255, validation.maxLength(fields("providerPlanId"), 255)),
      trialDays: z.string().trim(),
      maxBranches: z.string().trim(),
      maxUsers: z.string().trim(),
      analytics: z.string(),
    })
    .superRefine((values, context) => {
      if (CURRENCY_PATTERN.test(values.currency)) {
        const amount = parseMajorAmount(values.price, values.currency, locale);
        if (amount === null) {
          context.addIssue({
            code: "custom",
            message: validation.invalid(fields("price")),
            path: ["price"],
          });
        }
      }

      validateOptionalPositiveInteger({
        context,
        field: "trialDays",
        label: fields("trialDays"),
        max: MAX_TRIAL_DAYS,
        value: values.trialDays,
        validation,
      });

      for (const field of ["maxBranches", "maxUsers"] as const) {
        const value = values[field];
        if (isCreate && value.length === 0) {
          context.addIssue({
            code: "custom",
            message: validation.required(fields(field)),
            path: [field],
          });
          continue;
        }

        validateOptionalPositiveInteger({
          context,
          field,
          label: fields(field),
          value,
          validation,
        });
      }

      const validAnalytics = values.analytics === "true" || values.analytics === "false";
      if (isCreate && !validAnalytics) {
        context.addIssue({
          code: "custom",
          message: validation.selectionRequired(fields("analytics")),
          path: ["analytics"],
        });
      } else if (!isCreate && values.analytics.length > 0 && !validAnalytics) {
        context.addIssue({
          code: "custom",
          message: validation.invalid(fields("analytics")),
          path: ["analytics"],
        });
      }
    });
}

function validateOptionalPositiveInteger({
  context,
  field,
  label,
  max,
  value,
  validation,
}: {
  context: z.RefinementCtx;
  field: "trialDays" | "maxBranches" | "maxUsers";
  label: string;
  max?: number;
  value: string;
  validation: ValidationMessages;
}) {
  if (value.length === 0) {
    return;
  }

  if (!/^\d+$/.test(value)) {
    context.addIssue({
      code: "custom",
      message: validation.integer(label),
      path: [field],
    });
    return;
  }

  const parsed = Number(value);
  if (parsed < 1) {
    context.addIssue({
      code: "custom",
      message: validation.positive(label),
      path: [field],
    });
    return;
  }

  if (max !== undefined && parsed > max) {
    context.addIssue({
      code: "custom",
      message: validation.maxNumber(label, max),
      path: [field],
    });
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function getInitialValues(plan: SubscriptionPlan | undefined, locale: string): PlanFormValues {
  const entitlements = plan?.entitlements ?? {};

  return {
    code: plan?.code ?? "",
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    billingInterval: plan?.billingInterval ?? "MONTHLY",
    price: plan
      ? formatMajorAmountForInput(plan.amount, plan.currency, locale)
      : "",
    currency: plan?.currency ?? "VND",
    providerPlanId: plan?.providerPlanId ?? "",
    trialDays: plan?.trialDays?.toString() ?? "",
    maxBranches: isPositiveInteger(entitlements.maxBranches)
      ? entitlements.maxBranches.toString()
      : "",
    maxUsers: isPositiveInteger(entitlements.maxUsers)
      ? entitlements.maxUsers.toString()
      : "",
    analytics:
      typeof entitlements.analytics === "boolean"
        ? String(entitlements.analytics)
        : plan
          ? ""
          : "false",
  };
}

function getUnknownEntitlements(plan: SubscriptionPlan | undefined): Record<string, unknown> {
  if (!plan) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(plan.entitlements).filter(
      ([key]) => !KNOWN_ENTITLEMENT_KEYS.includes(key as KnownEntitlementKey),
    ),
  );
}

function createEntitlements(values: PlanFormValues): Record<string, unknown> {
  return {
    maxBranches: Number(values.maxBranches),
    maxUsers: Number(values.maxUsers),
    analytics: values.analytics === "true",
  };
}

function areEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => areEqual(value, right[index]));
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) => Object.hasOwn(right, key) && areEqual(left[key], right[key]),
      )
    );
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildUpdateInput({
  dirtyFields,
  locale,
  plan,
  values,
}: {
  dirtyFields: Partial<Record<keyof PlanFormValues, boolean>>;
  locale: string;
  plan: SubscriptionPlan;
  values: PlanFormValues;
}): UpdateSubscriptionPlanInput {
  const input: UpdateSubscriptionPlanInput = {};
  const normalized = {
    name: values.name.trim(),
    description: values.description.trim() || null,
    billingInterval: values.billingInterval as SubscriptionPlan["billingInterval"],
    amount: parseMajorAmount(values.price, values.currency, locale)!,
    currency: values.currency.trim(),
    providerPlanId: values.providerPlanId.trim() || null,
    trialDays: values.trialDays.length > 0 ? Number(values.trialDays) : null,
  };

  if (normalized.name !== plan.name) input.name = normalized.name;
  if (normalized.description !== plan.description) input.description = normalized.description;
  if (normalized.billingInterval !== plan.billingInterval) {
    input.billingInterval = normalized.billingInterval;
  }
  if (normalized.amount !== plan.amount) input.amount = normalized.amount;
  if (normalized.currency !== plan.currency) input.currency = normalized.currency;
  if (normalized.providerPlanId !== plan.providerPlanId) {
    input.providerPlanId = normalized.providerPlanId;
  }
  if (normalized.trialDays !== plan.trialDays) input.trialDays = normalized.trialDays;

  const entitlementFields = ["maxBranches", "maxUsers", "analytics"] as const;
  if (entitlementFields.some((field) => dirtyFields[field])) {
    const entitlements = { ...plan.entitlements };

    if (values.maxBranches.length > 0) {
      entitlements.maxBranches = Number(values.maxBranches);
    }
    if (values.maxUsers.length > 0) {
      entitlements.maxUsers = Number(values.maxUsers);
    }
    if (values.analytics.length > 0) {
      entitlements.analytics = values.analytics === "true";
    }

    if (!areEqual(entitlements, plan.entitlements)) {
      input.entitlements = entitlements;
    }
  }

  return input;
}

export function SubscriptionPlanFormDialog({
  onOpenChange,
  open,
  plan,
}: SubscriptionPlanFormDialogProps) {
  const { i18n, t: tPlans } = useTranslation("plans");
  const { t: tValidation } = useTranslation("validation");
  const descriptionId = useId();
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const isCreate = plan === undefined;
  const validation = useMemo(
    () => createValidationMessages(tValidation),
    [tValidation],
  );
  const schema = useMemo(
    () =>
      createPlanFormSchema({
        isCreate,
        locale,
        tPlans,
        validation,
      }),
    [isCreate, locale, tPlans, validation],
  );
  const defaultValues = useMemo(
    () => getInitialValues(plan, locale),
    [locale, plan],
  );
  const unknownEntitlements = useMemo(() => getUnknownEntitlements(plan), [plan]);
  const createMutation = useCreateSubscriptionPlanMutation();
  const updateMutation = useUpdateSubscriptionPlanMutation();
  const mutation = isCreate ? createMutation : updateMutation;
  const {
    control,
    formState: { dirtyFields, errors, isDirty },
    handleSubmit,
    reset,
    setError,
  } = useForm<PlanFormValues>({
    defaultValues,
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [defaultValues, open, reset]);

  const billingIntervalOptions = useMemo(
    () =>
      ["MONTHLY", "YEARLY"].map((value) => ({
        label: tPlans(`billingIntervals.${value}`),
        value,
      })) satisfies RHFSelectOption[],
    [tPlans],
  );
  const analyticsOptions = useMemo(
    () =>
      [
        { label: tPlans("analyticsOptions.enabled"), value: "true" },
        { label: tPlans("analyticsOptions.disabled"), value: "false" },
      ] satisfies RHFSelectOption[],
    [tPlans],
  );
  const currencyOptions = useMemo(
    () =>
      [...new Set([...PLAN_CURRENCY_CODES, ...(plan ? [plan.currency] : [])])].map(
        (currency) => ({
          label: formatCurrencyOption(currency, locale),
          value: currency,
        }),
      ) satisfies RHFSelectOption[],
    [locale, plan],
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset(defaultValues);
    }

    onOpenChange(nextOpen);
  }

  async function handleValidSubmit(values: PlanFormValues) {
    try {
      if (plan) {
        const input = buildUpdateInput({
          dirtyFields,
          locale,
          plan,
          values,
        });

        if (Object.keys(input).length > 0) {
          await updateMutation.mutateAsync({ planId: plan.id, input });
        }
      } else {
        const amount = parseMajorAmount(values.price, values.currency, locale)!;
        const input: CreateSubscriptionPlanInput = {
          code: values.code.trim(),
          name: values.name.trim(),
          description: values.description.trim() || null,
          billingInterval: values.billingInterval as SubscriptionPlan["billingInterval"],
          amount,
          currency: values.currency.trim(),
          providerPlanId: values.providerPlanId.trim() || null,
          trialDays: values.trialDays.length > 0 ? Number(values.trialDays) : null,
          entitlements: createEntitlements(values),
        };
        await createMutation.mutateAsync(input);
      }

      handleOpenChange(false);
    } catch (error) {
      handleApiError<PlanFormValues>({ error, setError });
    }
  }

  return (
    <FormDialog
      contentClassName="sm:max-w-2xl"
      description={tPlans(isCreate ? "form.createDescription" : "form.editDescription")}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
      noValidate
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit(handleValidSubmit)}
      open={open}
      submitText={tPlans(isCreate ? "form.createSubmit" : "form.editSubmit")}
      title={tPlans(isCreate ? "form.createTitle" : "form.editTitle")}
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
            helperText={!isCreate ? tPlans("form.codeLocked") : undefined}
            label={tPlans("form.fields.code")}
            maxLength={100}
            name="code"
            placeholder="growth-monthly"
            required
          />
          <RHFTextField
            control={control}
            fullWidth
            label={tPlans("form.fields.name")}
            maxLength={150}
            name="name"
            required
          />
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="description"
              render={({ field, fieldState }) => (
                <div className="grid gap-2">
                  <Label htmlFor={descriptionId}>{tPlans("form.fields.description")}</Label>
                  <Textarea
                    aria-describedby={fieldState.error ? `${descriptionId}-message` : undefined}
                    aria-invalid={Boolean(fieldState.error)}
                    id={descriptionId}
                    maxLength={1000}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    ref={field.ref}
                    rows={3}
                    value={field.value}
                  />
                  {fieldState.error?.message && (
                    <p className="text-xs text-destructive" id={`${descriptionId}-message`}>
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
          <RHFSelect
            control={control}
            fullWidth
            label={tPlans("form.fields.billingInterval")}
            name="billingInterval"
            options={billingIntervalOptions}
            required
          />
          <RHFSelect
            control={control}
            fullWidth
            label={tPlans("form.fields.currency")}
            name="currency"
            options={currencyOptions}
            required
          />
          <RHFTextField
            control={control}
            fullWidth
            inputMode="decimal"
            label={tPlans("form.fields.price")}
            name="price"
            required
          />
          <RHFTextField
            control={control}
            fullWidth
            label={tPlans("form.fields.trialDays")}
            inputMode="numeric"
            name="trialDays"
          />
          <div className="sm:col-span-2">
            <RHFTextField
              control={control}
              fullWidth
              label={tPlans("form.fields.providerPlanId")}
              maxLength={255}
              name="providerPlanId"
            />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border/70 p-4">
          <div>
            <h3 className="font-semibold">{tPlans("entitlements.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {tPlans("entitlements.description")}
            </p>
          </div>
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <RHFTextField
              control={control}
              fullWidth
              inputMode="numeric"
              label={tPlans("form.fields.maxBranches")}
              name="maxBranches"
              required={isCreate}
            />
            <RHFTextField
              control={control}
              fullWidth
              inputMode="numeric"
              label={tPlans("form.fields.maxUsers")}
              name="maxUsers"
              required={isCreate}
            />
            <div className="sm:col-span-2">
              <RHFSelect
                control={control}
                fullWidth
                label={tPlans("form.fields.analytics")}
                name="analytics"
                options={analyticsOptions}
                placeholder={tPlans("analyticsOptions.unconfigured")}
                required={isCreate}
              />
            </div>
          </div>
        </div>

        {Object.keys(unknownEntitlements).length > 0 && (
          <div className="space-y-2 rounded-xl border border-dashed border-border/70 p-4">
            <h3 className="font-semibold">{tPlans("entitlements.unknownTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {tPlans("entitlements.unknownDescription")}
            </p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">
              {JSON.stringify(unknownEntitlements, null, 2)}
            </pre>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {tPlans("form.amountLimit", { max: MAX_SUBSCRIPTION_PLAN_AMOUNT })}
        </p>
      </div>
    </FormDialog>
  );
}
