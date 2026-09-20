import {
  FormDialog,
  RHFCombobox,
  RHFSelect,
  RHFTextField,
  RHFTextarea,
  type RHFComboboxOption,
  type RHFSelectOption,
} from "@/components/form";
import { Alert } from "@/components/ui/alert";
import {
  fromDateTimeLocal,
  toDateTimeLocal,
} from "@/features/appointments/appointment-time";
import {
  useAppointmentDentistsQuery,
  useAppointmentServicesQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
} from "@/features/appointments/appointments.hooks";
import {
  APPOINTMENT_SOURCES,
  type Appointment,
  type AppointmentSource,
  type CreateAppointmentInput,
  type UpdateAppointmentInput,
} from "@/features/appointments/appointments.types";
import { PatientFormDialog } from "@/features/patients/components/PatientFormDialog";
import { useBranchPatientsQuery } from "@/features/patients/patients.hooks";
import { useToast } from "@/shared/components/ToastProvider";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

type AppointmentFormValues = {
  patientId: string;
  source: AppointmentSource;
  startAt: string;
  endAt: string;
  serviceId: string;
  assignedDentistUserId: string;
  visitReason: string;
  operationalNote: string;
  reasonCode: string;
};

type AppointmentFormDialogProps = {
  appointment?: Appointment;
  branchSlug: string;
  defaultDate: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tenantSlug: string;
  timeZone: string;
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function useDebouncedValue(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [value]);
  return debounced;
}

function initialValues(
  appointment: Appointment | undefined,
  defaultDate: string,
  timeZone: string,
): AppointmentFormValues {
  if (appointment) {
    return {
      patientId: appointment.patient.id,
      source: appointment.source,
      startAt: toDateTimeLocal(appointment.startAt, timeZone),
      endAt: toDateTimeLocal(appointment.endAt, timeZone),
      serviceId: appointment.service?.id ?? "",
      assignedDentistUserId: appointment.assignedDentist?.id ?? "",
      visitReason: appointment.visitReason ?? "",
      operationalNote: appointment.operationalNote ?? "",
      reasonCode: "",
    };
  }
  return {
    patientId: "",
    source: "PHONE",
    startAt: `${defaultDate}T09:00`,
    endAt: `${defaultDate}T09:30`,
    serviceId: "",
    assignedDentistUserId: "",
    visitReason: "",
    operationalNote: "",
    reasonCode: "",
  };
}

function withSelectedOption(
  options: RHFComboboxOption[],
  id: string,
  label: string | null,
): RHFComboboxOption[] {
  if (!id || !label || options.some((option) => option.value === id))
    return options;
  return [{ value: id, label }, ...options];
}

