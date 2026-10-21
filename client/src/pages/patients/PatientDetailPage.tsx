import { pathFor } from "@/app/router/paths";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PatientAppointmentsTab } from "@/features/patients/components/PatientAppointmentsTab";
import { PatientFormDialog } from "@/features/patients/components/PatientFormDialog";
import { PatientOverviewTab } from "@/features/patients/components/PatientOverviewTab";
import { PatientTreatmentPlansTab } from "@/features/patients/components/PatientTreatmentPlansTab";
import { PatientVisitsTab } from "@/features/patients/components/PatientVisitsTab";
import { usePatientOverviewQuery } from "@/features/patients/patients.hooks";
import { ApiError, getErrorMessage } from "@/shared/lib/error";
import { localeForLanguage } from "@/shared/lib/money";
import { cn } from "@/shared/lib/utils";
import { ArrowLeft, Mail, Pencil, Phone, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useRouteWorkspaceContext } from "../workspace/use-route-workspace-context";

type PatientDetailTab =
  | "overview"
  | "appointments"
  | "visits"
  | "treatment-plans";

const PATIENT_DETAIL_TABS: PatientDetailTab[] = [
  "overview",
  "appointments",
  "visits",
  "treatment-plans",
];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}

function age(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  let result = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    result -= 1;
  }
  return result;
}

