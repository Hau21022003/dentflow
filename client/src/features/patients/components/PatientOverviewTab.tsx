import { pathFor } from "@/app/router/paths";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetCloseButton, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePatientTreatmentPlanQuery } from "@/features/patients/patients.hooks";
import type { PatientAlert, PatientOverview } from "@/features/patients/patients.types";
import { getErrorMessage } from "@/shared/lib/error";
import { formatMinorAmount } from "@/shared/lib/money";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Clock3,
  ContactRound,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

type Props = {
  branchSlug: string;
  locale: string;
  overview: PatientOverview;
  patientId: string;
  tenantSlug: string;
  timeZone: string;
};

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-border/70 py-3 first:border-t-0 sm:grid-cols-[1.25rem_8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span className="mt-0.5 hidden text-muted-foreground sm:block">{icon}</span>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

function AlertItem({ alert, label }: { alert: PatientAlert; label: string }) {
  const severityClass = {
    INFO: "border-blue-200 bg-blue-50 text-blue-900",
    WARNING: "border-amber-200 bg-amber-50 text-amber-950",
    CRITICAL: "border-red-200 bg-red-50 text-red-950",
  }[alert.severity];
  return (
    <div className={`rounded-xl border p-3 ${severityClass}`}>
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <AlertTriangle aria-hidden="true" className="size-4" />
        {label}
      </div>
      <p className="text-sm leading-6">{alert.message}</p>
    </div>
  );
}

export function PatientOverviewTab({ branchSlug, locale, overview, patientId, tenantSlug, timeZone }: Props) {
  const { t } = useTranslation("patients");
  const [planOpen, setPlanOpen] = useState(false);
  const patient = overview.patient;
  const nextAppointment = overview.nextAppointment;
  const summary = overview.treatmentSummary;
  const featuredPlan = summary.featuredPlan;
  const planQuery = usePatientTreatmentPlanQuery(
    tenantSlug,
    branchSlug,
    patientId,
    planOpen ? (featuredPlan?.id ?? null) : null,
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }),
    [locale, timeZone],
  );
  const appointmentFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone }),
    [locale, timeZone],
  );
  const progress = featuredPlan?.totalItems
    ? Math.round((featuredPlan.completedItems / featuredPlan.totalItems) * 100)
    : 0;

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.35fr)]">
        <Card>
          <CardHeader className="flex-row items-center gap-3 border-b p-5">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <ContactRound aria-hidden="true" className="size-5" />
            </span>
            <CardTitle>{t("detail.information.title")}</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <dl>
              <DetailRow icon={<UserRound aria-hidden="true" className="size-4" />} label={t("form.fields.fullName")} value={patient.fullName} />
              <DetailRow icon={<Activity aria-hidden="true" className="size-4" />} label={t("detail.information.patientCode")} value={patient.code} />
              <DetailRow icon={<CalendarDays aria-hidden="true" className="size-4" />} label={t("form.fields.dateOfBirth")} value={patient.dateOfBirth ? dateFormatter.format(new Date(`${patient.dateOfBirth}T00:00:00`)) : t("table.notProvided")} />
              <DetailRow icon={<Phone aria-hidden="true" className="size-4" />} label={t("form.fields.phone")} value={patient.phone} />
              <DetailRow icon={<Mail aria-hidden="true" className="size-4" />} label={t("form.fields.email")} value={patient.email ?? t("table.notProvided")} />
              <DetailRow icon={<MapPin aria-hidden="true" className="size-4" />} label={t("form.fields.address")} value={patient.address ?? t("table.notProvided")} />
              <DetailRow
                icon={<ContactRound aria-hidden="true" className="size-4" />}
                label={t("form.emergencyContact.title")}
                value={patient.emergencyContact ? `${patient.emergencyContact.fullName} · ${patient.emergencyContact.phone}${patient.emergencyContact.relationship ? ` (${patient.emergencyContact.relationship})` : ""}` : t("table.notProvided")}
              />
              <DetailRow icon={<HeartPulse aria-hidden="true" className="size-4" />} label={t("form.fields.referralSource")} value={patient.referralSource ?? t("table.notProvided")} />
            </dl>
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-3 text-sm font-semibold">{t("detail.alerts.title")}</h3>
              {overview.activeAlerts.length ? (
                <div className="space-y-2">
                  {overview.activeAlerts.map((alert) => (
                    <AlertItem alert={alert} key={alert.id} label={`${t(`detail.alerts.categories.${alert.category}`)} · ${t(`detail.alerts.severities.${alert.severity}`)}`} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("detail.alerts.empty")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center gap-3 border-b p-5">
              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <CalendarDays aria-hidden="true" className="size-5" />
              </span>
              <CardTitle>{t("detail.nextAppointment.title")}</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {nextAppointment ? (
                <div className="flex flex-col gap-5 rounded-xl bg-muted/60 p-5 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold">{appointmentFormatter.format(new Date(nextAppointment.startAt))}</p>
                      <Badge variant="secondary">{t(`detail.appointmentStatuses.${nextAppointment.status}`)}</Badge>
                    </div>
                    <p className="font-semibold">{nextAppointment.serviceName ?? nextAppointment.visitReason ?? t("table.notProvided")}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><Stethoscope aria-hidden="true" className="size-4" />{nextAppointment.assignedDentist?.fullName ?? t("detail.nextAppointment.unassigned")}</span>
                      {nextAppointment.operatory && <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4" />{nextAppointment.operatory.name}</span>}
                    </div>
                  </div>
                  <Button asChild><Link to={`${pathFor.workspaceReceptionAppointments(tenantSlug, branchSlug)}?appointmentId=${encodeURIComponent(nextAppointment.id)}`}>{t("detail.nextAppointment.view")}</Link></Button>
                </div>
              ) : (
                <Empty className="border py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><CalendarDays aria-hidden="true" /></EmptyMedia>
                    <EmptyTitle>{t("detail.nextAppointment.emptyTitle")}</EmptyTitle>
                    <EmptyDescription>{t("detail.nextAppointment.emptyDescription")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-3 border-b p-5">
              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><HeartPulse aria-hidden="true" className="size-5" /></span>
              <CardTitle>{t("detail.treatment.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700"><ClipboardList aria-hidden="true" className="size-5" /></span>
                  <div className="min-w-0"><strong className="block text-xl leading-tight">{summary.activePlanCount}</strong><p className="text-sm text-muted-foreground">{t("detail.treatment.activePlans")}</p></div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CircleCheck aria-hidden="true" className="size-5" /></span>
                  <div className="min-w-0"><strong className="block text-xl leading-tight">{summary.completedItems} / {summary.totalItems}</strong><p className="text-sm text-muted-foreground">{t("detail.treatment.completedItems")}</p></div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"><Clock3 aria-hidden="true" className="size-5" /></span>
                  <div className="min-w-0"><strong className="block text-xl leading-tight">{summary.pendingItems}</strong><p className="text-sm text-muted-foreground">{t("detail.treatment.pendingItems")}</p></div>
                </div>
              </div>
              {featuredPlan ? (
                <div className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><strong>{featuredPlan.code} · {featuredPlan.serviceName ?? t("detail.treatment.fallbackName")}</strong><Badge variant="secondary">{t(`detail.planStatuses.${featuredPlan.status}`)}</Badge></div>
                      <p className="mt-1 text-sm text-muted-foreground">{t("detail.treatment.created", { date: dateFormatter.format(new Date(featuredPlan.createdAt)) })}</p>
                    </div>
                    <Button onClick={() => setPlanOpen(true)} variant="outline">{t("detail.treatment.viewPlan")}</Button>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
                    <span className="text-sm font-semibold">{progress}%</span>
                  </div>
                </div>
              ) : (
                <Empty className="border py-10"><EmptyHeader><EmptyMedia variant="icon"><HeartPulse aria-hidden="true" /></EmptyMedia><EmptyTitle>{t("detail.treatment.emptyTitle")}</EmptyTitle><EmptyDescription>{t("detail.treatment.emptyDescription")}</EmptyDescription></EmptyHeader></Empty>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet onOpenChange={setPlanOpen} open={planOpen}>
        <SheetContent className="max-w-2xl overflow-y-auto" side="right">
          <div className="flex items-start justify-between border-b p-5"><div><SheetTitle>{featuredPlan?.code} · {t("detail.treatment.planDetails")}</SheetTitle><p className="mt-1 text-sm text-muted-foreground">{t("detail.treatment.readOnly")}</p></div><SheetCloseButton /></div>
          <div className="space-y-4 p-5">
            {planQuery.isLoading && <div className="h-64 animate-pulse rounded-xl bg-muted" />}
            {planQuery.isError && <Alert variant="destructive"><div className="flex items-center justify-between gap-3"><span>{getErrorMessage(planQuery.error)}</span><Button onClick={() => void planQuery.refetch()} size="sm" variant="outline">{t("actions.retry")}</Button></div></Alert>}
            {planQuery.data?.items.map((item) => (
              <article className="rounded-xl border p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.service.name}</h3><p className="text-sm text-muted-foreground">{item.service.code}</p></div><Badge variant="outline">{t(`detail.itemStatuses.${item.status}`)}</Badge></div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">{t("detail.treatment.quantity")}</dt><dd className="font-medium">{item.quantity}</dd></div>
                  <div><dt className="text-muted-foreground">{t("detail.treatment.tooth")}</dt><dd className="font-medium">{item.toothPosition ?? "—"}</dd></div>
                  <div><dt className="text-muted-foreground">{t("detail.treatment.price")}</dt><dd className="font-medium">{formatMinorAmount(item.finalUnitAmount, item.currency, locale)}</dd></div>
                  <div><dt className="text-muted-foreground">{t("detail.treatment.discount")}</dt><dd className="font-medium">{formatMinorAmount(item.discountAmount, item.currency, locale)}</dd></div>
                  <div><dt className="text-muted-foreground">{t("detail.treatment.dentist")}</dt><dd className="font-medium">{item.plannedDentist?.fullName ?? "—"}</dd></div>
                  <div><dt className="text-muted-foreground">{t("detail.treatment.indication")}</dt><dd className="font-medium">{item.indication ?? "—"}</dd></div>
                </dl>
              </article>
            ))}
            {planQuery.data && planQuery.data.items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t("detail.treatment.noItems")}</p>}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
