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
import {
  agendaRange,
  dateInTimeZone,
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/features/appointments/appointment-time";
import { useAssignedAppointmentsAgendaQuery } from "@/features/appointments/appointments.hooks";
import type { AssignedAppointment } from "@/features/appointments/appointments.types";
import { AppointmentStatusBadge } from "@/features/appointments/components/AppointmentStatusBadge";
import { VisitAddendumForm } from "@/features/visits/components/VisitAddendumForm";
import { VisitClinicalForm } from "@/features/visits/components/VisitClinicalForm";
import {
  useStartVisitMutation,
  useVisitQuery,
} from "@/features/visits/visits.hooks";
import type { Visit } from "@/features/visits/visits.types";
import { useToast } from "@/shared/components/ToastProvider";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { localeForLanguage } from "@/shared/lib/money";
import { CalendarDays, ChevronLeft, FilePenLine, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

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

function AppointmentSummary({
  appointment,
  locale,
  timeZone,
}: {
  appointment: AssignedAppointment;
  locale: string;
  timeZone: string;
}) {
  const { t } = useTranslation("visits");

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("appointment.patient")}</p>
            <p className="text-lg font-semibold">{appointment.patient.fullName}</p>
          </div>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("appointment.date")}</dt>
            <dd className="mt-1 font-medium">
              {formatAppointmentDate(
                dateInTimeZone(appointment.startAt, timeZone),
                timeZone,
                locale,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("appointment.time")}</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {formatAppointmentTime(appointment.startAt, timeZone, locale)}
              {" – "}
              {formatAppointmentTime(appointment.endAt, timeZone, locale)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{t("appointment.service")}</dt>
            <dd className="mt-1 font-medium">
              {appointment.service
                ? `${appointment.service.code} · ${appointment.service.name}`
                : t("appointment.noService")}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function DoctorVisitPage() {
  const { appointmentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { branch, branchSlug, tenantSlug } = useRouteWorkspaceContext();
  const { i18n, t } = useTranslation("visits");
  const { success } = useToast();
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
      success(t("feedback.started"));
    } catch (error) {
      handleApiError({ error, onMessage: setStartError });
    }
  }

  const schedulePath = validDate
    ? `${pathFor.workspaceDoctor(tenantSlug, branchSlug)}?date=${encodeURIComponent(date)}`
    : pathFor.workspaceDoctor(tenantSlug, branchSlug);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild size="sm" type="button" variant="ghost">
            <Link to={schedulePath}>
              <ChevronLeft aria-hidden="true" />
              {t("actions.backToSchedule")}
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </div>
        {visit && (
          <Badge variant={visit.status === "COMPLETED" ? "secondary" : "default"}>
            {t(`statuses.${visit.status}`)}
          </Badge>
        )}
      </div>

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
            <Button onClick={() => void agenda.refetch()} size="sm" type="button" variant="outline">
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
          <AppointmentSummary appointment={appointment} locale={locale} timeZone={timeZone} />
          {appointment.status === "CHECKED_IN" && !visit && (
            <Card>
              <CardHeader>
                <CardTitle>{t("start.title")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("start.description")}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {startError && <Alert variant="destructive">{startError}</Alert>}
                <Button disabled={startMutation.isPending} onClick={() => void startVisit()} type="button">
                  {startMutation.isPending && <Spinner aria-label={t("actions.starting")} />}
                  <Stethoscope aria-hidden="true" />
                  {t("actions.start")}
                </Button>
              </CardContent>
            </Card>
          )}
          {appointment.status !== "CHECKED_IN" && !visit && visitQuery.isLoading && (
            <div className="h-96 animate-pulse rounded-xl bg-muted" />
          )}
          {appointment.status !== "CHECKED_IN" && !visit && visitQuery.isError && (
            <Alert variant="destructive">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{t("errors.visitLoad")}</span>
                <Button onClick={() => void visitQuery.refetch()} size="sm" type="button" variant="outline">
                  {t("actions.retry")}
                </Button>
              </div>
            </Alert>
          )}
          {visit && (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <VisitClinicalForm
                  appointmentId={appointmentId}
                  branchSlug={branchSlug}
                  tenantSlug={tenantSlug}
                  visit={visit}
                />
                {visit.status === "COMPLETED" && (
                  <>
                    <VisitAddenda addenda={visit.addenda} locale={locale} timeZone={timeZone} />
                    <VisitAddendumForm
                      appointmentId={appointmentId}
                      branchSlug={branchSlug}
                      tenantSlug={tenantSlug}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}
          {appointment.status !== "CHECKED_IN" &&
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
