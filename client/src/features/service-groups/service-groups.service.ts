import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  CreateServiceGroupInput,
  ServiceGroup,
  ServiceGroupListQuery,
  ServiceGroupPage,
  ServiceGroupReasonInput,
  UpdateServiceGroupInput,
} from "./service-groups.types";

type TenantServiceGroupCommand<TInput> = IdempotentCommand & {
  tenantSlug: string;
  serviceGroupId: string;
  input: TInput;
};

function serviceGroupsRoute(tenantSlug: string): string {
  return `/tenants/${encodeURIComponent(tenantSlug)}/service-groups`;
}

function serviceGroupRoute(tenantSlug: string, serviceGroupId: string): string {
  return `${serviceGroupsRoute(tenantSlug)}/${encodeURIComponent(serviceGroupId)}`;
}

export const serviceGroupsService = {
  async list(
    tenantSlug: string,
    query: ServiceGroupListQuery,
  ): Promise<ServiceGroupPage> {
    const { payload } = await http.get<ServiceGroupPage>(
      serviceGroupsRoute(tenantSlug),
      {
        params: query,
      },
    );
    return payload;
  },

  async create({
    tenantSlug,
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    input: CreateServiceGroupInput;
  }): Promise<ServiceGroup> {
    const { payload } = await http.post<ServiceGroup>(
      serviceGroupsRoute(tenantSlug),
      input,
      {
        idempotencyKey,
      },
    );
    return payload;
  },

  async update({
    tenantSlug,
    serviceGroupId,
    input,
    idempotencyKey,
  }: TenantServiceGroupCommand<UpdateServiceGroupInput>): Promise<ServiceGroup> {
    const { payload } = await http.patch<ServiceGroup>(
      serviceGroupRoute(tenantSlug, serviceGroupId),
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async deactivate({
    tenantSlug,
    serviceGroupId,
    input,
    idempotencyKey,
  }: TenantServiceGroupCommand<ServiceGroupReasonInput>): Promise<ServiceGroup> {
    const { payload } = await http.post<ServiceGroup>(
      `${serviceGroupRoute(tenantSlug, serviceGroupId)}/deactivate`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async activate({
    tenantSlug,
    serviceGroupId,
    input,
    idempotencyKey,
  }: TenantServiceGroupCommand<ServiceGroupReasonInput>): Promise<ServiceGroup> {
    const { payload } = await http.post<ServiceGroup>(
      `${serviceGroupRoute(tenantSlug, serviceGroupId)}/activate`,
      input,
      { idempotencyKey },
    );
    return payload;
  },
};
