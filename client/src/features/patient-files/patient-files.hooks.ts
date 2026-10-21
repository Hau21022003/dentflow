import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  patientFilesService,
  type PatientFileScope,
} from "./patient-files.service";
import type { PatientFileListQuery } from "./patient-files.types";

export const patientFileQueryKeys = {
  all: ["patient-files"] as const,
  lists: (scope: PatientFileScope) =>
    [
      ...patientFileQueryKeys.all,
      scope.tenantSlug,
      scope.branchSlug,
      scope.appointmentId,
    ] as const,
  list: (scope: PatientFileScope, query: PatientFileListQuery) =>
    [...patientFileQueryKeys.lists(scope), query] as const,
};

export function usePatientFilesQuery(
  scope: PatientFileScope,
  query: PatientFileListQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: patientFileQueryKeys.list(scope, query),
    queryFn: () => patientFilesService.list(scope, query),
    enabled: Boolean(
      enabled && scope.tenantSlug && scope.branchSlug && scope.appointmentId,
    ),
  });
}

function useFileMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (_result, command) => {
      await queryClient.invalidateQueries({
        queryKey: patientFileQueryKeys.lists(command as PatientFileScope),
      });
    },
  });
}

export const useCreatePatientFileMutation = () =>
  useFileMutation(patientFilesService.create);
export const useUpdatePatientFileMutation = () =>
  useFileMutation(patientFilesService.update);
export const useArchivePatientFileMutation = () =>
  useFileMutation(patientFilesService.archive);
