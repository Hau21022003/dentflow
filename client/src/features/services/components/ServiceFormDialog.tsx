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
  useCreateServiceMutation,
  useUpdateServiceMutation,
} from "@/features/services/services.hooks";
import {
  formatCurrencyOption,
  formatMajorAmountForInput,
  MAX_SERVICE_AMOUNT,
  parseServiceAmount,
  SERVICE_CURRENCY_CODES,
} from "@/features/services/services.price";
import type {
  CreateServiceInput,
  Service,
  UpdateServiceInput,
} from "@/features/services/services.types";
import {
  createValidationMessages,
  type Translate,
  type ValidationMessages,
} from "@/i18n/validation";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MAX_DURATION_MINUTES = 32_767;

type ServiceFormValues = {
  code: string;
  name: string;
  groupName: string;
  currency: string;
  price: string;
  durationMinutes: string;
  reason: string;
};

type ServiceFormDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  service?: Service;
  tenantSlug: string;
};

function createServiceFormSchema({
  locale,
  service,
  tServices,
  validation,
}: {
  locale: string;
  service?: Service;
  tServices: Translate;
  validation: ValidationMessages;
}) {
  const fields = (key: string) => tServices(`form.fields.${key}`);

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
      groupName: z
        .string()
        .trim()
        .min(1, validation.required(fields("groupName")))
        .max(100, validation.maxLength(fields("groupName"), 100)),
      currency: z
        .string()
        .trim()
        .regex(CURRENCY_PATTERN, validation.pattern(fields("currency"))),
      price: z.string().trim().min(1, validation.required(fields("price"))),
      durationMinutes: z.string().trim(),
      reason: z.string().trim().max(500, validation.maxLength(fields("reason"), 500)),
    })
    .superRefine((values, context) => {
      const amount = CURRENCY_PATTERN.test(values.currency)
        ? parseServiceAmount(values.price, values.currency, locale)
        : null;
      if (amount === null) {
        context.addIssue({
          code: "custom",
          message: validation.invalid(fields("price")),
          path: ["price"],
        });
      }

      if (!/^\d+$/.test(values.durationMinutes)) {
        context.addIssue({
          code: "custom",
          message: validation.integer(fields("durationMinutes")),
          path: ["durationMinutes"],
        });
      } else if (
        Number(values.durationMinutes) < 1 ||
        Number(values.durationMinutes) > MAX_DURATION_MINUTES
      ) {
        context.addIssue({
          code: "custom",
          message: validation.maxNumber(fields("durationMinutes"), MAX_DURATION_MINUTES),
          path: ["durationMinutes"],
        });
      }

      if (
        service &&
        amount !== null &&
        (amount !== service.amount || values.currency !== service.currency) &&
        values.reason.length === 0
      ) {
        context.addIssue({
          code: "custom",
          message: tServices("form.priceChangeReasonRequired"),
          path: ["reason"],
        });
      }
    });
}

function getInitialValues(service: Service | undefined, locale: string): ServiceFormValues {
  return {
    code: service?.code ?? "",
    name: service?.name ?? "",
    groupName: service?.groupName ?? "",
    currency: service?.currency ?? "VND",
    price: service
      ? formatMajorAmountForInput(service.amount, service.currency, locale)
      : "",
    durationMinutes: service?.durationMinutes.toString() ?? "",
    reason: "",
  };
}

function buildUpdateInput({
  locale,
  service,
  values,
}: {
  locale: string;
  service: Service;
  values: ServiceFormValues;
}): UpdateServiceInput {
  const input: UpdateServiceInput = {};
  const amount = parseServiceAmount(values.price, values.currency, locale)!;
  const normalized = {
    name: values.name.trim(),
    groupName: values.groupName.trim(),
    amount,
    currency: values.currency.trim(),
    durationMinutes: Number(values.durationMinutes),
  };

  if (normalized.name !== service.name) input.name = normalized.name;
  if (normalized.groupName !== service.groupName) input.groupName = normalized.groupName;
  if (normalized.amount !== service.amount) input.amount = normalized.amount;
  if (normalized.currency !== service.currency) input.currency = normalized.currency;
  if (normalized.durationMinutes !== service.durationMinutes) {
    input.durationMinutes = normalized.durationMinutes;
  }
  if (input.amount !== undefined || input.currency !== undefined) {
    input.reason = values.reason.trim();
  }

  return input;
}

