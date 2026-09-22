import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appointmentQueryKeys } from "@/features/appointments/appointments.hooks";
import { visitsService, type VisitScope } from "./visits.service";
import type {
  CreateVisitAddendumInput,
  UpdateVisitInput,
  Visit,
} from "./visits.types";

type VisitCommandScope = VisitScope & { appointmentId: string };

export const visitQueryKeys = {
  all: ["visits"] as const,
  branch: (tenantSlug: string, branchSlug: string) =>
    [...visitQueryKeys.all, "branch", tenantSlug, branchSlug] as const,
  detail: (tenantSlug: string, branchSlug: string, appointmentId: string) =>
    [
      ...visitQueryKeys.branch(tenantSlug, branchSlug),
      "detail",
      appointmentId,
    ] as const,
};

export function useVisitQuery(
  tenantSlug: string,
  branchSlug: string,
  appointmentId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: visitQueryKeys.detail(
      tenantSlug,
      branchSlug,
      appointmentId ?? "",
    ),
    queryFn: () => visitsService.get({ tenantSlug, branchSlug }, appointmentId!),
    enabled: Boolean(tenantSlug && branchSlug && appointmentId && enabled),
  });
}

function useVisitMutation<TVariables extends VisitCommandScope>(
  mutationFn: (variables: TVariables) => Promise<Visit>,
) {
  const queryClient = useQueryClient();

  return useMutation<Visit, Error, TVariables>({
    mutationFn,
    onSuccess: async (visit, command) => {
      queryClient.setQueryData(
        visitQueryKeys.detail(
          command.tenantSlug,
          command.branchSlug,
          command.appointmentId,
        ),
        visit,
      );
      await queryClient.invalidateQueries({
        queryKey: appointmentQueryKeys.branch(
          command.tenantSlug,
          command.branchSlug,
        ),
      });
    },
  });
}

export const useStartVisitMutation = () => useVisitMutation(visitsService.start);
export const useUpdateVisitMutation = () =>
  useVisitMutation<
    VisitCommandScope & {
      input: UpdateVisitInput;
      idempotencyKey: string;
    }
  >(visitsService.update);
export const useCompleteVisitMutation = () =>
  useVisitMutation(visitsService.complete);
export const useCreateVisitAddendumMutation = () =>
  useVisitMutation<
    VisitCommandScope & {
      input: CreateVisitAddendumInput;
      idempotencyKey: string;
    }
  >(visitsService.addendum);