export function AppointmentFormDialog({
  appointment,
  branchSlug,
  defaultDate,
  onOpenChange,
  open,
  tenantSlug,
  timeZone,
}: AppointmentFormDialogProps) {
  const { t } = useTranslation("appointments");
  const { success } = useToast();
  const [patientSearch, setPatientSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [dentistSearch, setDentistSearch] = useState("");
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const patientTerm = useDebouncedValue(patientSearch);
  const serviceTerm = useDebouncedValue(serviceSearch);
  const dentistTerm = useDebouncedValue(dentistSearch);
  const defaults = useMemo(
    () => initialValues(appointment, defaultDate, timeZone),
    [appointment, defaultDate, timeZone],
  );
  const schema = useMemo(
    () =>
      z
        .object({
          patientId: z.string().uuid(t("validation.patientRequired")),
          source: z.enum(APPOINTMENT_SOURCES, {
            message: t("validation.sourceRequired"),
          }),
          startAt: z.string().min(1, t("validation.startRequired")),
          endAt: z.string().min(1, t("validation.endRequired")),
          serviceId: z.string(),
          assignedDentistUserId: z.string(),
          visitReason: z
            .string()
            .trim()
            .max(1000, t("validation.visitReasonMax")),
          operationalNote: z.string().trim().max(2000, t("validation.noteMax")),
          reasonCode: z.string(),
        })
        .superRefine((values, context) => {
          const start = fromDateTimeLocal(values.startAt, timeZone);
          const end = fromDateTimeLocal(values.endAt, timeZone);
          if (!start) {
            context.addIssue({
              code: "custom",
              path: ["startAt"],
              message: t("validation.invalidTime"),
            });
          }
          if (!end) {
            context.addIssue({
              code: "custom",
              path: ["endAt"],
              message: t("validation.invalidTime"),
            });
          }
          if (start && end && new Date(start) >= new Date(end)) {
            context.addIssue({
              code: "custom",
              path: ["endAt"],
              message: t("validation.endAfterStart"),
            });
          }
          if (!values.serviceId && !values.visitReason.trim()) {
            context.addIssue({
              code: "custom",
              path: ["visitReason"],
              message: t("validation.reasonRequired"),
            });
          }
          if (appointment?.status === "CONFIRMED" && start && end) {
            const timeChanged =
              start !== appointment.startAt || end !== appointment.endAt;
            if (timeChanged && !values.reasonCode) {
              context.addIssue({
                code: "custom",
                path: ["reasonCode"],
                message: t("validation.rescheduleReasonRequired"),
              });
            }
          }
        }),
    [appointment, t, timeZone],
  );
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
    setError,
    setValue,
  } = useForm<AppointmentFormValues>({
    defaultValues: defaults,
    resolver: zodResolver(schema),
  });
  const selectedPatientId = useWatch({ control, name: "patientId" });
  const selectedServiceId = useWatch({ control, name: "serviceId" });
  const selectedDentistId = useWatch({
    control,
    name: "assignedDentistUserId",
  });
  const patientsQuery = useBranchPatientsQuery(tenantSlug, branchSlug, {
    page: 1,
    limit: 20,
    ...(patientTerm ? { search: patientTerm } : {}),
  });
  const servicesQuery = useAppointmentServicesQuery(tenantSlug, branchSlug, {
    page: 1,
    limit: 20,
    ...(serviceTerm ? { search: serviceTerm } : {}),
  });
  const dentistsQuery = useAppointmentDentistsQuery(tenantSlug, branchSlug, {
    page: 1,
    limit: 20,
    ...(dentistTerm ? { search: dentistTerm } : {}),
  });
  const createMutation = useCreateAppointmentMutation();
  const updateMutation = useUpdateAppointmentMutation();
  const mutation = appointment ? updateMutation : createMutation;
  const [intent, setIntent] = useState<IdempotencyIntent | null>(null);

  const patientOptions = useMemo(() => {
    const options = (patientsQuery.data?.items ?? []).map((patient) => ({
      value: patient.id,
      label: patient.fullName,
      keywords: [patient.phone],
    }));
    return withSelectedOption(
      options,
      selectedPatientId,
      appointment?.patient.id === selectedPatientId
        ? appointment.patient.fullName
        : null,
    );
  }, [appointment, patientsQuery.data?.items, selectedPatientId]);
  const serviceOptions = useMemo(() => {
    const options = (servicesQuery.data?.items ?? []).map((service) => ({
      value: service.id,
      label: `${service.code} · ${service.name}`,
    }));
    return options;
  }, [servicesQuery.data?.items]);
  const inactiveSelectedServiceLabel =
    appointment?.service?.id === selectedServiceId &&
    !serviceOptions.some((option) => option.value === selectedServiceId)
      ? `${appointment.service.code} · ${appointment.service.name}`
      : undefined;
  const dentistOptions = useMemo(() => {
    const options = [
      { value: "", label: t("form.unassigned") },
      ...(dentistsQuery.data?.items ?? []).map((dentist) => ({
        value: dentist.id,
        label: dentist.fullName,
      })),
    ];
    return withSelectedOption(
      options,
      selectedDentistId,
      appointment?.assignedDentist?.id === selectedDentistId
        ? appointment.assignedDentist.fullName
        : null,
    );
  }, [appointment, dentistsQuery.data?.items, selectedDentistId, t]);
  const sourceOptions = useMemo(
    () =>
      APPOINTMENT_SOURCES.map((source) => ({
        value: source,
        label: t(`sources.${source}`),
      })) satisfies RHFSelectOption[],
    [t],
  );
  const rescheduleOptions = useMemo(
    () =>
      [
        {
          value: "PATIENT_REQUEST",
          label: t("rescheduleReasons.PATIENT_REQUEST"),
        },
        {
          value: "CLINIC_RESCHEDULE",
          label: t("rescheduleReasons.CLINIC_RESCHEDULE"),
        },
      ] satisfies RHFSelectOption[],
    [t],
  );

  useEffect(() => {
    if (open) reset(defaults);
  }, [defaults, open, reset]);

  function close(nextOpen: boolean) {
    if (!nextOpen) {
      setIntent(null);
      setPatientSearch("");
      setServiceSearch("");
      setDentistSearch("");
      reset(defaults);
    }
    onOpenChange(nextOpen);
  }

  async function submit(values: AppointmentFormValues) {
    const startAt = fromDateTimeLocal(values.startAt, timeZone);
    const endAt = fromDateTimeLocal(values.endAt, timeZone);
    if (!startAt || !endAt) return;
    try {
      if (!appointment) {
        const input: CreateAppointmentInput = {
          patientId: values.patientId,
          source: values.source,
          startAt,
          endAt,
          serviceId: values.serviceId || null,
          assignedDentistUserId: values.assignedDentistUserId || null,
          visitReason: blankToNull(values.visitReason),
          operationalNote: blankToNull(values.operationalNote),
        };
        const nextIntent = idempotencyKeyForIntent(intent, {
          operation: "clinical.appointment.create",
          tenantSlug,
          branchSlug,
          input,
        });
        setIntent(nextIntent);
        await createMutation.mutateAsync({
          tenantSlug,
          branchSlug,
          input,
          idempotencyKey: nextIntent.key,
        });
        close(false);
        success(t("feedback.created"));
        return;
      }

      const input: UpdateAppointmentInput = {};
      if (values.source !== appointment.source) input.source = values.source;
      if (startAt !== appointment.startAt) input.startAt = startAt;
      if (endAt !== appointment.endAt) input.endAt = endAt;
      const nextServiceId = values.serviceId || null;
      if (nextServiceId !== (appointment.service?.id ?? null))
        input.serviceId = nextServiceId;
      const visitReason = blankToNull(values.visitReason);
      if (visitReason !== appointment.visitReason)
        input.visitReason = visitReason;
      const operationalNote = blankToNull(values.operationalNote);
      if (operationalNote !== appointment.operationalNote)
        input.operationalNote = operationalNote;
      if (
        (input.startAt || input.endAt) &&
        appointment.status === "CONFIRMED"
      ) {
        input.reasonCode = values.reasonCode as
          | "PATIENT_REQUEST"
          | "CLINIC_RESCHEDULE";
      }
      if (Object.keys(input).length === 0) {
        close(false);
        return;
      }
      const nextIntent = idempotencyKeyForIntent(intent, {
        operation: "clinical.appointment.update",
        tenantSlug,
        branchSlug,
        appointmentId: appointment.id,
        input,
      });
      setIntent(nextIntent);
      await updateMutation.mutateAsync({
        tenantSlug,
        branchSlug,
        appointmentId: appointment.id,
        input,
        idempotencyKey: nextIntent.key,
      });
      close(false);
      success(t("feedback.updated"));
    } catch (error) {
      handleApiError<AppointmentFormValues>({ error, setError });
    }
  }

  return (
    <>
      <FormDialog
        contentClassName="sm:max-w-3xl"
        description={t(
          appointment ? "form.editDescription" : "form.createDescription",
        )}
        isDirty={isDirty}
        isSubmitting={mutation.isPending}
        noValidate
        onOpenChange={close}
        onSubmit={handleSubmit(submit)}
        open={open}
        submitText={t(appointment ? "actions.save" : "actions.create")}
        title={t(appointment ? "form.editTitle" : "form.createTitle")}
      >
        <div className="space-y-5">
          {errors.root?.server?.message && (
            <Alert variant="destructive">{errors.root.server.message}</Alert>
          )}
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium flex gap-1">
                  {t("form.fields.patient")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </span>
                {!appointment && (
                  <button
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    onClick={() => setCreatePatientOpen(true)}
                    type="button"
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    {t("actions.addPatient")}
                  </button>
                )}
              </div>
              <RHFCombobox
                control={control}
                disabled={Boolean(appointment)}
                emptyMessage={
                  patientsQuery.isFetching
                    ? t("form.searching")
                    : t("form.noPatients")
                }
                fullWidth
                label={
                  <span className="sr-only">{t("form.fields.patient")}</span>
                }
                name="patientId"
                onSearchChange={setPatientSearch}
                options={patientOptions}
                placeholder={t("form.patientPlaceholder")}
                searchPlaceholder={t("form.patientSearchPlaceholder")}
              />
            </div>
            <RHFSelect
              control={control}
              fullWidth
              label={t("form.fields.source")}
              name="source"
              options={sourceOptions}
              required
              placeholder={t("form.sourcePlaceholder")}
            />
            {!appointment && (
              <RHFCombobox
                control={control}
                emptyMessage={
                  dentistsQuery.isFetching
                    ? t("form.searching")
                    : t("form.noDentists")
                }
                fullWidth
                label={t("form.fields.dentist")}
                name="assignedDentistUserId"
                onSearchChange={setDentistSearch}
                options={dentistOptions}
                placeholder={t("form.dentistPlaceholder")}
                searchPlaceholder={t("form.dentistSearchPlaceholder")}
              />
            )}
            <RHFTextField
              control={control}
              fullWidth
              label={t("form.fields.startAt")}
              name="startAt"
              required
              type="datetime-local"
            />
            <RHFTextField
              control={control}
              fullWidth
              label={t("form.fields.endAt")}
              name="endAt"
              required
              type="datetime-local"
            />
            <div className="sm:col-span-2">
              <RHFCombobox
                control={control}
                emptyMessage={
                  servicesQuery.isFetching
                    ? t("form.searching")
                    : t("form.noServices")
                }
                fullWidth
                label={t("form.fields.service")}
                name="serviceId"
                onSearchChange={setServiceSearch}
                options={[
                  { value: "", label: t("form.noService") },
                  ...serviceOptions,
                ]}
                placeholder={t("form.servicePlaceholder")}
                searchPlaceholder={t("form.serviceSearchPlaceholder")}
                selectedLabel={inactiveSelectedServiceLabel}
              />
            </div>
            <div className="sm:col-span-2">
              <RHFTextarea
                control={control}
                fullWidth
                label={t("form.fields.visitReason")}
                maxLength={1000}
                name="visitReason"
                required={!selectedServiceId}
                rows={3}
              />
            </div>
            <div className="sm:col-span-2">
              <RHFTextarea
                control={control}
                fullWidth
                label={t("form.fields.operationalNote")}
                maxLength={2000}
                name="operationalNote"
                rows={3}
              />
            </div>
            {appointment?.status === "CONFIRMED" && (
              <div className="sm:col-span-2">
                <RHFSelect
                  control={control}
                  fullWidth
                  helperText={t("form.rescheduleHint")}
                  label={t("form.fields.rescheduleReason")}
                  name="reasonCode"
                  options={rescheduleOptions}
                  placeholder={t("form.reschedulePlaceholder")}
                />
              </div>
            )}
          </div>
        </div>
      </FormDialog>
      <PatientFormDialog
        branchSlug={branchSlug}
        onCreated={(patient) => {
          setValue("patientId", patient.id, {
            shouldDirty: true,
            shouldValidate: true,
          });
          setCreatePatientOpen(false);
        }}
        onOpenChange={setCreatePatientOpen}
        open={createPatientOpen}
        tenantSlug={tenantSlug}
      />
    </>
  );
}