export function ServiceFormDialog({
  onOpenChange,
  open,
  service,
  tenantSlug,
}: ServiceFormDialogProps) {
  const { i18n, t: tServices } = useTranslation("services");
  const { t: tValidation } = useTranslation("validation");
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";
  const reasonId = useId();
  const isCreate = service === undefined;
  const validation = useMemo(() => createValidationMessages(tValidation), [tValidation]);
  const schema = useMemo(
    () => createServiceFormSchema({ locale, service, tServices, validation }),
    [locale, service, tServices, validation],
  );
  const defaultValues = useMemo(() => getInitialValues(service, locale), [locale, service]);
  const createMutation = useCreateServiceMutation();
  const updateMutation = useUpdateServiceMutation();
  const mutation = isCreate ? createMutation : updateMutation;
  const [idempotencyIntent, setIdempotencyIntent] =
    useState<IdempotencyIntent | null>(null);
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
    setError,
  } = useForm<ServiceFormValues>({
    defaultValues,
    resolver: zodResolver(schema),
  });
  const currency = useWatch({ control, name: "currency" });
  const price = useWatch({ control, name: "price" });
  const amount = CURRENCY_PATTERN.test(currency ?? "")
    ? parseServiceAmount(price ?? "", currency, locale)
    : null;
  const requiresPriceReason = Boolean(
    service &&
      amount !== null &&
      (amount !== service.amount || currency !== service.currency),
  );

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [defaultValues, open, reset]);

  const currencyOptions = useMemo(
    () =>
      [...new Set([...SERVICE_CURRENCY_CODES, ...(service ? [service.currency] : [])])].map(
        (currency) => ({
          label: formatCurrencyOption(currency, locale),
          value: currency,
        }),
      ) satisfies RHFSelectOption[],
    [locale, service],
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setIdempotencyIntent(null);
      reset(defaultValues);
    }
    onOpenChange(nextOpen);
  }

  async function handleValidSubmit(values: ServiceFormValues) {
    try {
      if (service) {
        const input = buildUpdateInput({ locale, service, values });
        if (Object.keys(input).length > 0) {
          const nextIntent = idempotencyKeyForIntent(idempotencyIntent, {
            operation: "tenant.service.update",
            tenantSlug,
            serviceId: service.id,
            input,
          });
          setIdempotencyIntent(nextIntent);
          await updateMutation.mutateAsync({
            tenantSlug,
            serviceId: service.id,
            input,
            idempotencyKey: nextIntent.key,
          });
        }
      } else {
        const input: CreateServiceInput = {
          code: values.code.trim(),
          name: values.name.trim(),
          groupName: values.groupName.trim(),
          amount: parseServiceAmount(values.price, values.currency, locale)!,
          currency: values.currency.trim(),
          durationMinutes: Number(values.durationMinutes),
        };
        const nextIntent = idempotencyKeyForIntent(idempotencyIntent, {
          operation: "tenant.service.create",
          tenantSlug,
          input,
        });
        setIdempotencyIntent(nextIntent);
        await createMutation.mutateAsync({
          tenantSlug,
          input,
          idempotencyKey: nextIntent.key,
        });
      }
      handleOpenChange(false);
    } catch (error) {
      handleApiError<ServiceFormValues>({ error, setError });
    }
  }

  return (
    <FormDialog
      contentClassName="sm:max-w-xl"
      description={tServices(isCreate ? "form.createDescription" : "form.editDescription")}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
      noValidate
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit(handleValidSubmit)}
      open={open}
      submitText={tServices(isCreate ? "actions.create" : "actions.save")}
      title={tServices(isCreate ? "form.createTitle" : "form.editTitle")}
    >
      <div className="space-y-5">
        {errors.root?.server?.message && <Alert variant="destructive">{errors.root.server.message}</Alert>}
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <RHFTextField
            control={control}
            disabled={!isCreate}
            fullWidth
            helperText={tServices(isCreate ? "form.codeHint" : "form.codeLocked")}
            label={tServices("form.fields.code")}
            maxLength={100}
            name="code"
            required
          />
          <RHFTextField
            control={control}
            fullWidth
            label={tServices("form.fields.name")}
            maxLength={150}
            name="name"
            required
          />
          <div className="sm:col-span-2">
            <RHFTextField
              control={control}
              fullWidth
              label={tServices("form.fields.groupName")}
              maxLength={100}
              name="groupName"
              required
            />
          </div>
          <RHFSelect
            control={control}
            fullWidth
            label={tServices("form.fields.currency")}
            name="currency"
            options={currencyOptions}
            required
          />
          <RHFTextField
            control={control}
            fullWidth
            inputMode="decimal"
            label={tServices("form.fields.price")}
            name="price"
            required
          />
          <RHFTextField
            control={control}
            fullWidth
            inputMode="numeric"
            label={tServices("form.fields.durationMinutes")}
            max={MAX_DURATION_MINUTES}
            min={1}
            name="durationMinutes"
            required
            type="number"
          />
        </div>
        {requiresPriceReason && (
          <>
            <Alert>
              <AlertCircle aria-hidden="true" className="size-4" />
              {tServices("form.priceChangeReasonHint")}
            </Alert>
            <Controller
              control={control}
              name="reason"
              render={({ field, fieldState }) => (
                <div className="grid gap-2">
                  <Label htmlFor={reasonId}>
                    {tServices("form.fields.reason")}
                    <span aria-hidden="true" className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    aria-describedby={fieldState.error ? `${reasonId}-message` : undefined}
                    aria-invalid={Boolean(fieldState.error)}
                    id={reasonId}
                    maxLength={500}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    ref={field.ref}
                    rows={3}
                    value={field.value}
                  />
                  {fieldState.error?.message && (
                    <p className="text-xs text-destructive" id={`${reasonId}-message`}>
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
          </>
        )}
        <p className="text-xs text-muted-foreground">
          {tServices("form.amountLimit", { max: MAX_SERVICE_AMOUNT })}
        </p>
      </div>
    </FormDialog>
  );
}
