import { pathFor } from "@/app/router/paths";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  agendaRange,
  dateInTimeZone,
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/features/appointments/appointment-time";
import { useAssignedAppointmentsAgendaQuery } from "@/features/appointments/appointments.hooks";
import type { AssignedAppointment } from "@/features/appointments/appointments.types";
import { AppointmentStatusBadge } from "@/features/appointments/components/AppointmentStatusBadge";
import { hasBranchPermission } from "@/features/auth/authorization";
import { PERMISSIONS } from "@/features/auth/auth.types";
import { PatientAlertsPanel } from "@/features/patients/components/PatientAlertsPanel";
import { PatientTreatmentPlanStatusBadge } from "@/features/patients/components/PatientTreatmentPlanStatusBadge";
import {
  PATIENT_ALERT_CATEGORY_VISUALS,
  PATIENT_ALERT_SEVERITY_VISUALS,
} from "@/features/patients/patient-alert-visuals";
import { usePatientAlertsQuery } from "@/features/patients/patients.hooks";
import { useTreatmentPlansQuery } from "@/features/treatment-plans/treatment-plans.hooks";
import type { TreatmentPlan } from "@/features/treatment-plans/treatment-plans.types";
import { VisitTreatmentPlansTab } from "@/features/treatment-plans/components/VisitTreatmentPlansTab";
import { VisitAddendumForm } from "@/features/visits/components/VisitAddendumForm";
import { VisitClinicalForm } from "@/features/visits/components/VisitClinicalForm";
import {
  useStartVisitMutation,
  useVisitQuery,
} from "@/features/visits/visits.hooks";
import type { Visit } from "@/features/visits/visits.types";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { localeForLanguage } from "@/shared/lib/money";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  FilePenLine,
  Phone,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

type VisitTab = "clinical" | "safety" | "treatment-plans";

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function formatVisitDateTime(isoTimestamp: string, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoTimestamp));
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return [parts[0], parts.at(-1)]
    .filter(Boolean)
    .map((part) => part![0])
    .join("")
    .toLocaleUpperCase();
}

function ageOnDate(dateOfBirth: string | null, timeZone: string): number | null {
  if (!dateOfBirth) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  let age = value("year") - birthYear;
  if (
    value("month") < birthMonth ||
    (value("month") === birthMonth && value("day") < birthDay)
  ) {
    age -= 1;
  }
  return age;
}

