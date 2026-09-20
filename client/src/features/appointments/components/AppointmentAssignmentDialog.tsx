import { FormDialog, RHFCombobox } from "@/components/form";
import { Alert } from "@/components/ui/alert";
import { useAssignAppointmentMutation, useAppointmentDentistsQuery } from "@/features/appointments/appointments.hooks";
import type { Appointment } from "@/features/appointments/appointments.types";
import { handleApiError } from "@/shared/lib/error";
import { idempotencyKeyForIntent, type IdempotencyIntent } from "@/shared/lib/idempotency";
import { useToast } from "@/shared/components/ToastProvider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

type Props = { appointment: Appointment; branchSlug: string; open: boolean; onOpenChange: (open: boolean) => void; tenantSlug: string };
type Values = { assignedDentistUserId: string };

export function AppointmentAssignmentDialog({ appointment, branchSlug, open, onOpenChange, tenantSlug }: Props) {
  const { t } = useTranslation("appointments");
  const { success } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [intent, setIntent] = useState<IdempotencyIntent | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => window.clearTimeout(timer); }, [search]);
  const dentists = useAppointmentDentistsQuery(tenantSlug, branchSlug, { page: 1, limit: 20, ...(debouncedSearch ? { search: debouncedSearch } : {}) });
  const options = useMemo(() => {
    const results = dentists.data?.items.map((dentist) => ({ value: dentist.id, label: dentist.fullName })) ?? [];
    return [{ value: "", label: t("form.unassigned") }, ...results];
  }, [dentists.data?.items, t]);
  const schema = useMemo(() => z.object({ assignedDentistUserId: z.string() }), []);
  const { control, formState: { errors, isDirty }, handleSubmit, reset, setError } = useForm<Values>({ defaultValues: { assignedDentistUserId: appointment.assignedDentist?.id ?? "" }, resolver: zodResolver(schema) });
  const mutation = useAssignAppointmentMutation();
  useEffect(() => { if (open) reset({ assignedDentistUserId: appointment.assignedDentist?.id ?? "" }); }, [appointment.assignedDentist?.id, open, reset]);
  async function submit(values: Values) {
    try {
      const input = { assignedDentistUserId: values.assignedDentistUserId || null };
      const nextIntent = idempotencyKeyForIntent(intent, { operation: "clinical.appointment.assign", tenantSlug, branchSlug, appointmentId: appointment.id, input });
      setIntent(nextIntent);
      await mutation.mutateAsync({ tenantSlug, branchSlug, appointmentId: appointment.id, input, idempotencyKey: nextIntent.key });
      onOpenChange(false);
      success(t("assignment.feedback"));
    } catch (error) { handleApiError<Values>({ error, setError }); }
  }
  return <FormDialog description={t("assignment.description")} isDirty={isDirty} isSubmitting={mutation.isPending} noValidate onOpenChange={(next) => { if (!next) setIntent(null); onOpenChange(next); }} onSubmit={handleSubmit(submit)} open={open} submitText={t("actions.assign")} title={t("assignment.title")}>
    <div className="space-y-4">{errors.root?.server?.message && <Alert variant="destructive">{errors.root.server.message}</Alert>}<RHFCombobox control={control} emptyMessage={dentists.isFetching ? t("form.searching") : t("form.noDentists")} fullWidth label={t("form.fields.dentist")} name="assignedDentistUserId" onSearchChange={setSearch} options={options} placeholder={t("form.dentistPlaceholder")} searchPlaceholder={t("form.dentistSearchPlaceholder")} selectedLabel={appointment.assignedDentist && !options.some((option) => option.value === appointment.assignedDentist?.id) ? appointment.assignedDentist.fullName : undefined} /></div>
  </FormDialog>;
}
