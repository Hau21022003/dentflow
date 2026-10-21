import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePatientTreatmentPlanQuery } from "@/features/patients/patients.hooks";
import { getErrorMessage } from "@/shared/lib/error";
import { formatMinorAmount, localeForLanguage } from "@/shared/lib/money";
import { useTranslation } from "react-i18next";
import { PatientTreatmentPlanStatusBadge } from "./PatientTreatmentPlanStatusBadge";

type Props = {
  branchSlug: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  patientId: string;
  planCode?: string;
  planId: string | null;
  tenantSlug: string;
};

export function PatientTreatmentPlanSheet({
  branchSlug,
  onOpenChange,
  open,
  patientId,
  planCode,
  planId,
  tenantSlug,
}: Props) {
  const { i18n, t } = useTranslation("patients");
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const planQuery = usePatientTreatmentPlanQuery(
    tenantSlug,
    branchSlug,
    patientId,
    open ? planId : null,
  );
  const plan = planQuery.data;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="max-w-2xl overflow-y-auto" side="right">
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle>
                {plan?.code ?? planCode ?? t("detail.treatment.fallbackName")} ·{" "}
                {t("detail.treatment.planDetails")}
              </SheetTitle>
              {plan && <PatientTreatmentPlanStatusBadge status={plan.status} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("detail.treatment.readOnly")}
            </p>
          </div>
          <SheetCloseButton />
        </div>
        <div className="space-y-4 p-5">
          {planQuery.isLoading && (
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          )}
          {planQuery.isError && (
            <Alert variant="destructive">
              <div className="flex items-center justify-between gap-3">
                <span>{getErrorMessage(planQuery.error)}</span>
                <Button
                  onClick={() => void planQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("actions.retry")}
                </Button>
              </div>
            </Alert>
          )}
          {plan?.items.map((item) => (
            <article className="rounded-xl border p-4" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{item.service.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.service.code}
                  </p>
                </div>
                <Badge variant="outline">
                  {t(`detail.itemStatuses.${item.status}`)}
                </Badge>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">
                    {t("detail.treatment.quantity")}
                  </dt>
                  <dd className="font-medium">{item.quantity}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("detail.treatment.tooth")}
                  </dt>
                  <dd className="font-medium">{item.toothPosition ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("detail.treatment.price")}
                  </dt>
                  <dd className="font-medium">
                    {formatMinorAmount(
                      item.finalUnitAmount * item.quantity,
                      item.currency,
                      locale,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("detail.treatment.discount")}
                  </dt>
                  <dd className="font-medium">
                    {formatMinorAmount(
                      item.discountAmount * item.quantity,
                      item.currency,
                      locale,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("detail.treatment.dentist")}
                  </dt>
                  <dd className="font-medium">
                    {item.plannedDentist?.fullName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("detail.treatment.indication")}
                  </dt>
                  <dd className="font-medium">{item.indication ?? "—"}</dd>
                </div>
              </dl>
            </article>
          ))}
          {plan && plan.items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("detail.treatment.noItems")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
