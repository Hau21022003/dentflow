import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreatePatientAlertMutation,
  usePatientAlertsQuery,
  useResolvePatientAlertMutation,
  useUpdatePatientAlertMutation,
} from "@/features/patients/patients.hooks";
import type {
  PatientAlert,
  PatientAlertInput,
  ResolvePatientAlertReasonCode,
} from "@/features/patients/patients.types";
import { getErrorMessage } from "@/shared/lib/error";
import { AlertTriangle, Eye, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function PatientAlertsPanel({
  branchSlug,
  patientId,
  tenantSlug,
}: {
  branchSlug: string;
  patientId: string;
  tenantSlug: string;
}) {
  const { t } = useTranslation("patients");
  const query = usePatientAlertsQuery(tenantSlug, branchSlug, patientId);
  const [editing, setEditing] = useState<PatientAlert | null | undefined>();
  const [resolving, setResolving] = useState<PatientAlert | null>(null);
  const [viewing, setViewing] = useState<PatientAlert | null>(null);

  return (
    <Card aria-labelledby="patient-alerts-title" role="region">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b">
        <div>
          <CardTitle id="patient-alerts-title">{t("alertsManagement.title")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t("alertsManagement.description")}</p>
        </div>
        <Button onClick={() => setEditing(null)} size="sm"><Plus /> {t("alertsManagement.add")}</Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {query.isError && <Alert variant="destructive">{getErrorMessage(query.error)}</Alert>}
        {query.isLoading && <div className="h-28 animate-pulse rounded-xl bg-muted" />}
        {query.data?.items.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{t("alertsManagement.empty")}</p>}
        {query.data?.items.map((alert) => (
          <article className={`rounded-xl border p-4 ${alert.resolvedAt ? "opacity-60" : ""}`} key={alert.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <Badge variant={alert.severity === "CRITICAL" ? "destructive" : "outline"}>{t(`detail.alerts.severities.${alert.severity}`)}</Badge>
                  <Badge variant="secondary">{t(`detail.alerts.categories.${alert.category}`)}</Badge>
                  {alert.resolvedAt && <Badge variant="outline">{t("alertsManagement.resolved")}</Badge>}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{alert.message}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setViewing(alert)} size="sm" variant="outline"><Eye /> {t("actions.view")}</Button>
                {!alert.resolvedAt && (
                  <>
                  <Button onClick={() => setEditing(alert)} size="sm" variant="outline"><Pencil /> {t("actions.edit")}</Button>
                  <Button onClick={() => setResolving(alert)} size="sm" variant="outline">{t("alertsManagement.resolve")}</Button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </CardContent>
      {editing !== undefined && (
        <AlertFormDialog
          alert={editing}
          branchSlug={branchSlug}
          onClose={() => setEditing(undefined)}
          patientId={patientId}
          tenantSlug={tenantSlug}
        />
      )}
      {resolving && (
        <ResolveAlertDialog
          alert={resolving}
          branchSlug={branchSlug}
          onClose={() => setResolving(null)}
          patientId={patientId}
          tenantSlug={tenantSlug}
        />
      )}
      {viewing && (
        <AlertViewDialog alert={viewing} onClose={() => setViewing(null)} />
      )}
    </Card>
  );
}

function AlertViewDialog({
  alert,
  onClose,
}: {
  alert: PatientAlert;
  onClose: () => void;
}) {
  const { t } = useTranslation("patients");
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("alertsManagement.viewTitle")}</DialogTitle>
          <DialogDescription>{t("alertsManagement.viewDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={alert.severity === "CRITICAL" ? "destructive" : "outline"}>
              {t(`detail.alerts.severities.${alert.severity}`)}
            </Badge>
            <Badge variant="secondary">
              {t(`detail.alerts.categories.${alert.category}`)}
            </Badge>
            {alert.resolvedAt && (
              <Badge variant="outline">{t("alertsManagement.resolved")}</Badge>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6">{alert.message}</p>
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            {t("alertsManagement.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AlertFormDialog({
  alert,
  branchSlug,
  onClose,
  patientId,
  tenantSlug,
}: {
  alert: PatientAlert | null;
  branchSlug: string;
  onClose: () => void;
  patientId: string;
  tenantSlug: string;
}) {
  const { t } = useTranslation("patients");
  const [category, setCategory] = useState<PatientAlertInput["category"]>(alert?.category ?? "ALLERGY");
  const [severity, setSeverity] = useState<PatientAlertInput["severity"]>(alert?.severity ?? "WARNING");
  const [message, setMessage] = useState(alert?.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreatePatientAlertMutation();
  const updateMutation = useUpdatePatientAlertMutation();
  const pending = createMutation.isPending || updateMutation.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    const input = { category, severity, message: message.trim() };
    setError(null);
    try {
      if (alert) {
        await updateMutation.mutateAsync({ tenantSlug, branchSlug, patientId, alertId: alert.id, input, idempotencyKey: crypto.randomUUID() });
      } else {
        await createMutation.mutateAsync({ tenantSlug, branchSlug, patientId, input, idempotencyKey: crypto.randomUUID() });
      }
      onClose();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader><DialogTitle>{t(alert ? "alertsManagement.editTitle" : "alertsManagement.createTitle")}</DialogTitle><DialogDescription>{t("alertsManagement.formDescription")}</DialogDescription></DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="alert-category">{t("alertsManagement.category")}</Label><select className="h-10 w-full rounded-lg border bg-background px-3" id="alert-category" onChange={(event) => setCategory(event.target.value as PatientAlertInput["category"])} value={category}>{["ALLERGY", "MEDICAL_CONDITION", "MEDICATION", "OTHER"].map((value) => <option key={value} value={value}>{t(`detail.alerts.categories.${value}`)}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="alert-severity">{t("alertsManagement.severity")}</Label><select className="h-10 w-full rounded-lg border bg-background px-3" id="alert-severity" onChange={(event) => setSeverity(event.target.value as PatientAlertInput["severity"])} value={severity}>{["INFO", "WARNING", "CRITICAL"].map((value) => <option key={value} value={value}>{t(`detail.alerts.severities.${value}`)}</option>)}</select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="alert-message">{t("alertsManagement.message")}</Label><Textarea id="alert-message" maxLength={500} onChange={(event) => setMessage(event.target.value)} required rows={5} value={message} /></div>
          <DialogFooter><Button disabled={pending} type="submit">{t("actions.save")}</Button><Button onClick={onClose} type="button" variant="outline">{t("alertsManagement.cancel")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolveAlertDialog({
  alert,
  branchSlug,
  onClose,
  patientId,
  tenantSlug,
}: {
  alert: PatientAlert;
  branchSlug: string;
  onClose: () => void;
  patientId: string;
  tenantSlug: string;
}) {
  const { t } = useTranslation("patients");
  const [reasonCode, setReasonCode] = useState<ResolvePatientAlertReasonCode>("NO_LONGER_APPLICABLE");
  const [error, setError] = useState<string | null>(null);
  const mutation = useResolvePatientAlertMutation();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({ tenantSlug, branchSlug, patientId, alertId: alert.id, reasonCode, idempotencyKey: crypto.randomUUID() });
      onClose();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader><DialogTitle>{t("alertsManagement.resolveTitle")}</DialogTitle><DialogDescription>{t("alertsManagement.resolveDescription")}</DialogDescription></DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="space-y-2"><Label htmlFor="resolve-reason">{t("alertsManagement.reason")}</Label><select className="h-10 w-full rounded-lg border bg-background px-3" id="resolve-reason" onChange={(event) => setReasonCode(event.target.value as ResolvePatientAlertReasonCode)} value={reasonCode}>{["NO_LONGER_APPLICABLE", "ENTERED_IN_ERROR", "DUPLICATE"].map((value) => <option key={value} value={value}>{t(`alertsManagement.reasons.${value}`)}</option>)}</select></div>
          <DialogFooter><Button disabled={mutation.isPending} type="submit">{t("alertsManagement.resolve")}</Button><Button onClick={onClose} type="button" variant="outline">{t("alertsManagement.cancel")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
