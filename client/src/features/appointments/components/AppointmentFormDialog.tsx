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
  addDaysInTimeZone,
  fromAppointmentDateAndTime,
  toDateTimeLocal,
} from "@/features/appointments/appointment-time";
import {
  useAppointmentAvailabilityQuery,
  useAppointmentDentistsQuery,
  useAppointmentOperatoriesQuery,
  useAppointmentServicesQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
} from "@/features/appointments/appointments.hooks";
import {
  APPOINTMENT_SOURCES,
  type Appointment,
  type AppointmentAvailabilityQuery,
  type AppointmentSource,
  type CreateAppointmentInput,
  type UpdateAppointmentInput,
} from "@/features/appointments/appointments.types";
import { PatientFormDialog } from "@/features/patients/components/PatientFormDialog";
import { useBranchPatientsQuery } from "@/features/patients/patients.hooks";
import type { Patient } from "@/features/patients/patients.types";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Clock3, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

type AppointmentFormValues = {
  patientId: string;
  source: AppointmentSource;
  appointmentDate: string;
  startAt: string;
  endAt: string;
  serviceId: string;
  assignedDentistUserId: string;
  operatoryId: string;
  visitReason: string;
  operationalNote: string;
  reasonCode: string;
};

const TIME_STEP_MINUTES = 15;
const DEFAULT_DURATION_MINUTES = 30;

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeInMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) {
    return null;
  }
  return hours * 60 + minutes;
}

function suggestedEndTime(startTime: string): string | null {
  const startMinutes = timeInMinutes(startTime);
  if (startMinutes === null) return null;
  const endMinutes = startMinutes + DEFAULT_DURATION_MINUTES;
  return endMinutes <= 24 * 60 ? formatTime(endMinutes) : null;
}

const START_TIME_OPTIONS = Array.from(
  { length: (24 * 60) / TIME_STEP_MINUTES },
  (_, index) => {
    const value = formatTime(index * TIME_STEP_MINUTES);
    return { value, label: value };
  },
) satisfies RHFSelectOption[];

const END_TIME_OPTIONS = [
  ...START_TIME_OPTIONS,
  { value: "24:00", label: "24:00" },
] satisfies RHFSelectOption[];

type AppointmentFormDialogProps = {
  appointment?: Appointment;
  branchSlug: string;
  defaultDate: string;
  initialPatient?: Pick<Patient, "id" | "fullName" | "phone">;
  lockPatient?: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tenantSlug: string;
  timeZone: string;
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function useDebouncedValue<T>(value: T): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), 300);
    return () => window.clearTimeout(timeout);
  }, [value]);
  return debounced;
}

