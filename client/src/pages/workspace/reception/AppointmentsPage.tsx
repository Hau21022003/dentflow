import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { todayInTimeZone } from "@/features/appointments/appointment-time";
import {
  AppointmentActionDialog,
  type AppointmentAction,
} from "@/features/appointments/components/AppointmentActionDialog";
import { AppointmentAssignmentDialog } from "@/features/appointments/components/AppointmentAssignmentDialog";
import {
  AppointmentDateNavigation,
  type AppointmentView,
} from "@/features/appointments/components/AppointmentDateNavigation";
import { AppointmentDetailSheet } from "@/features/appointments/components/AppointmentDetailSheet";
import { AppointmentDetailPanel } from "@/features/appointments/components/AppointmentDetailPanel";
import { AppointmentFormDialog } from "@/features/appointments/components/AppointmentFormDialog";
import { AppointmentListView } from "@/features/appointments/components/AppointmentListView";
import { AppointmentMonthView } from "@/features/appointments/components/AppointmentMonthView";
import { AppointmentTimelineView } from "@/features/appointments/components/AppointmentTimelineView";
import type { Appointment } from "@/features/appointments/appointments.types";
import { localeForLanguage } from "@/shared/lib/money";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function viewFromSearchParam(value: string | null): AppointmentView {
  return value === "timeline" || value === "month" ? value : "list";
}

function useDesktopTimeline() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export function AppointmentsPage() {
  const { branch, branchSlug, tenant, tenantSlug } = useRouteWorkspaceContext();
  const { i18n, t } = useTranslation("appointments");
  const [searchParams, setSearchParams] = useSearchParams();
  const timeZone = branch?.branch.timezone ?? "Asia/Ho_Chi_Minh";
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const viewParam = searchParams.get("view");
  const view = viewFromSearchParam(viewParam);
  const dateParam = searchParams.get("date");
  const date = isValidDate(dateParam)
    ? dateParam
    : todayInTimeZone(timeZone);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | undefined>();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [timelineDetailId, setTimelineDetailId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Appointment | null>(null);
  const [actionSelection, setActionSelection] = useState<{
    action: AppointmentAction;
    appointment: Appointment;
  } | null>(null);
  const canAssign = branch?.roles.includes("BRANCH_ADMIN") ?? false;
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;
  const branchName = branch?.branch.name ?? branchSlug;
  const isDesktopTimeline = useDesktopTimeline();

  useEffect(() => {
    if (isValidDate(dateParam) && viewParam === view) return;
    const params = new URLSearchParams(searchParams);
    params.set("date", date);
    params.set("view", view);
    setSearchParams(params, { replace: true });
  }, [date, dateParam, searchParams, setSearchParams, view, viewParam]);

  function updateSearchParams(next: { date?: string; view?: AppointmentView }) {
    const params = new URLSearchParams(searchParams);
    params.set("date", next.date ?? date);
    params.set("view", next.view ?? view);
    setSearchParams(params);
  }

  function changeDate(nextDate: string) {
    if (nextDate !== date) setTimelineDetailId(null);
    updateSearchParams({ date: nextDate });
  }

  function closeForm(open: boolean) {
    if (!open) {
      setCreateOpen(false);
      setEditing(undefined);
    }
  }

  function closeTimelinePanelThen(callback: () => void) {
    setTimelineDetailId(null);
    callback();
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-primary">
            {t("eyebrow", { tenantName, branchName })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} type="button">
          <Plus aria-hidden="true" />
          {t("actions.create")}
        </Button>
      </div>

      <Card className={view === "timeline" && timelineDetailId && isDesktopTimeline ? "overflow-hidden" : undefined}>
        <AppointmentDateNavigation
          date={date}
          locale={locale}
          onDateChange={changeDate}
          onViewChange={(nextView) => updateSearchParams({ view: nextView })}
          timeZone={timeZone}
          view={view}
        />
        <CardContent className={view === "timeline" && timelineDetailId && isDesktopTimeline ? "grid min-h-[38rem] grid-cols-[minmax(0,1fr)_28rem] p-0" : "p-0"}>
          {view === "list" ? (
            <AppointmentListView
              branchSlug={branchSlug}
              date={date}
              key={date}
              onViewAppointment={(appointment) => setDetailId(appointment.id)}
              tenantSlug={tenantSlug}
              timeZone={timeZone}
            />
          ) : view === "month" ? (
            <AppointmentMonthView
              branchSlug={branchSlug}
              date={date}
              locale={locale}
              onDateChange={changeDate}
              onViewTimeline={(nextDate) => {
                setTimelineDetailId(null);
                updateSearchParams({ date: nextDate, view: "timeline" });
              }}
              tenantSlug={tenantSlug}
              timeZone={timeZone}
            />
          ) : (
            <AppointmentTimelineView
              branchSlug={branchSlug}
              date={date}
              onViewAppointment={(appointment) => setTimelineDetailId(appointment.id)}
              tenantSlug={tenantSlug}
              timeZone={timeZone}
            />
          )}
          {view === "timeline" && timelineDetailId && isDesktopTimeline && (
            <AppointmentDetailPanel
              appointmentId={timelineDetailId}
              branchSlug={branchSlug}
              canAssign={canAssign}
              onAction={(action, appointment) =>
                closeTimelinePanelThen(() => setActionSelection({ action, appointment }))
              }
              onAssign={(appointment) => closeTimelinePanelThen(() => setAssigning(appointment))}
              onClose={() => setTimelineDetailId(null)}
              onEdit={(appointment) => closeTimelinePanelThen(() => setEditing(appointment))}
              tenantSlug={tenantSlug}
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
      <AppointmentDetailSheet
        appointmentId={detailId}
        branchSlug={branchSlug}
        canAssign={canAssign}
        onAction={(action, appointment) => setActionSelection({ action, appointment })}
        onAssign={setAssigning}
        onEdit={setEditing}
        onOpenChange={(open) => !open && setDetailId(null)}
        open={Boolean(detailId)}
        tenantSlug={tenantSlug}
        timeZone={timeZone}
      />
      <AppointmentDetailSheet
        appointmentId={isDesktopTimeline ? null : timelineDetailId}
        branchSlug={branchSlug}
        canAssign={canAssign}
        onAction={(action, appointment) => {
          setTimelineDetailId(null);
          setActionSelection({ action, appointment });
        }}
        onAssign={(appointment) => {
          setTimelineDetailId(null);
          setAssigning(appointment);
        }}
        onEdit={(appointment) => {
          setTimelineDetailId(null);
          setEditing(appointment);
        }}
        onOpenChange={(open) => !open && setTimelineDetailId(null)}
        open={view === "timeline" && Boolean(timelineDetailId) && !isDesktopTimeline}
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
