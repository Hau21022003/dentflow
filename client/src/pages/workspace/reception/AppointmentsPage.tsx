import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addDaysInTimeZone,
  agendaRange,
  formatAppointmentDate,
  todayInTimeZone,
} from "@/features/appointments/appointment-time";
import {
  useAppointmentDentistsQuery,
  useAppointmentsAgendaQuery,
} from "@/features/appointments/appointments.hooks";
import type {
  Appointment,
  AppointmentStatus,
} from "@/features/appointments/appointments.types";
import {
  AppointmentActionDialog,
  type AppointmentAction,
} from "@/features/appointments/components/AppointmentActionDialog";
import { AppointmentAgendaList } from "@/features/appointments/components/AppointmentAgendaList";
import { AppointmentAssignmentDialog } from "@/features/appointments/components/AppointmentAssignmentDialog";
import { AppointmentDetailDialog } from "@/features/appointments/components/AppointmentDetailDialog";
import { AppointmentFormDialog } from "@/features/appointments/components/AppointmentFormDialog";
import { localeForLanguage } from "@/shared/lib/money";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

const ALL = "__all__";

export function AppointmentsPage() {
  const { branch, branchSlug, tenant, tenantSlug } = useRouteWorkspaceContext();
  const { i18n, t } = useTranslation("appointments");
  const timeZone = branch?.branch.timezone ?? "Asia/Ho_Chi_Minh";
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const [date, setDate] = useState(() => todayInTimeZone(timeZone));
  const [status, setStatus] = useState<string>(ALL);
  const [dentistId, setDentistId] = useState<string>(ALL);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | undefined>();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Appointment | null>(null);
  const [actionSelection, setActionSelection] = useState<{
    action: AppointmentAction;
    appointment: Appointment;
  } | null>(null);
  const range = useMemo(() => agendaRange(date, timeZone), [date, timeZone]);
  const query = useMemo(
    () => ({
      ...range,
      ...(status !== ALL ? { status: status as AppointmentStatus } : {}),
      ...(dentistId !== ALL ? { dentistUserId: dentistId } : {}),
    }),
    [dentistId, range, status],
  );
  const agenda = useAppointmentsAgendaQuery(tenantSlug, branchSlug, query);
  const dentists = useAppointmentDentistsQuery(tenantSlug, branchSlug, {
    page: 1,
    limit: 100,
  });
  const canAssign = branch?.roles.includes("BRANCH_ADMIN") ?? false;
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;
  const branchName = branch?.branch.name ?? branchSlug;
  function closeForm(open: boolean) {
    if (!open) {
      setCreateOpen(false);
      setEditing(undefined);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-primary">
            {t("eyebrow", { tenantName, branchName })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} type="button">
          <Plus aria-hidden="true" />
          {t("actions.create")}
        </Button>
      </div>
      <Card>
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <CardTitle>
                {formatAppointmentDate(date, timeZone, locale)}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{timeZone}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                aria-label={t("agenda.previousDay")}
                onClick={() =>
                  setDate((current) => addDaysInTimeZone(current, -1, timeZone))
                }
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Input
                aria-label={t("title")}
                className="w-40"
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
              <Button
                onClick={() => setDate(todayInTimeZone(timeZone))}
                type="button"
                variant="outline"
              >
                {t("agenda.today")}
              </Button>
              <Button
                aria-label={t("agenda.nextDay")}
                onClick={() =>
                  setDate((current) => addDaysInTimeZone(current, 1, timeZone))
                }
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("agenda.filterStatus")}</SelectItem>
                {(
                  [
                    "BOOKED",
                    "CONFIRMED",
                    "CHECKED_IN",
                    "IN_PROGRESS",
                    "COMPLETED",
                    "CANCELLED",
                    "NO_SHOW",
                  ] as AppointmentStatus[]
                ).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`statuses.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={setDentistId} value={dentistId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("agenda.filterDentist")}</SelectItem>
                {(dentists.data?.items ?? []).map((dentist) => (
                  <SelectItem key={dentist.id} value={dentist.id}>
                    {dentist.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {agenda.isFetching && !agenda.isLoading && (
            <RefreshCw
              aria-label={t("form.searching")}
              className="mb-3 size-4 animate-spin text-muted-foreground"
            />
          )}
          {agenda.isError ? (
            <div className="grid justify-items-center gap-3 py-12 text-center">
              <CalendarDays
                aria-hidden="true"
                className="size-8 text-muted-foreground"
              />
              <p className="font-semibold">{t("agenda.loadError")}</p>
              <Button
                onClick={() => void agenda.refetch()}
                size="sm"
                type="button"
              >
                {t("agenda.retry")}
              </Button>
            </div>
          ) : (
            <AppointmentAgendaList
              appointments={agenda.data ?? []}
              isLoading={agenda.isLoading}
              locale={locale}
              onView={(appointment) => setDetailId(appointment.id)}
              timeZone={timeZone}
            />
          )}
        </CardContent>
      </Card>
      <AppointmentFormDialog
        appointment={editing}
        branchSlug={branchSlug}
        defaultDate={date}
        onOpenChange={closeForm}
        open={createOpen || Boolean(editing)}
        tenantSlug={tenantSlug}
        timeZone={timeZone}
      />
      <AppointmentDetailDialog
        appointmentId={detailId}
        branchSlug={branchSlug}
        canAssign={canAssign}
        onAction={(action, appointment) =>
          setActionSelection({ action, appointment })
        }
        onAssign={setAssigning}
        onEdit={setEditing}
        onOpenChange={(open) => !open && setDetailId(null)}
        open={Boolean(detailId)}
        tenantSlug={tenantSlug}
        timeZone={timeZone}
      />
      {assigning && (
        <AppointmentAssignmentDialog
          appointment={assigning}
          branchSlug={branchSlug}
          onOpenChange={(open) => !open && setAssigning(null)}
          open
          tenantSlug={tenantSlug}
        />
      )}
      {actionSelection && (
        <AppointmentActionDialog
          action={actionSelection.action}
          appointment={actionSelection.appointment}
          branchSlug={branchSlug}
          onOpenChange={(open) => !open && setActionSelection(null)}
          open
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
}