function initialValues(
  appointment: Appointment | undefined,
  defaultDate: string,
  timeZone: string,
  initialPatientId: string,
): AppointmentFormValues {
  if (appointment) {
    const startAt = toDateTimeLocal(appointment.startAt, timeZone);
    const endAt = toDateTimeLocal(appointment.endAt, timeZone);
    const appointmentDate = startAt.slice(0, 10);
    const endDate = endAt.slice(0, 10);
    const nextDate = addDaysInTimeZone(appointmentDate, 1, timeZone);
    return {
      patientId: appointment.patient.id,
      source: appointment.source,
      appointmentDate,
      startAt: startAt.slice(11),
      endAt:
        endDate === nextDate && endAt.slice(11) === "00:00"
          ? "24:00"
          : endAt.slice(11),
      serviceId: appointment.service?.id ?? "",
      assignedDentistUserId: appointment.assignedDentist?.id ?? "",
      operatoryId: appointment.operatory?.id ?? "",
      visitReason: appointment.visitReason ?? "",
      operationalNote: appointment.operationalNote ?? "",
      reasonCode: "",
    };
  }
  return {
    patientId: initialPatientId,
    source: "PHONE",
    appointmentDate: defaultDate,
    startAt: "09:00",
    endAt: "09:30",
    serviceId: "",
    assignedDentistUserId: "",
    operatoryId: "",
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
  initialPatient,
  lockPatient = false,
  onOpenChange,
  open,
  tenantSlug,
  timeZone,
}: AppointmentFormDialogProps) {
  const { t } = useTranslation("appointments");
  const [patientSearch, setPatientSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [dentistSearch, setDentistSearch] = useState("");
  const [operatorySearch, setOperatorySearch] = useState("");
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const patientTerm = useDebouncedValue(patientSearch.trim());
  const serviceTerm = useDebouncedValue(serviceSearch.trim());
  const dentistTerm = useDebouncedValue(dentistSearch.trim());
  const operatoryTerm = useDebouncedValue(operatorySearch.trim());
  const defaults = useMemo(
    () => initialValues(appointment, defaultDate, timeZone, initialPatient?.id ?? ""),
    [appointment, defaultDate, initialPatient?.id, timeZone],
  );
  const schema = useMemo(
    () =>
      z
        .object({
          patientId: z.string().uuid(t("validation.patientRequired")),
          source: z.enum(APPOINTMENT_SOURCES, {
            message: t("validation.sourceRequired"),
          }),
          appointmentDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, t("validation.dateRequired")),
          startAt: z.string().min(1, t("validation.startRequired")),
          endAt: z.string().min(1, t("validation.endRequired")),
          serviceId: z.string(),
          assignedDentistUserId: z.string(),
          operatoryId: z.string(),
          visitReason: z
            .string()
            .trim()
            .max(1000, t("validation.visitReasonMax")),
          operationalNote: z.string().trim().max(2000, t("validation.noteMax")),
          reasonCode: z.string(),
        })
        .superRefine((values, context) => {
          const start = fromAppointmentDateAndTime(
            values.appointmentDate,
            values.startAt,
            timeZone,
          );
          const end = fromAppointmentDateAndTime(
            values.appointmentDate,
            values.endAt,
            timeZone,
          );
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
  const selectedDate = useWatch({ control, name: "appointmentDate" });
  const selectedStartTime = useWatch({ control, name: "startAt" });
  const selectedEndTime = useWatch({ control, name: "endAt" });
  const selectedServiceId = useWatch({ control, name: "serviceId" });
  const selectedDentistId = useWatch({
    control,
    name: "assignedDentistUserId",
  });
  const selectedOperatoryId = useWatch({ control, name: "operatoryId" });
  const availabilityInput = useMemo<AppointmentAvailabilityQuery | null>(() => {
    if (!selectedDentistId && !selectedOperatoryId) return null;
    const startAt = fromAppointmentDateAndTime(
      selectedDate,
      selectedStartTime,
      timeZone,
    );
    const endAt = fromAppointmentDateAndTime(
      selectedDate,
      selectedEndTime,
      timeZone,
    );
    if (!startAt || !endAt || new Date(startAt) >= new Date(endAt)) return null;
    return {
      startAt,
      endAt,
      ...(selectedDentistId ? { dentistUserId: selectedDentistId } : {}),
      ...(selectedOperatoryId ? { operatoryId: selectedOperatoryId } : {}),
      ...(appointment ? { excludeAppointmentId: appointment.id } : {}),
    };
  }, [
    appointment,
    selectedDate,
    selectedDentistId,
    selectedEndTime,
    selectedOperatoryId,
    selectedStartTime,
    timeZone,
  ]);
  const debouncedAvailabilityInput = useDebouncedValue(availabilityInput);
  const patientsQuery = useBranchPatientsQuery(
    tenantSlug,
    branchSlug,
    {
      page: 1,
      limit: 20,
      ...(patientTerm ? { search: patientTerm } : {}),
    },
    !appointment && !lockPatient,
  );
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
  const operatoriesQuery = useAppointmentOperatoriesQuery(
    tenantSlug,
    branchSlug,
    {
      page: 1,
      limit: 20,
      ...(operatoryTerm ? { search: operatoryTerm } : {}),
    },
  );
  const availabilityQuery = useAppointmentAvailabilityQuery(
    tenantSlug,
    branchSlug,
    open ? debouncedAvailabilityInput : null,
  );
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
        : initialPatient?.id === selectedPatientId
          ? initialPatient.fullName
          : null,
    );
  }, [appointment, initialPatient, patientsQuery.data?.items, selectedPatientId]);
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
  const operatoryOptions = useMemo(() => {
    const options = [
      { value: "", label: t("form.noOperatory") },
      ...(operatoriesQuery.data?.items ?? []).map((operatory) => ({
        value: operatory.id,
        label: `${operatory.code} · ${operatory.name}`,
      })),
    ];
    return withSelectedOption(
      options,
      selectedOperatoryId,
      appointment?.operatory?.id === selectedOperatoryId
        ? `${appointment.operatory.code} · ${appointment.operatory.name}`
        : null,
    );
  }, [appointment, operatoriesQuery.data?.items, selectedOperatoryId, t]);
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
  const durationMinutes = useMemo(() => {
    const startAt = fromAppointmentDateAndTime(
      selectedDate,
      selectedStartTime,
      timeZone,
    );
    const endAt = fromAppointmentDateAndTime(
      selectedDate,
      selectedEndTime,
      timeZone,
    );
    if (!startAt || !endAt) return null;
    const duration =
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000;
    return duration > 0 ? duration : null;
  }, [selectedDate, selectedEndTime, selectedStartTime, timeZone]);
  const availability = availabilityQuery.data;
  const hasAvailabilityConflict = Boolean(
    availability?.dentistConflict || availability?.operatoryConflict,
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
      setOperatorySearch("");
      reset(defaults);
    }
    onOpenChange(nextOpen);
  }

  async function submit(values: AppointmentFormValues) {
    const startAt = fromAppointmentDateAndTime(
      values.appointmentDate,
      values.startAt,
      timeZone,
    );
    const endAt = fromAppointmentDateAndTime(
      values.appointmentDate,
      values.endAt,
      timeZone,
    );
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
          operatoryId: values.operatoryId || null,
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
        toast.success(t("feedback.created"));
        return;
      }

      const input: UpdateAppointmentInput = {};
      if (values.source !== appointment.source) input.source = values.source;
      if (startAt !== appointment.startAt) input.startAt = startAt;
      if (endAt !== appointment.endAt) input.endAt = endAt;
      const nextServiceId = values.serviceId || null;
      if (nextServiceId !== (appointment.service?.id ?? null))
        input.serviceId = nextServiceId;
      const nextOperatoryId = values.operatoryId || null;
      if (nextOperatoryId !== (appointment.operatory?.id ?? null)) {
        input.operatoryId = nextOperatoryId;
      }
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
      toast.success(t("feedback.updated"));
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
                {!appointment && !lockPatient && (
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
                disabled={Boolean(appointment) || lockPatient}
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
            <div className="sm:col-span-2">
              <RHFTextField
                control={control}
                fullWidth
                // helperText={t("form.timeZoneHint", { timeZone })}
                label={t("form.fields.appointmentDate")}
                name="appointmentDate"
                required
                type="date"
              />
            </div>
            <RHFSelect
              control={control}
              fullWidth
              label={t("form.fields.startAt")}
              name="startAt"
              onValueChange={(value) => {
                const nextEndTime = suggestedEndTime(value);
                if (nextEndTime) {
                  setValue("endAt", nextEndTime, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }
              }}
              options={START_TIME_OPTIONS}
              placeholder={t("form.startTimePlaceholder")}
              required
            />
            <RHFSelect
              control={control}
              fullWidth
              label={t("form.fields.endAt")}
              name="endAt"
              options={END_TIME_OPTIONS}
              placeholder={t("form.endTimePlaceholder")}
              required
            />
            {(durationMinutes || hasAvailabilityConflict) && (
              <div className="sm:col-span-2 space-y-2">
                {durationMinutes && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    <Clock3 aria-hidden="true" className="size-3.5" />
                    <span>
                      {t("form.estimatedDuration", { count: durationMinutes })}
                    </span>
                  </div>
                )}
                {hasAvailabilityConflict && (
                  <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle aria-hidden="true" />
                    <div className="space-y-1">
                      {availability?.dentistConflict && (
                        <p>{t("form.dentistConflictWarning")}</p>
                      )}
                      {availability?.operatoryConflict && (
                        <p>{t("form.operatoryConflictWarning")}</p>
                      )}
                    </div>
                  </Alert>
                )}
              </div>
            )}
            <div className="sm:col-span-2">
              <RHFCombobox
                control={control}
                emptyMessage={
                  operatoriesQuery.isFetching
                    ? t("form.searching")
                    : t("form.noOperatories")
                }
                fullWidth
                label={t("form.fields.operatory")}
                name="operatoryId"
                onSearchChange={setOperatorySearch}
                options={operatoryOptions}
                placeholder={t("form.operatoryPlaceholder")}
                searchPlaceholder={t("form.operatorySearchPlaceholder")}
              />
            </div>
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
