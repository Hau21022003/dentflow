import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  AssignedPatientListItem,
  CreatePatientInput,
  Patient,
  PatientAppointmentListQuery,
  PatientAppointmentPage,
  PatientOverview,
  PatientAlert,
  PatientAlertInput,
  ResolvePatientAlertReasonCode,
  PatientTreatmentPlan,
  PatientTreatmentPlanListQuery,
  PatientTreatmentPlanPage,
  PatientListQuery,
  PatientPage,
  PatientVisitListQuery,
  PatientVisitPage,
  UpdatePatientInput,
} from "./patients.types";

type PatientCommand<TInput> = IdempotentCommand & {
  branchSlug: string;
  input: TInput;
  patientId?: string;
  tenantSlug: string;
};

function patientsRoute(tenantSlug: string, branchSlug: string): string {
  return `/tenants/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/patients`;
}

function patientRoute(
  tenantSlug: string,
  branchSlug: string,
  patientId: string,
): string {
  return `${patientsRoute(tenantSlug, branchSlug)}/${encodeURIComponent(patientId)}`;
}

export const patientsService = {
  async get(
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
  ): Promise<Patient> {
    const { payload } = await http.get<Patient>(
      patientRoute(tenantSlug, branchSlug, patientId),
    );
    return payload;
  },

  async overview(
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
  ): Promise<PatientOverview> {
    const { payload } = await http.get<PatientOverview>(
      `${patientRoute(tenantSlug, branchSlug, patientId)}/overview`,
    );
    return payload;
  },

  async treatmentPlan(
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
    planId: string,
  ): Promise<PatientTreatmentPlan> {
    const { payload } = await http.get<PatientTreatmentPlan>(
      `${patientRoute(tenantSlug, branchSlug, patientId)}/treatment-plans/${encodeURIComponent(planId)}`,
    );
    return payload;
  },

  async listTreatmentPlans(
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
    query: PatientTreatmentPlanListQuery,
  ): Promise<PatientTreatmentPlanPage> {
    const { payload } = await http.get<PatientTreatmentPlanPage>(
      `${patientRoute(tenantSlug, branchSlug, patientId)}/treatment-plans`,
      { params: query },
    );
    return payload;
  },

  async listAppointments(
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
    query: PatientAppointmentListQuery,
  ): Promise<PatientAppointmentPage> {
    const { payload } = await http.get<PatientAppointmentPage>(
      `${patientRoute(tenantSlug, branchSlug, patientId)}/appointments`,
      { params: query },
    );
    return payload;
  },

  async listVisits(
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
    query: PatientVisitListQuery,
  ): Promise<PatientVisitPage> {
    const { payload } = await http.get<PatientVisitPage>(
      `${patientRoute(tenantSlug, branchSlug, patientId)}/visits`,
      { params: query },
    );
    return payload;
  },

  async listAlerts(
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
  ): Promise<{ items: PatientAlert[] }> {
    const { payload } = await http.get<{ items: PatientAlert[] }>(
      `${patientRoute(tenantSlug, branchSlug, patientId)}/alerts`,
    );
    return payload;
  },

  async createAlert({
    tenantSlug,
    branchSlug,
    patientId,
    input,
    idempotencyKey,
  }: PatientCommand<PatientAlertInput> & { patientId: string }): Promise<PatientAlert> {
    const { payload } = await http.post<PatientAlert>(
      `${patientRoute(tenantSlug, branchSlug, patientId)}/alerts`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async updateAlert({
    tenantSlug,
    branchSlug,
    patientId,
    alertId,
    input,
    idempotencyKey,
  }: PatientCommand<PatientAlertInput> & {
    patientId: string;
    alertId: string;
  }): Promise<PatientAlert> {
    const { payload } = await http.patch<PatientAlert>(
      `${patientRoute(tenantSlug, branchSlug, patientId)}/alerts/${encodeURIComponent(alertId)}`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async resolveAlert({
    tenantSlug,
    branchSlug,
    patientId,
    alertId,
    reasonCode,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    branchSlug: string;
    patientId: string;
    alertId: string;
    reasonCode: ResolvePatientAlertReasonCode;
  }): Promise<PatientAlert> {
    const { payload } = await http.post<PatientAlert>(
      `${patientRoute(tenantSlug, branchSlug, patientId)}/alerts/${encodeURIComponent(alertId)}/resolve`,
      { reasonCode },
      { idempotencyKey },
    );
    return payload;
  },

  async list(
    tenantSlug: string,
    branchSlug: string,
    query: PatientListQuery,
  ): Promise<PatientPage> {
    const { payload } = await http.get<PatientPage>(
      patientsRoute(tenantSlug, branchSlug),
      { params: query },
    );
    return payload;
  },

  async listAssigned(
    tenantSlug: string,
    branchSlug: string,
    query: PatientListQuery,
  ): Promise<PatientPage<AssignedPatientListItem>> {
    const { payload } = await http.get<PatientPage<AssignedPatientListItem>>(
      `${patientsRoute(tenantSlug, branchSlug)}/assigned`,
      { params: query },
    );
    return payload;
  },

  async create({
    tenantSlug,
    branchSlug,
    input,
    idempotencyKey,
  }: PatientCommand<CreatePatientInput>): Promise<Patient> {
    const { payload } = await http.post<Patient>(
      patientsRoute(tenantSlug, branchSlug),
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async update({
    tenantSlug,
    branchSlug,
    patientId,
    input,
    idempotencyKey,
  }: PatientCommand<UpdatePatientInput> & { patientId: string }): Promise<Patient> {
    const { payload } = await http.patch<Patient>(
      patientRoute(tenantSlug, branchSlug, patientId),
      input,
      { idempotencyKey },
    );
    return payload;
  },
};
