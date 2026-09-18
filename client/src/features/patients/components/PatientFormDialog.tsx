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
  useCreatePatientMutation,
  useUpdatePatientMutation,
} from "@/features/patients/patients.hooks";
import {
  PATIENT_GENDERS,
  type CreatePatientInput,
  type Patient,
  type PatientGender,
  type UpdatePatientInput,
} from "@/features/patients/patients.types";
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
import { useEffect, useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

type PatientFormValues = {
  fullName: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  emergencyContact: {
    fullName: string;
    phone: string;
    relationship: string;
  };
  referralSource: string;
};

type PatientFormDialogProps = {
  branchSlug: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  patient?: Patient;
  tenantSlug: string;
};

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function createPatientFormSchema(
  tPatients: Translate,
  validation: ValidationMessages,
) {
  const fields = (key: string) => tPatients(`form.fields.${key}`);

  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(1, validation.required(fields("fullName")))
        .max(150, validation.maxLength(fields("fullName"), 150)),
      phone: z
        .string()
        .trim()
        .min(1, validation.required(fields("phone")))
        .max(30, validation.maxLength(fields("phone"), 30)),
      gender: z
        .string()
        .min(1, validation.selectionRequired(fields("gender")))
        .refine(
          (value) => PATIENT_GENDERS.some((gender) => gender === value),
          validation.invalid(fields("gender")),
        ),
      dateOfBirth: z
        .string()
        .trim()
        .refine(
          (value) => value.length === 0 || isValidDate(value),
          validation.invalid(fields("dateOfBirth")),
        )
        .refine(
          (value) => value.length === 0 || value <= new Date().toISOString().slice(0, 10),
          tPatients("form.dateOfBirthNotFuture"),
        ),
      address: z
        .string()
        .trim()
        .max(500, validation.maxLength(fields("address"), 500)),
      emergencyContact: z.object({
        fullName: z
          .string()
          .trim()
          .max(150, validation.maxLength(fields("emergencyContactName"), 150)),
        phone: z
          .string()
          .trim()
          .max(30, validation.maxLength(fields("emergencyContactPhone"), 30)),
        relationship: z
          .string()
          .trim()
          .max(
            100,
            validation.maxLength(fields("emergencyContactRelationship"), 100),
          ),
      }),
      referralSource: z
        .string()
        .trim()
        .max(150, validation.maxLength(fields("referralSource"), 150)),
    })
    .superRefine((values, context) => {
      const contact = values.emergencyContact;
      const hasContactValue = Boolean(
        contact.fullName || contact.phone || contact.relationship,
      );

      if (hasContactValue && !contact.fullName) {
        context.addIssue({
          code: "custom",
          message: validation.required(fields("emergencyContactName")),
          path: ["emergencyContact", "fullName"],
        });
      }
      if (hasContactValue && !contact.phone) {
        context.addIssue({
          code: "custom",
          message: validation.required(fields("emergencyContactPhone")),
          path: ["emergencyContact", "phone"],
        });
      }
    });
}

