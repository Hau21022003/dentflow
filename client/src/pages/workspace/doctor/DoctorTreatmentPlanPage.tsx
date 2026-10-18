import { pathFor } from "@/app/router/paths";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TreatmentPlansPanel } from "@/features/treatment-plans/components/TreatmentPlansPanel";
import { useVisitQuery } from "@/features/visits/visits.hooks";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return (
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

export function DoctorTreatmentPlanPage() {
  const { appointmentId = "", planId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { branch, branchSlug, tenantSlug, user } = useRouteWorkspaceContext();
  const navigate = useNavigate();
  const { t } = useTranslation("treatmentPlans");
  const { t: tVisits } = useTranslation("visits");
  const date = searchParams.get("date");
  const visit = useVisitQuery(tenantSlug, branchSlug, appointmentId || null);
  const backPath = validDate(date)
    ? `${pathFor.workspaceDoctorVisit(tenantSlug, branchSlug, appointmentId, date)}&tab=treatment-plans`
    : pathFor.workspaceDoctor(tenantSlug, branchSlug);

  return (
    <div className="mx-auto max-w-7xl space-y-3 sm:space-y-5">
      <Button
        asChild
        className="-ml-2 sm:ml-0"
        size="sm"
        type="button"
        variant="ghost"
      >
        <Link to={backPath}>
          <ChevronLeft aria-hidden="true" />
          <span className="sm:hidden">{t("title")}</span>
          <span className="hidden sm:inline">
            {tVisits("actions.backToVisit")}
          </span>
        </Link>
      </Button>

      <div className="hidden sm:block">
        <p className="text-sm font-medium text-primary">{t("title")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("detail.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("visitList.detailPageDescription")}
        </p>
      </div>

      {visit.isLoading && (
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      )}
      {visit.isError && (
        <Alert variant="destructive">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{tVisits("errors.visitLoad")}</span>
            <Button
              onClick={() => void visit.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              {tVisits("actions.retry")}
            </Button>
          </div>
        </Alert>
      )}
      {visit.data && (
        <TreatmentPlansPanel
          branchSlug={branchSlug}
          initialPlanId={planId}
          onDraftCancel={() => navigate(backPath)}
          onProposed={() => navigate(backPath)}
          showList={false}
          tenantSlug={tenantSlug}
          timeZone={branch?.branch.timezone ?? "Asia/Ho_Chi_Minh"}
          user={user}
          visitId={visit.data.id}
        />
      )}
    </div>
  );
}
