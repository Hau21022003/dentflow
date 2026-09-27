import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  CreateVisitAddendumInput,
  UpdateVisitInput,
  Visit,
} from "./visits.types";

export type VisitScope = { tenantSlug: string; branchSlug: string };

type VisitCommand<TInput = undefined> = VisitScope &
  IdempotentCommand & {
    appointmentId: string;
  } & (TInput extends undefined ? object : { input: TInput });

function appointmentsRoute({ tenantSlug, branchSlug }: VisitScope): string {
  return `/tenants/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/appointments`;
}

function appointmentRoute(scope: VisitScope, appointmentId: string): string {
  return `${appointmentsRoute(scope)}/${encodeURIComponent(appointmentId)}`;
}

function visitRoute(scope: VisitScope, appointmentId: string): string {
  return `${appointmentRoute(scope, appointmentId)}/visit`;
}

export const visitsService = {
  async start({
    tenantSlug,
    branchSlug,
    appointmentId,
    idempotencyKey,
  }: VisitCommand): Promise<Visit> {
    const { payload } = await http.post<Visit>(
      `${appointmentRoute({ tenantSlug, branchSlug }, appointmentId)}/start`,
      {},
      { idempotencyKey },
    );
    return payload;
  },

  async get(scope: VisitScope, appointmentId: string): Promise<Visit> {
    const { payload } = await http.get<Visit>(visitRoute(scope, appointmentId));
    return payload;
  },

  async update({
    tenantSlug,
    branchSlug,
    appointmentId,
    input,
    idempotencyKey,
  }: VisitCommand<UpdateVisitInput>): Promise<Visit> {
    const { payload } = await http.patch<Visit>(
      visitRoute({ tenantSlug, branchSlug }, appointmentId),
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async complete({
    tenantSlug,
    branchSlug,
    appointmentId,
    idempotencyKey,
  }: VisitCommand): Promise<Visit> {
    const { payload } = await http.post<Visit>(
      `${visitRoute({ tenantSlug, branchSlug }, appointmentId)}/complete`,
      {},
      { idempotencyKey },
    );
    return payload;
  },

  async addendum({
    tenantSlug,
    branchSlug,
    appointmentId,
    input,
    idempotencyKey,
  }: VisitCommand<CreateVisitAddendumInput>): Promise<Visit> {
    const { payload } = await http.post<Visit>(
      `${visitRoute({ tenantSlug, branchSlug }, appointmentId)}/addenda`,
      input,
      { idempotencyKey },
    );
    return payload;
  },
};
