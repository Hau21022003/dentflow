import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { patientsService } from "./patients.service";
import type {
  PatientListQuery,
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
};

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
