import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { patientsService } from "./patients.service";
import type {
  PatientAppointmentListQuery,
  PatientListQuery,
  PatientTreatmentPlanListQuery,
  PatientVisitListQuery,
  UpdatePatientInput,
} from "./patients.types";

export const patientQueryKeys = {
  all: ["patients"] as const,
  branch: (tenantSlug: string, branchSlug: string) =>
    [...patientQueryKeys.all, "branch", tenantSlug, branchSlug] as const,
  list: (tenantSlug: string, branchSlug: string, query: PatientListQuery) =>
    [...patientQueryKeys.branch(tenantSlug, branchSlug), "list", query] as const,
  assignedList: (tenantSlug: string, branchSlug: string, query: PatientListQuery) =>
    [...patientQueryKeys.branch(tenantSlug, branchSlug), "assigned-list", query] as const,
  detail: (tenantSlug: string, branchSlug: string, patientId: string) =>
    [...patientQueryKeys.branch(tenantSlug, branchSlug), "detail", patientId] as const,
  overview: (tenantSlug: string, branchSlug: string, patientId: string) =>
    [...patientQueryKeys.detail(tenantSlug, branchSlug, patientId), "overview"] as const,
  treatmentPlan: (
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
    planId: string,
  ) =>
    [
      ...patientQueryKeys.detail(tenantSlug, branchSlug, patientId),
      "treatment-plan",
      planId,
    ] as const,
  treatmentPlans: (
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
    query: PatientTreatmentPlanListQuery,
  ) =>
    [
      ...patientQueryKeys.detail(tenantSlug, branchSlug, patientId),
      "treatment-plans",
      query,
    ] as const,
  appointments: (
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
    query: PatientAppointmentListQuery,
  ) =>
    [
      ...patientQueryKeys.detail(tenantSlug, branchSlug, patientId),
      "appointments",
      query,
    ] as const,
  visits: (
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
    query: PatientVisitListQuery,
  ) =>
    [
      ...patientQueryKeys.detail(tenantSlug, branchSlug, patientId),
      "visits",
      query,
    ] as const,
  alerts: (tenantSlug: string, branchSlug: string, patientId: string) =>
    [...patientQueryKeys.detail(tenantSlug, branchSlug, patientId), "alerts"] as const,
};

export function usePatientOverviewQuery(
  tenantSlug: string,
  branchSlug: string,
  patientId: string,
) {
  return useQuery({
    queryKey: patientQueryKeys.overview(tenantSlug, branchSlug, patientId),
    queryFn: () => patientsService.overview(tenantSlug, branchSlug, patientId),
    enabled: Boolean(tenantSlug && branchSlug && patientId),
  });
}

export function usePatientTreatmentPlanQuery(
  tenantSlug: string,
  branchSlug: string,
  patientId: string,
  planId: string | null,
) {
  return useQuery({
    queryKey: patientQueryKeys.treatmentPlan(
      tenantSlug,
      branchSlug,
      patientId,
      planId ?? "",
    ),
    queryFn: () =>
      patientsService.treatmentPlan(
        tenantSlug,
        branchSlug,
        patientId,
        planId!,
      ),
    enabled: Boolean(tenantSlug && branchSlug && patientId && planId),
  });
}

export function usePatientTreatmentPlansQuery(
  tenantSlug: string,
  branchSlug: string,
  patientId: string,
  query: PatientTreatmentPlanListQuery,
) {
  return useQuery({
    queryKey: patientQueryKeys.treatmentPlans(
      tenantSlug,
      branchSlug,
      patientId,
      query,
    ),
    queryFn: () =>
      patientsService.listTreatmentPlans(
        tenantSlug,
        branchSlug,
        patientId,
        query,
      ),
    enabled: Boolean(tenantSlug && branchSlug && patientId),
    placeholderData: keepPreviousData,
  });
}

export function usePatientAppointmentsQuery(
  tenantSlug: string,
  branchSlug: string,
  patientId: string,
  query: PatientAppointmentListQuery,
) {
  return useQuery({
    queryKey: patientQueryKeys.appointments(
      tenantSlug,
      branchSlug,
      patientId,
      query,
    ),
    queryFn: () =>
      patientsService.listAppointments(
        tenantSlug,
        branchSlug,
        patientId,
        query,
      ),
    enabled: Boolean(tenantSlug && branchSlug && patientId),
    placeholderData: keepPreviousData,
  });
}

export function usePatientVisitsQuery(
  tenantSlug: string,
  branchSlug: string,
  patientId: string,
  query: PatientVisitListQuery,
) {
  return useQuery({
    queryKey: patientQueryKeys.visits(tenantSlug, branchSlug, patientId, query),
    queryFn: () =>
      patientsService.listVisits(tenantSlug, branchSlug, patientId, query),
    enabled: Boolean(tenantSlug && branchSlug && patientId),
    placeholderData: keepPreviousData,
  });
}

export function usePatientAlertsQuery(
  tenantSlug: string,
  branchSlug: string,
  patientId: string,
) {
  return useQuery({
    queryKey: patientQueryKeys.alerts(tenantSlug, branchSlug, patientId),
    queryFn: () => patientsService.listAlerts(tenantSlug, branchSlug, patientId),
    enabled: Boolean(tenantSlug && branchSlug && patientId),
  });
}

function usePatientAlertMutation<
  TVariables extends { tenantSlug: string; branchSlug: string; patientId: string },
>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (_result, command) => {
      await queryClient.invalidateQueries({
        queryKey: patientQueryKeys.detail(
          command.tenantSlug,
          command.branchSlug,
          command.patientId,
        ),
      });
    },
  });
}

export const useCreatePatientAlertMutation = () =>
  usePatientAlertMutation(patientsService.createAlert);
export const useUpdatePatientAlertMutation = () =>
  usePatientAlertMutation(patientsService.updateAlert);
export const useResolvePatientAlertMutation = () =>
  usePatientAlertMutation(patientsService.resolveAlert);

export function useBranchPatientsQuery(
  tenantSlug: string,
  branchSlug: string,
  query: PatientListQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: patientQueryKeys.list(tenantSlug, branchSlug, query),
    queryFn: () => patientsService.list(tenantSlug, branchSlug, query),
    enabled: enabled && Boolean(tenantSlug && branchSlug),
    placeholderData: keepPreviousData,
  });
}

export function useAssignedBranchPatientsQuery(
  tenantSlug: string,
  branchSlug: string,
  query: PatientListQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: patientQueryKeys.assignedList(tenantSlug, branchSlug, query),
    queryFn: () => patientsService.listAssigned(tenantSlug, branchSlug, query),
    enabled: enabled && Boolean(tenantSlug && branchSlug),
    placeholderData: keepPreviousData,
  });
}

function usePatientMutation<
  TVariables extends { tenantSlug: string; branchSlug: string },
  TResult,
>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSuccess: async (_result, command) => {
      await queryClient.invalidateQueries({
        queryKey: patientQueryKeys.branch(command.tenantSlug, command.branchSlug),
      });
    },
  });
}

export function useCreatePatientMutation() {
  return usePatientMutation(patientsService.create);
}

export function useUpdatePatientMutation() {
  return usePatientMutation<
    {
      tenantSlug: string;
      branchSlug: string;
      patientId: string;
      input: UpdatePatientInput;
      idempotencyKey: string;
    },
    Awaited<ReturnType<typeof patientsService.update>>
  >(patientsService.update);
}