function getInitialValues(patient?: Patient): PatientFormValues {
  return {
    fullName: patient?.fullName ?? "",
    phone: patient?.phone ?? "",
    gender: patient?.gender ?? "",
    dateOfBirth: patient?.dateOfBirth ?? "",
    address: patient?.address ?? "",
    emergencyContact: {
      fullName: patient?.emergencyContact?.fullName ?? "",
      phone: patient?.emergencyContact?.phone ?? "",
      relationship: patient?.emergencyContact?.relationship ?? "",
    },
    referralSource: patient?.referralSource ?? "",
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildInput(values: PatientFormValues): CreatePatientInput {
  const emergencyContactName = blankToNull(values.emergencyContact.fullName);
  const emergencyContactPhone = blankToNull(values.emergencyContact.phone);

  return {
    fullName: values.fullName.trim(),
    phone: values.phone.trim(),
    gender: values.gender as PatientGender,
    dateOfBirth: blankToNull(values.dateOfBirth),
    address: blankToNull(values.address),
    emergencyContact:
      emergencyContactName && emergencyContactPhone
        ? {
            fullName: emergencyContactName,
            phone: emergencyContactPhone,
            relationship: blankToNull(values.emergencyContact.relationship),
          }
        : null,
    referralSource: blankToNull(values.referralSource),
  };
}

function buildUpdateInput(
  patient: Patient,
  values: PatientFormValues,
): UpdatePatientInput {
  const next = buildInput(values);
  const input: UpdatePatientInput = {};

  if (next.fullName !== patient.fullName) input.fullName = next.fullName;
  if (next.phone !== patient.phone) input.phone = next.phone;
  if (next.gender !== patient.gender) input.gender = next.gender;
  if (next.dateOfBirth !== patient.dateOfBirth) input.dateOfBirth = next.dateOfBirth;
  if (next.address !== patient.address) input.address = next.address;
  if (next.referralSource !== patient.referralSource) {
    input.referralSource = next.referralSource;
  }

  const existingContact = patient.emergencyContact;
  const nextContact = next.emergencyContact;
  if (
    existingContact?.fullName !== nextContact?.fullName ||
    existingContact?.phone !== nextContact?.phone ||
    existingContact?.relationship !== nextContact?.relationship
  ) {
    input.emergencyContact = nextContact;
  }

  return input;
}

export function PatientFormDialog({
  branchSlug,
  onOpenChange,
  open,
  patient,
  tenantSlug,
}: PatientFormDialogProps) {
  const { t: tPatients } = useTranslation("patients");
  const { t: tValidation } = useTranslation("validation");
  const validation = useMemo(
    () => createValidationMessages(tValidation),
    [tValidation],
  );
  const schema = useMemo(
    () => createPatientFormSchema(tPatients, validation),
    [tPatients, validation],
  );
  const defaultValues = useMemo(() => getInitialValues(patient), [patient]);
  const genderOptions = useMemo(
    () =>
      PATIENT_GENDERS.map((gender) => ({
        label: tPatients(`genders.${gender}`),
        value: gender,
      })) satisfies RHFSelectOption[],
    [tPatients],
  );
  const createMutation = useCreatePatientMutation();
  const updateMutation = useUpdatePatientMutation();
  const isCreate = patient === undefined;
  const mutation = isCreate ? createMutation : updateMutation;
  const [idempotencyIntent, setIdempotencyIntent] =
    useState<IdempotencyIntent | null>(null);
  const addressId = useId();
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
    setError,
  } = useForm<PatientFormValues>({
    defaultValues,
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [defaultValues, open, reset]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setIdempotencyIntent(null);
      reset(defaultValues);
    }
    onOpenChange(nextOpen);
  }

  async function handleValidSubmit(values: PatientFormValues) {
    try {
      if (patient) {
        const input = buildUpdateInput(patient, values);
        if (Object.keys(input).length > 0) {
          const nextIntent = idempotencyKeyForIntent(idempotencyIntent, {
            operation: "clinical.patient.update",
            tenantSlug,
            branchSlug,
            patientId: patient.id,
            input,
          });
          setIdempotencyIntent(nextIntent);
          await updateMutation.mutateAsync({
            tenantSlug,
            branchSlug,
            patientId: patient.id,
            input,
            idempotencyKey: nextIntent.key,
          });
        }
      } else {
        const input = buildInput(values);
        const nextIntent = idempotencyKeyForIntent(idempotencyIntent, {
          operation: "clinical.patient.create",
          tenantSlug,
          branchSlug,
          input,
        });
        setIdempotencyIntent(nextIntent);
        await createMutation.mutateAsync({
          tenantSlug,
          branchSlug,
          input,
          idempotencyKey: nextIntent.key,
        });
      }
      handleOpenChange(false);
    } catch (error) {
      handleApiError<PatientFormValues>({ error, setError });
    }
  }

  return (
    <FormDialog
      contentClassName="sm:max-w-2xl"
      description={tPatients(
        isCreate ? "form.createDescription" : "form.editDescription",
      )}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
      noValidate
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit(handleValidSubmit)}
      open={open}
      submitText={tPatients(isCreate ? "actions.create" : "actions.save")}
      title={tPatients(isCreate ? "form.createTitle" : "form.editTitle")}
    >
      <div className="space-y-6">
        {errors.root?.server?.message && (
          <Alert variant="destructive">{errors.root.server.message}</Alert>
        )}

        <div className="grid items-start gap-5 sm:grid-cols-2">
          <RHFTextField
            autoComplete="name"
            control={control}
            fullWidth
            label={tPatients("form.fields.fullName")}
            maxLength={150}
            name="fullName"
            required
          />
          <RHFTextField
            autoComplete="tel"
            control={control}
            fullWidth
            inputMode="tel"
            label={tPatients("form.fields.phone")}
            maxLength={30}
            name="phone"
            required
            type="tel"
          />
          <RHFSelect
            control={control}
            fullWidth
            label={tPatients("form.fields.gender")}
            name="gender"
            options={genderOptions}
            placeholder={tPatients("form.genderPlaceholder")}
            required
          />
          <RHFTextField
            control={control}
            fullWidth
            label={tPatients("form.fields.dateOfBirth")}
            max={new Date().toISOString().slice(0, 10)}
            name="dateOfBirth"
            type="date"
          />
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="address"
              render={({ field, fieldState }) => (
                <div className="grid gap-2">
                  <Label htmlFor={addressId}>{tPatients("form.fields.address")}</Label>
                  <Textarea
                    aria-describedby={fieldState.error ? `${addressId}-message` : undefined}
                    aria-invalid={Boolean(fieldState.error)}
                    id={addressId}
                    maxLength={500}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    ref={field.ref}
                    rows={3}
                    value={field.value}
                  />
                  {fieldState.error?.message && (
                    <p className="text-xs text-destructive" id={`${addressId}-message`}>
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        </div>

        <section className="space-y-4 border-t border-border/70 pt-5">
          <div>
            <h3 className="font-semibold">{tPatients("form.emergencyContact.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {tPatients("form.emergencyContact.description")}
            </p>
          </div>
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <RHFTextField
              autoComplete="name"
              control={control}
              fullWidth
              label={tPatients("form.fields.emergencyContactName")}
              maxLength={150}
              name="emergencyContact.fullName"
            />
            <RHFTextField
              autoComplete="tel"
              control={control}
              fullWidth
              inputMode="tel"
              label={tPatients("form.fields.emergencyContactPhone")}
              maxLength={30}
              name="emergencyContact.phone"
              type="tel"
            />
            <div className="sm:col-span-2">
              <RHFTextField
                control={control}
                fullWidth
                label={tPatients("form.fields.emergencyContactRelationship")}
                maxLength={100}
                name="emergencyContact.relationship"
              />
            </div>
          </div>
        </section>

        <RHFTextField
          control={control}
          fullWidth
          label={tPatients("form.fields.referralSource")}
          maxLength={150}
          name="referralSource"
        />
      </div>
    </FormDialog>
  );
}
