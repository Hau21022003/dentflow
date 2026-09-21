import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  Appointment,
  AppointmentAgendaQuery,
  AppointmentCalendarSummary,
  AppointmentDetail,
  AppointmentDentistOption,
  AppointmentListQuery,
  AppointmentPage,
  AppointmentServiceOption,
  AssignedAppointment,
  BookingOptionQuery,
  CancellationReasonCode,
  CreateAppointmentInput,
  NoShowReasonCode,
  UpdateAppointmentInput,
} from "./appointments.types";

type AppointmentScope = { tenantSlug: string; branchSlug: string };
type AppointmentCommand<TInput> = AppointmentScope &
  IdempotentCommand & { appointmentId: string; input: TInput };

function appointmentsRoute({ tenantSlug, branchSlug }: AppointmentScope): string {
  return `/tenants/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/appointments`;
}

function appointmentRoute(scope: AppointmentScope, appointmentId: string): string {
  return `${appointmentsRoute(scope)}/${encodeURIComponent(appointmentId)}`;
}

export const appointmentsService = {
  async list(
    scope: AppointmentScope,
    query: AppointmentListQuery,
  ): Promise<AppointmentPage> {
    const { payload } = await http.get<AppointmentPage>(appointmentsRoute(scope), {
      params: query,
    });
    return payload;
  },

  async listAssigned(
    scope: AppointmentScope,
    query: AppointmentListQuery,
  ): Promise<AppointmentPage<AssignedAppointment>> {
    const { payload } = await http.get<AppointmentPage<AssignedAppointment>>(
      `${appointmentsRoute(scope)}/assigned`,
      { params: query },
    );
    return payload;
  },

  async calendarSummary(
    scope: AppointmentScope,
    month: string,
  ): Promise<AppointmentCalendarSummary> {
    const { payload } = await http.get<AppointmentCalendarSummary>(
      `${appointmentsRoute(scope)}/calendar-summary`,
      { params: { month } },
    );
    return payload;
  },

  async get(scope: AppointmentScope, appointmentId: string): Promise<AppointmentDetail> {
    const { payload } = await http.get<AppointmentDetail>(appointmentRoute(scope, appointmentId));
    return payload;
  },

  async listDentists(
    scope: AppointmentScope,
    query: BookingOptionQuery,
  ): Promise<AppointmentPage<AppointmentDentistOption>> {
    const { payload } = await http.get<AppointmentPage<AppointmentDentistOption>>(
      `${appointmentsRoute(scope)}/booking-options/dentists`,
      { params: query },
    );
    return payload;
  },

  async listServices(
    scope: AppointmentScope,
    query: BookingOptionQuery,
  ): Promise<AppointmentPage<AppointmentServiceOption>> {
    const { payload } = await http.get<AppointmentPage<AppointmentServiceOption>>(
      `${appointmentsRoute(scope)}/booking-options/services`,
      { params: query },
    );
    return payload;
  },

  async create({
    tenantSlug,
    branchSlug,
    input,
    idempotencyKey,
  }: AppointmentScope & IdempotentCommand & { input: CreateAppointmentInput }): Promise<Appointment> {
    const { payload } = await http.post<Appointment>(
      appointmentsRoute({ tenantSlug, branchSlug }),
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async update({
    tenantSlug,
    branchSlug,
    appointmentId,
    input,
    idempotencyKey,
  }: AppointmentCommand<UpdateAppointmentInput>): Promise<Appointment> {
    const { payload } = await http.patch<Appointment>(
      appointmentRoute({ tenantSlug, branchSlug }, appointmentId),
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async confirm({
    tenantSlug,
    branchSlug,
    appointmentId,
    idempotencyKey,
  }: AppointmentScope & IdempotentCommand & { appointmentId: string }): Promise<Appointment> {
    const { payload } = await http.post<Appointment>(
      `${appointmentRoute({ tenantSlug, branchSlug }, appointmentId)}/confirm`,
      {},
      { idempotencyKey },
    );
    return payload;
  },

  async checkIn({
    tenantSlug,
    branchSlug,
    appointmentId,
    idempotencyKey,
  }: AppointmentScope & IdempotentCommand & { appointmentId: string }): Promise<Appointment> {
    const { payload } = await http.post<Appointment>(
      `${appointmentRoute({ tenantSlug, branchSlug }, appointmentId)}/check-in`,
      {},
      { idempotencyKey },
    );
    return payload;
  },

  async assign({
    tenantSlug,
    branchSlug,
    appointmentId,
    input,
    idempotencyKey,
  }: AppointmentCommand<{ assignedDentistUserId: string | null }>): Promise<Appointment> {
    const { payload } = await http.post<Appointment>(
      `${appointmentRoute({ tenantSlug, branchSlug }, appointmentId)}/assign`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async cancel({
    tenantSlug,
    branchSlug,
    appointmentId,
    input,
    idempotencyKey,
  }: AppointmentCommand<{ reasonCode: CancellationReasonCode }>): Promise<Appointment> {
    const { payload } = await http.post<Appointment>(
      `${appointmentRoute({ tenantSlug, branchSlug }, appointmentId)}/cancel`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async noShow({
    tenantSlug,
    branchSlug,
    appointmentId,
    idempotencyKey,
    input,
  }: AppointmentCommand<{ reasonCode: NoShowReasonCode }>): Promise<Appointment> {
    const { payload } = await http.post<Appointment>(
      `${appointmentRoute({ tenantSlug, branchSlug }, appointmentId)}/no-show`,
      input,
      { idempotencyKey },
    );
    return payload;
  },
};

export type { AppointmentAgendaQuery };