function VisitAddenda({
  addenda,
  locale,
  timeZone,
}: {
  addenda: Visit["addenda"];
  locale: string;
  timeZone: string;
}) {
  const { t } = useTranslation("visits");
  return (
    <section className="space-y-4 border-t pt-6" aria-labelledby="visit-addenda">
      <div>
        <h2 className="text-lg font-semibold" id="visit-addenda">
          {t("addendum.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("addendum.description")}
        </p>
      </div>
      {addenda.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t("addendum.empty")}
        </p>
      ) : (
        <ol className="space-y-3">
          {addenda.map((addendum) => (
            <li className="rounded-lg border p-4" key={addendum.id}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium">{addendum.author.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatVisitDateTime(addendum.createdAt, timeZone, locale)}
                </p>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{addendum.content}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CompactVisitHeader({
  appointment,
  canViewProfile,
  locale,
  profilePath,
  timeZone,
  userName,
  visit,
}: {
  appointment: AssignedAppointment;
  canViewProfile: boolean;
  locale: string;
  profilePath: string;
  timeZone: string;
  userName: string;
  visit: Visit | null;
}) {
  const { t } = useTranslation("visits");
  const { t: tPatients } = useTranslation("patients");
  const age = ageOnDate(appointment.patient.dateOfBirth, timeZone);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {initials(appointment.patient.fullName)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {appointment.patient.fullName}
              </h1>
              <Badge variant="secondary">
                {tPatients(`genders.${appointment.patient.gender}`)}
                {age !== null ? ` · ${t("header.age", { count: age })}` : ""}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{appointment.patient.code}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Phone aria-hidden="true" className="size-3.5" />
                {appointment.patient.phone}
              </span>
            </div>
          </div>
        </div>
        {canViewProfile && (
          <Button asChild type="button" variant="outline">
            <Link to={profilePath}>
              <CircleUserRound aria-hidden="true" />
              {t("header.viewPatientProfile")}
            </Link>
          </Button>
        )}
      </div>
      <dl className="grid border-t bg-muted/20 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex gap-3 border-b p-4 sm:border-r xl:border-b-0">
          <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <dt className="text-xs text-muted-foreground">{t("header.visitTime")}</dt>
            <dd className="mt-0.5 text-sm font-semibold">
              {formatAppointmentDate(
                dateInTimeZone(appointment.startAt, timeZone),
                timeZone,
                locale,
              )}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {formatAppointmentTime(appointment.startAt, timeZone, locale)} –{" "}
              {formatAppointmentTime(appointment.endAt, timeZone, locale)}
            </dd>
          </div>
        </div>
        <div className="flex gap-3 border-b p-4 xl:border-r xl:border-b-0">
          <ClipboardList className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <dt className="text-xs text-muted-foreground">{t("header.operatory")}</dt>
            <dd className="mt-0.5 text-sm font-semibold">
              {appointment.operatory
                ? `${appointment.operatory.code} · ${appointment.operatory.name}`
                : t("header.noOperatory")}
            </dd>
          </div>
        </div>
        <div className="flex gap-3 border-b p-4 sm:border-r sm:border-b-0">
          <UserRound className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <dt className="text-xs text-muted-foreground">{t("header.dentist")}</dt>
            <dd className="mt-0.5 text-sm font-semibold">{userName}</dd>
          </div>
        </div>
        <div className="flex gap-3 p-4">
          <Stethoscope className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <dt className="text-xs text-muted-foreground">{t("header.status")}</dt>
            <dd className="mt-1">
              {visit ? (
                <Badge variant={visit.status === "COMPLETED" ? "secondary" : "default"}>
                  {t(`statuses.${visit.status}`)}
                </Badge>
              ) : (
                <AppointmentStatusBadge status={appointment.status} />
              )}
            </dd>
          </div>
        </div>
      </dl>
    </Card>
  );
}

function ClinicalReferenceSidebar({
  branchSlug,
  onShowPlans,
  onShowSafety,
  patientId,
  tenantSlug,
  visitId,
}: {
  branchSlug: string;
  onShowPlans: () => void;
  onShowSafety: () => void;
  patientId: string;
  tenantSlug: string;
  visitId: string;
}) {
  const { t } = useTranslation("visits");
  const { t: tPatients } = useTranslation("patients");
  const alerts = usePatientAlertsQuery(tenantSlug, branchSlug, patientId);
  const plans = useTreatmentPlansQuery(
    { tenantSlug, branchSlug, visitId },
    { page: 1, limit: 3 },
  );
  const activeAlerts = (alerts.data?.items ?? [])
    .filter((alert) => !alert.resolvedAt)
    .slice(0, 3);

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-600" />
            <CardTitle className="text-base">{t("references.safetyTitle")}</CardTitle>
          </div>
          <Button
            className="shrink-0 rounded-full"
            onClick={onShowSafety}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t("references.viewAll")}
            <ChevronRight aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {alerts.isLoading && (
            <div className="space-y-3 p-4" role="status">
              <span className="sr-only">{t("references.loadingAlerts")}</span>
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="flex items-center gap-3" key={index}>
                  <div className="size-10 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {alerts.isError && (
            <p className="p-4 text-sm text-destructive">
              {t("references.alertLoadError")}
            </p>
          )}
          {!alerts.isLoading && !alerts.isError && activeAlerts.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              {t("references.noActiveAlerts")}
            </p>
          )}
          {activeAlerts.map((alert) => {
            const categoryVisual =
              PATIENT_ALERT_CATEGORY_VISUALS[alert.category];
            const severityVisual =
              PATIENT_ALERT_SEVERITY_VISUALS[alert.severity];
            const CategoryIcon = categoryVisual.Icon;
            const SeverityIcon = severityVisual.Icon;

            return (
              <button
                className="group flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                key={alert.id}
                onClick={onShowSafety}
                type="button"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full border ${categoryVisual.className}`}
                  data-category-icon={alert.category}
                >
                  <CategoryIcon aria-hidden="true" size={20} stroke={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {tPatients(`detail.alerts.categories.${alert.category}`)}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                    {alert.message}
                  </span>
                </span>
                <Badge
                  className={`shrink-0 ${severityVisual.className}`}
                  variant="outline"
                >
                  <SeverityIcon aria-hidden="true" stroke={2} />
                  {tPatients(`detail.alerts.severities.${alert.severity}`)}
                </Badge>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            <CardTitle className="text-base">{t("references.plansTitle")}</CardTitle>
          </div>
          <Button onClick={onShowPlans} size="sm" type="button" variant="outline">
            {t("references.viewAll")}
            <ChevronRight aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {plans.isLoading && <div className="m-4 h-24 animate-pulse rounded-xl bg-muted" />}
          {plans.isError && (
            <p className="p-4 text-sm text-destructive">{t("references.planLoadError")}</p>
          )}
          {!plans.isLoading && !plans.isError && plans.data?.items.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              {t("references.noPlans")}
            </p>
          )}
          {plans.data?.items.map((plan: TreatmentPlan) => (
            <article className="flex items-center justify-between gap-3 p-4" key={plan.id}>
              <div className="min-w-0">
                <p className="font-semibold">{plan.code}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {plan.items[0]?.serviceName ?? t("references.planWithoutItems")}
                </p>
              </div>
              <PatientTreatmentPlanStatusBadge status={plan.status} />
            </article>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

export function DoctorVisitPage() {
  const { appointmentId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { branch, branchSlug, tenantSlug, user } = useRouteWorkspaceContext();
  const { i18n, t } = useTranslation("visits");
  const date = searchParams.get("date");
  const validDate = isValidDate(date);
  const timeZone = branch?.branch.timezone ?? "Asia/Ho_Chi_Minh";
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const range = useMemo(
    () => (validDate ? agendaRange(date, timeZone) : { from: "", to: "" }),
    [date, timeZone, validDate],
  );
  const agenda = useAssignedAppointmentsAgendaQuery(tenantSlug, branchSlug, range);
  const appointment = useMemo(
    () => agenda.data?.find((item) => item.id === appointmentId),
    [agenda.data, appointmentId],
  );
  const shouldLoadVisit =
    appointment?.status === "IN_PROGRESS" || appointment?.status === "COMPLETED";
  const visitQuery = useVisitQuery(
    tenantSlug,
    branchSlug,
    appointmentId || null,
    shouldLoadVisit,
  );
  const startMutation = useStartVisitMutation();
  const [startedVisit, setStartedVisit] = useState<Visit | null>(null);
  const [startIntent, setStartIntent] = useState<IdempotencyIntent | null>(null);
  const [startError, setStartError] = useState("");
  const visit = visitQuery.data ?? startedVisit;
  const requestedTab = searchParams.get("tab") as VisitTab | null;
  const safetyAvailable = Boolean(
    appointment && !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appointment.status),
  );
  const plansAvailable = visit?.status === "OPEN";
  const activeTab: VisitTab =
    requestedTab === "safety" && safetyAvailable
      ? "safety"
      : requestedTab === "treatment-plans" && plansAvailable
        ? "treatment-plans"
        : "clinical";

  useEffect(() => {
    if (requestedTab && requestedTab !== activeTab) {
      const params = new URLSearchParams(searchParams);
      params.set("tab", activeTab);
      setSearchParams(params, { replace: true });
    }
  }, [activeTab, requestedTab, searchParams, setSearchParams]);

  function selectTab(tab: VisitTab) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    setSearchParams(params);
  }

  async function startVisit() {
    setStartError("");
    try {
      const nextIntent = idempotencyKeyForIntent(startIntent, {
        operation: "clinical.visit.start",
        tenantSlug,
        branchSlug,
        appointmentId,
      });
      setStartIntent(nextIntent);
      const created = await startMutation.mutateAsync({
        tenantSlug,
        branchSlug,
        appointmentId,
        idempotencyKey: nextIntent.key,
      });
      setStartIntent(null);
      setStartedVisit(created);
      toast.success(t("feedback.started"), { position: "top-right" });
    } catch (error) {
      handleApiError({ error, onMessage: setStartError });
    }
  }

  const schedulePath = validDate
    ? `${pathFor.workspaceDoctor(tenantSlug, branchSlug)}?date=${encodeURIComponent(date)}`
    : pathFor.workspaceDoctor(tenantSlug, branchSlug);
  const canViewProfile =
    hasBranchPermission(
      user,
      { slug: tenantSlug },
      branchSlug,
      PERMISSIONS.patientAdministrativeManage,
    ) &&
    hasBranchPermission(
      user,
      { slug: tenantSlug },
      branchSlug,
      PERMISSIONS.patientClinicalRead,
    );

  return (
    <div
      className={`mx-auto max-w-[96rem] space-y-5 ${visit?.status === "OPEN" ? "pb-24" : ""}`}
    >
      <Button asChild size="sm" type="button" variant="ghost">
        <Link to={schedulePath}>
          <ChevronLeft aria-hidden="true" />
          {t("actions.backToSchedule")}
        </Link>
      </Button>

      {!validDate ? (
        <Empty className="border border-dashed py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("states.invalidLinkTitle")}</EmptyTitle>
            <EmptyDescription>{t("states.invalidLinkDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : agenda.isLoading ? (
        <div className="grid gap-4">
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : agenda.isError ? (
        <Alert variant="destructive">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("errors.appointmentLoad")}</span>
            <Button
              onClick={() => void agenda.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("actions.retry")}
            </Button>
          </div>
        </Alert>
      ) : !appointment ? (
        <Empty className="border border-dashed py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("states.notFoundTitle")}</EmptyTitle>
            <EmptyDescription>{t("states.notFoundDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <CompactVisitHeader
            appointment={appointment}
            canViewProfile={canViewProfile}
            locale={locale}
            profilePath={pathFor.workspaceReceptionPatientDetail(
              tenantSlug,
              branchSlug,
              appointment.patient.id,
            )}
            timeZone={timeZone}
            userName={user?.fullName ?? "—"}
            visit={visit ?? null}
          />

          <Tabs onValueChange={(value) => selectTab(value as VisitTab)} value={activeTab}>
            <div className="overflow-x-auto">
              <TabsList aria-label={t("tabs.label")}>
                <TabsTrigger value="clinical">
                  <FilePenLine aria-hidden="true" className="size-4" />
                  {t("tabs.clinical")}
                </TabsTrigger>
                <TabsTrigger disabled={!safetyAvailable} value="safety">
                  <AlertTriangle aria-hidden="true" className="size-4" />
                  {t("tabs.safety")}
                </TabsTrigger>
                <TabsTrigger disabled={!plansAvailable} value="treatment-plans">
                  <ClipboardList aria-hidden="true" className="size-4" />
                  {t("tabs.treatmentPlans")}
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>

          {appointment.status === "CHECKED_IN" && !visit && activeTab === "clinical" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("start.title")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("start.description")}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {startError && <Alert variant="destructive">{startError}</Alert>}
                <Button
                  disabled={startMutation.isPending}
                  onClick={() => void startVisit()}
                  type="button"
                >
                  {startMutation.isPending && (
                    <Spinner aria-label={t("actions.starting")} />
                  )}
                  <Stethoscope aria-hidden="true" />
                  {t("actions.start")}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === "safety" && safetyAvailable && (
            <PatientAlertsPanel
              branchSlug={branchSlug}
              patientId={appointment.patient.id}
              tenantSlug={tenantSlug}
              timeZone={timeZone}
            />
          )}

          {appointment.status !== "CHECKED_IN" && !visit && visitQuery.isLoading && (
            <div className="h-96 animate-pulse rounded-xl bg-muted" />
          )}
          {appointment.status !== "CHECKED_IN" && !visit && visitQuery.isError && (
            <Alert variant="destructive">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{t("errors.visitLoad")}</span>
                <Button
                  onClick={() => void visitQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("actions.retry")}
                </Button>
              </div>
            </Alert>
          )}

          {visit && (
            <VisitClinicalForm
              appointmentId={appointmentId}
              aside={
                visit.status === "OPEN" ? (
                  <ClinicalReferenceSidebar
                    branchSlug={branchSlug}
                    onShowPlans={() => selectTab("treatment-plans")}
                    onShowSafety={() => selectTab("safety")}
                    patientId={appointment.patient.id}
                    tenantSlug={tenantSlug}
                    visitId={visit.id}
                  />
                ) : undefined
              }
              branchSlug={branchSlug}
              completedExtras={
                visit.status === "COMPLETED" ? (
                  <>
                    <VisitAddenda
                      addenda={visit.addenda}
                      locale={locale}
                      timeZone={timeZone}
                    />
                    <VisitAddendumForm
                      appointmentId={appointmentId}
                      branchSlug={branchSlug}
                      tenantSlug={tenantSlug}
                    />
                  </>
                ) : undefined
              }
              locale={locale}
              tenantSlug={tenantSlug}
              timeZone={timeZone}
              visible={activeTab === "clinical"}
              visit={visit}
            />
          )}

          {visit?.status === "OPEN" && activeTab === "treatment-plans" && (
            <VisitTreatmentPlansTab
              appointmentId={appointmentId}
              branchSlug={branchSlug}
              date={date}
              tenantSlug={tenantSlug}
              visitId={visit.id}
            />
          )}

          {activeTab === "clinical" &&
            appointment.status !== "CHECKED_IN" &&
            appointment.status !== "IN_PROGRESS" &&
            appointment.status !== "COMPLETED" && (
              <Empty className="border border-dashed py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FilePenLine aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("states.unavailableTitle")}</EmptyTitle>
                  <EmptyDescription>{t("states.unavailableDescription")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
        </>
      )}
    </div>
  );
}
