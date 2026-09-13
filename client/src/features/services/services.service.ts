import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  CreateServiceInput,
  Service,
  ServiceListQuery,
  ServicePage,
  ServiceReasonInput,
  UpdateServiceInput,
} from "./services.types";

type TenantServiceCommand<TInput> = IdempotentCommand & {
  tenantSlug: string;
  serviceId: string;
  input: TInput;
};

function servicesRoute(tenantSlug: string): string {
  return `/tenants/${encodeURIComponent(tenantSlug)}/services`;
}

function serviceRoute(tenantSlug: string, serviceId: string): string {
  return `${servicesRoute(tenantSlug)}/${encodeURIComponent(serviceId)}`;
}

export const servicesService = {
  async list(tenantSlug: string, query: ServiceListQuery): Promise<ServicePage> {
    const { payload } = await http.get<ServicePage>(servicesRoute(tenantSlug), {
      params: query,
    });
    return payload;
  },

  async create({
    tenantSlug,
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    input: CreateServiceInput;
  }): Promise<Service> {
    const { payload } = await http.post<Service>(servicesRoute(tenantSlug), input, {
      idempotencyKey,
    });
    return payload;
  },

  async update({
    tenantSlug,
    serviceId,
    input,
    idempotencyKey,
  }: TenantServiceCommand<UpdateServiceInput>): Promise<Service> {
    const { payload } = await http.patch<Service>(
      serviceRoute(tenantSlug, serviceId),
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async deactivate({
    tenantSlug,
    serviceId,
    input,
    idempotencyKey,
  }: TenantServiceCommand<ServiceReasonInput>): Promise<Service> {
    const { payload } = await http.post<Service>(
      `${serviceRoute(tenantSlug, serviceId)}/deactivate`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async activate({
    tenantSlug,
    serviceId,
    input,
    idempotencyKey,
  }: TenantServiceCommand<ServiceReasonInput>): Promise<Service> {
    const { payload } = await http.post<Service>(
      `${serviceRoute(tenantSlug, serviceId)}/activate`,
      input,
      { idempotencyKey },
    );
    return payload;
  },
};
