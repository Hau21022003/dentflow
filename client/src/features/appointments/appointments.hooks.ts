import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appointmentsService } from "./appointments.service";
import type {
  AppointmentAgendaQuery,
  AppointmentCalendarSummary,
  AppointmentListQuery,
  BookingOptionQuery,
} from "./appointments.types";

const AGENDA_PAGE_SIZE = 100;

export const appointmentQueryKeys = {
  all: ["appointments"] as const,
  branch: (tenantSlug: string, branchSlug: string) =>
    [...appointmentQueryKeys.all, "branch", tenantSlug, branchSlug] as const,
  agenda: (tenantSlug: string, branchSlug: string, query: AppointmentAgendaQuery) =>
    [...appointmentQueryKeys.branch(tenantSlug, branchSlug), "agenda", query] as const,
  list: (tenantSlug: string, branchSlug: string, query: AppointmentListQuery) =>
    [...appointmentQueryKeys.branch(tenantSlug, branchSlug), "list", query] as const,
  assignedAgenda: (tenantSlug: string, branchSlug: string, query: AppointmentAgendaQuery) =>
    [...appointmentQueryKeys.branch(tenantSlug, branchSlug), "assigned-agenda", query] as const,
  calendarSummary: (tenantSlug: string, branchSlug: string, month: string) =>
    [...appointmentQueryKeys.branch(tenantSlug, branchSlug), "calendar-summary", month] as const,
  detail: (tenantSlug: string, branchSlug: string, appointmentId: string) =>
    [...appointmentQueryKeys.branch(tenantSlug, branchSlug), "detail", appointmentId] as const,
  dentists: (tenantSlug: string, branchSlug: string, query: BookingOptionQuery) =>
    [...appointmentQueryKeys.branch(tenantSlug, branchSlug), "dentists", query] as const,
  services: (tenantSlug: string, branchSlug: string, query: BookingOptionQuery) =>
    [...appointmentQueryKeys.branch(tenantSlug, branchSlug), "services", query] as const,
};

async function loadAllPages<T>(
  loadPage: (query: AppointmentListQuery) => Promise<{
    items: T[];
    meta: { total: number; totalPages: number };
  }>,
  query: AppointmentAgendaQuery,
): Promise<T[]> {
  const first = await loadPage({ ...query, page: 1, limit: AGENDA_PAGE_SIZE });
  const items = [...first.items];

  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    const next = await loadPage({ ...query, page, limit: AGENDA_PAGE_SIZE });
    items.push(...next.items);
  }

  return items;
}

export function useAppointmentsAgendaQuery(
  tenantSlug: string,
  branchSlug: string,
  query: AppointmentAgendaQuery,
) {
  return useQuery({
    queryKey: appointmentQueryKeys.agenda(tenantSlug, branchSlug, query),
    queryFn: () =>
      loadAllPages(
        (pageQuery) => appointmentsService.list({ tenantSlug, branchSlug }, pageQuery),
        query,
      ),
    enabled: Boolean(tenantSlug && branchSlug && query.from && query.to),
  });
}

export function useAppointmentsListQuery(
  tenantSlug: string,
  branchSlug: string,
  query: AppointmentListQuery,
) {
  return useQuery({
    queryKey: appointmentQueryKeys.list(tenantSlug, branchSlug, query),
    queryFn: () => appointmentsService.list({ tenantSlug, branchSlug }, query),
    enabled: Boolean(tenantSlug && branchSlug && query.from && query.to),
  });
}

export function useAssignedAppointmentsAgendaQuery(
  tenantSlug: string,
  branchSlug: string,
  query: AppointmentAgendaQuery,
) {
  return useQuery({
    queryKey: appointmentQueryKeys.assignedAgenda(tenantSlug, branchSlug, query),
    queryFn: () =>
      loadAllPages(
        (pageQuery) => appointmentsService.listAssigned({ tenantSlug, branchSlug }, pageQuery),
        query,
      ),
    enabled: Boolean(tenantSlug && branchSlug && query.from && query.to),
  });
}

export function useAppointmentCalendarSummaryQuery(
  tenantSlug: string,
  branchSlug: string,
  month: string,
) {
  return useQuery<AppointmentCalendarSummary>({
    queryKey: appointmentQueryKeys.calendarSummary(tenantSlug, branchSlug, month),
    queryFn: () =>
      appointmentsService.calendarSummary({ tenantSlug, branchSlug }, month),
    enabled: Boolean(tenantSlug && branchSlug && month),
  });
}

export function useAppointmentDetailQuery(
  tenantSlug: string,
  branchSlug: string,
  appointmentId: string | null,
) {
  return useQuery({
    queryKey: appointmentQueryKeys.detail(tenantSlug, branchSlug, appointmentId ?? ""),
    queryFn: () => appointmentsService.get({ tenantSlug, branchSlug }, appointmentId!),
    enabled: Boolean(tenantSlug && branchSlug && appointmentId),
  });
}

export function useAppointmentDentistsQuery(
  tenantSlug: string,
  branchSlug: string,
  query: BookingOptionQuery,
) {
  return useQuery({
    queryKey: appointmentQueryKeys.dentists(tenantSlug, branchSlug, query),
    queryFn: () => appointmentsService.listDentists({ tenantSlug, branchSlug }, query),
    enabled: Boolean(tenantSlug && branchSlug),
  });
}

export function useAppointmentServicesQuery(
  tenantSlug: string,
  branchSlug: string,
  query: BookingOptionQuery,
) {
  return useQuery({
    queryKey: appointmentQueryKeys.services(tenantSlug, branchSlug, query),
    queryFn: () => appointmentsService.listServices({ tenantSlug, branchSlug }, query),
    enabled: Boolean(tenantSlug && branchSlug),
  });
}

function useAppointmentMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSuccess: async (_result, command) => {
      const scoped = command as { tenantSlug?: string; branchSlug?: string };
      if (scoped.tenantSlug && scoped.branchSlug) {
        await queryClient.invalidateQueries({
          queryKey: appointmentQueryKeys.branch(scoped.tenantSlug, scoped.branchSlug),
        });
      }
    },
  });
}

export const useCreateAppointmentMutation = () => useAppointmentMutation(appointmentsService.create);
export const useUpdateAppointmentMutation = () => useAppointmentMutation(appointmentsService.update);
export const useConfirmAppointmentMutation = () => useAppointmentMutation(appointmentsService.confirm);
export const useCheckInAppointmentMutation = () => useAppointmentMutation(appointmentsService.checkIn);
export const useAssignAppointmentMutation = () => useAppointmentMutation(appointmentsService.assign);
export const useCancelAppointmentMutation = () => useAppointmentMutation(appointmentsService.cancel);
export const useNoShowAppointmentMutation = () => useAppointmentMutation(appointmentsService.noShow);
