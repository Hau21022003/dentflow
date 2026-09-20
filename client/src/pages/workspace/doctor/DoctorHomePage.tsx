import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppointmentAgendaList } from "@/features/appointments/components/AppointmentAgendaList";
import { addDaysInTimeZone, agendaRange, formatAppointmentDate, todayInTimeZone } from "@/features/appointments/appointment-time";
import { useAssignedAppointmentsAgendaQuery } from "@/features/appointments/appointments.hooks";
import { localeForLanguage } from "@/shared/lib/money";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

export function DoctorHomePage() {
  const { branch, branchSlug, tenant, tenantSlug } = useRouteWorkspaceContext();
  const { i18n, t } = useTranslation("appointments");
  const timeZone = branch?.branch.timezone ?? "Asia/Ho_Chi_Minh";
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const [date, setDate] = useState(() => todayInTimeZone(timeZone));
  const range = useMemo(() => agendaRange(date, timeZone), [date, timeZone]);
  const agenda = useAssignedAppointmentsAgendaQuery(tenantSlug, branchSlug, range);
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;
  const branchName = branch?.branch.name ?? branchSlug;
  return <div className="space-y-7"><div className="max-w-3xl space-y-2"><p className="text-sm font-semibold text-primary">{t("eyebrow", { tenantName, branchName })}</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("doctorTitle")}</h1><p className="text-sm leading-6 text-muted-foreground sm:text-base">{t("doctorDescription")}</p></div><Card><CardHeader className="gap-4 border-b border-border/70"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><CardTitle>{formatAppointmentDate(date, timeZone, locale)}</CardTitle><div className="flex items-center gap-2"><Button aria-label={t("agenda.previousDay")} onClick={() => setDate((current) => addDaysInTimeZone(current, -1, timeZone))} size="icon-sm" type="button" variant="outline"><ChevronLeft aria-hidden="true" /></Button><Input aria-label={t("doctorTitle")} className="w-40" onChange={(event) => setDate(event.target.value)} type="date" value={date} /><Button aria-label={t("agenda.nextDay")} onClick={() => setDate((current) => addDaysInTimeZone(current, 1, timeZone))} size="icon-sm" type="button" variant="outline"><ChevronRight aria-hidden="true" /></Button></div></div></CardHeader><CardContent className="p-6">{agenda.isFetching && !agenda.isLoading && <RefreshCw aria-label={t("form.searching")} className="mb-3 size-4 animate-spin text-muted-foreground" />}{agenda.isError ? <div className="grid justify-items-center gap-3 py-12"><CalendarDays aria-hidden="true" className="size-8 text-muted-foreground" /><p className="font-semibold">{t("agenda.loadError")}</p><Button onClick={() => void agenda.refetch()} size="sm" type="button">{t("agenda.retry")}</Button></div> : <AppointmentAgendaList appointments={agenda.data ?? []} emptyDescription={t("agenda.emptyTitle")} isLoading={agenda.isLoading} locale={locale} timeZone={timeZone} />}</CardContent></Card></div>;
}