function PageSkeleton() {
  return (
    <div aria-label="Loading" className="space-y-5 animate-pulse">
      <div className="h-44 rounded-2xl bg-muted" />
      <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.35fr)]">
        <div className="h-[34rem] rounded-2xl bg-muted" />
        <div className="space-y-5">
          <div className="h-56 rounded-2xl bg-muted" />
          <div className="h-72 rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function PatientDetailPage() {
  const { patientId = "" } = useParams();
  const { branch, branchSlug, tenantSlug } = useRouteWorkspaceContext();
  const { i18n, t } = useTranslation("patients");
  const [searchParams, setSearchParams] = useSearchParams();
  const overviewQuery = usePatientOverviewQuery(tenantSlug, branchSlug, patientId);
  const [editOpen, setEditOpen] = useState(false);
  const requestedTab = searchParams.get("tab");
  const activeTab: PatientDetailTab = PATIENT_DETAIL_TABS.includes(
    requestedTab as PatientDetailTab,
  )
    ? (requestedTab as PatientDetailTab)
    : "overview";
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const timeZone = branch?.branch.timezone ?? "Asia/Ho_Chi_Minh";
  const canAssign = branch?.roles.includes("BRANCH_ADMIN") ?? false;
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }),
    [locale, timeZone],
  );

  function activateTab(tab: PatientDetailTab) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    if (tab !== "appointments") params.delete("appointmentId");
    if (tab !== "treatment-plans") params.delete("planId");
    setSearchParams(params);
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: PatientDetailTab,
  ) {
    const currentIndex = PATIENT_DETAIL_TABS.indexOf(currentTab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % PATIENT_DETAIL_TABS.length;
    }
    if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + PATIENT_DETAIL_TABS.length) %
        PATIENT_DETAIL_TABS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = PATIENT_DETAIL_TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = PATIENT_DETAIL_TABS[nextIndex];
    activateTab(nextTab);
    window.requestAnimationFrame(() => {
      document.getElementById(`patient-detail-tab-${nextTab}`)?.focus();
    });
  }

  if (overviewQuery.isLoading) return <PageSkeleton />;
  if (overviewQuery.isError) {
    const notFound = ApiError.from(overviewQuery.error).status === 404;
    return (
      <Empty className="min-h-[28rem] border">
        <EmptyHeader>
          <EmptyMedia variant="icon"><UserRound aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>{t(notFound ? "detail.notFound.title" : "detail.error.title")}</EmptyTitle>
          <EmptyDescription>
            {notFound ? t("detail.notFound.description") : getErrorMessage(overviewQuery.error)}
          </EmptyDescription>
        </EmptyHeader>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={pathFor.workspaceReceptionPatients(tenantSlug, branchSlug)}>{t("detail.actions.back")}</Link>
          </Button>
          {!notFound && <Button onClick={() => void overviewQuery.refetch()}>{t("actions.retry")}</Button>}
        </div>
      </Empty>
    );
  }

  const overview = overviewQuery.data!;
  const patient = overview.patient;
  const patientAge = age(patient.dateOfBirth);

  return (
    <div className="space-y-5">
      <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" to={pathFor.workspaceReceptionPatients(tenantSlug, branchSlug)}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("detail.actions.back")}
      </Link>

      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          <div className="grid size-20 shrink-0 place-items-center rounded-full bg-primary/12 text-2xl font-bold text-primary">{initials(patient.fullName)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{patient.fullName}</h1>
              <Badge className={overview.activityStatus === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>{t(`detail.activity.${overview.activityStatus}`)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{patient.code}</span>
              <span>{t(`genders.${patient.gender}`)}</span>
              {patient.dateOfBirth && (
                <span>{dateFormatter.format(new Date(`${patient.dateOfBirth}T00:00:00`))}{patientAge !== null ? ` · ${t("table.age", { count: patientAge })}` : ""}</span>
              )}
              <span className="inline-flex items-center gap-1.5"><Phone aria-hidden="true" className="size-4" /> {patient.phone}</span>
              {patient.email && <span className="inline-flex items-center gap-1.5"><Mail aria-hidden="true" className="size-4" /> {patient.email}</span>}
            </div>
          </div>
          <Button onClick={() => setEditOpen(true)} variant="outline"><Pencil aria-hidden="true" /> {t("actions.edit")}</Button>
        </CardContent>
        <div aria-label={t("detail.tabs.label")} className="flex border-t px-4" role="tablist">
          {PATIENT_DETAIL_TABS.map((tab) => (
            <button
              aria-controls={`patient-detail-panel-${tab}`}
              aria-selected={activeTab === tab}
              className={cn(
                "border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              id={`patient-detail-tab-${tab}`}
              key={tab}
              onClick={() => activateTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tab)}
              role="tab"
              tabIndex={activeTab === tab ? 0 : -1}
              type="button"
            >
              {t(`detail.tabs.${tab}`)}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === "overview" && (
        <div aria-labelledby="patient-detail-tab-overview" id="patient-detail-panel-overview" role="tabpanel" tabIndex={0}>
          <PatientOverviewTab branchSlug={branchSlug} locale={locale} overview={overview} patientId={patientId} tenantSlug={tenantSlug} timeZone={timeZone} />
        </div>
      )}
      {activeTab === "appointments" && (
        <div aria-labelledby="patient-detail-tab-appointments" id="patient-detail-panel-appointments" role="tabpanel" tabIndex={0}>
          <PatientAppointmentsTab branchSlug={branchSlug} canAssign={canAssign} nextAppointment={overview.nextAppointment} patient={patient} tenantSlug={tenantSlug} timeZone={timeZone} />
        </div>
      )}
      {activeTab === "visits" && (
        <div aria-labelledby="patient-detail-tab-visits" id="patient-detail-panel-visits" role="tabpanel" tabIndex={0}>
          <PatientVisitsTab branchSlug={branchSlug} locale={locale} patientId={patientId} tenantSlug={tenantSlug} timeZone={timeZone} />
        </div>
      )}
      {activeTab === "treatment-plans" && (
        <div
          aria-labelledby="patient-detail-tab-treatment-plans"
          id="patient-detail-panel-treatment-plans"
          role="tabpanel"
          tabIndex={0}
        >
          <PatientTreatmentPlansTab
            branchSlug={branchSlug}
            locale={locale}
            patientId={patientId}
            tenantSlug={tenantSlug}
            timeZone={timeZone}
          />
        </div>
      )}

      <PatientFormDialog branchSlug={branchSlug} onOpenChange={setEditOpen} open={editOpen} patient={patient} tenantSlug={tenantSlug} />
    </div>
  );
}
