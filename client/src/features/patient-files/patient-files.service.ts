import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  CreatePatientFileInput,
  PatientFile,
  PatientFileAccess,
  PatientFileListQuery,
  PatientFilePage,
  UpdatePatientFileInput,
} from "./patient-files.types";

export type PatientFileScope = {
  tenantSlug: string;
  branchSlug: string;
  appointmentId: string;
};

function filesRoute(scope: PatientFileScope) {
  return `/tenants/${encodeURIComponent(scope.tenantSlug)}/branches/${encodeURIComponent(scope.branchSlug)}/appointments/${encodeURIComponent(scope.appointmentId)}/visit/files`;
}

export const patientFilesService = {
  async list(
    scope: PatientFileScope,
    query: PatientFileListQuery,
  ): Promise<PatientFilePage> {
    const { payload } = await http.get<PatientFilePage>(filesRoute(scope), {
      params: { ...query },
    });
    return payload;
  },

  async create(
    command: PatientFileScope &
      IdempotentCommand & { input: CreatePatientFileInput },
  ): Promise<PatientFile> {
    const { input, idempotencyKey, ...scope } = command;
    const { payload } = await http.post<PatientFile>(filesRoute(scope), input, {
      idempotencyKey,
    });
    return payload;
  },

  async update(
    command: PatientFileScope &
      IdempotentCommand & { fileId: string; input: UpdatePatientFileInput },
  ): Promise<PatientFile> {
    const { fileId, input, idempotencyKey, ...scope } = command;
    const { payload } = await http.patch<PatientFile>(
      `${filesRoute(scope)}/${encodeURIComponent(fileId)}`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async archive(
    command: PatientFileScope & IdempotentCommand & { fileId: string },
  ): Promise<{ id: string; archived: true }> {
    const { fileId, idempotencyKey, ...scope } = command;
    const { payload } = await http.post<{ id: string; archived: true }>(
      `${filesRoute(scope)}/${encodeURIComponent(fileId)}/archive`,
      {},
      { idempotencyKey },
    );
    return payload;
  },

  async access(
    scope: PatientFileScope,
    fileId: string,
    disposition: "inline" | "attachment",
  ): Promise<PatientFileAccess> {
    const { payload } = await http.get<PatientFileAccess>(
      `${filesRoute(scope)}/${encodeURIComponent(fileId)}/access`,
      { params: { disposition } },
    );
    return payload;
  },
};
