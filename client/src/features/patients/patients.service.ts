import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  CreatePatientInput,
  Patient,
  PatientListQuery,
  PatientPage,
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
