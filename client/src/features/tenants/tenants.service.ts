import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  CreatePlatformTenantInput,
  ExtendTenantTrialInput,
  PlatformTenantDetail,
  PlatformTenantListQuery,
  PlatformTenantPage,
  TenantReasonInput,
  UpdatePlatformTenantInput,
} from "./tenants.types";

export type TenantCommand<TInput = undefined> = IdempotentCommand & {
  tenantId: string;
  input: TInput;
};

export const tenantsService = {
  async list(query: PlatformTenantListQuery): Promise<PlatformTenantPage> {
    const { payload } = await http.get<PlatformTenantPage>(
      "/platform/tenants",
      { params: query },
    );
    return payload;
  },

  async get(tenantId: string): Promise<PlatformTenantDetail> {
    const { payload } = await http.get<PlatformTenantDetail>(
      `/platform/tenants/${encodeURIComponent(tenantId)}`,
    );
    return payload;
  },

  async create({
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    input: CreatePlatformTenantInput;
  }): Promise<PlatformTenantDetail> {
    const { payload } = await http.post<PlatformTenantDetail>(
      "/platform/tenants",
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async update({
    tenantId,
    input,
    idempotencyKey,
  }: TenantCommand<UpdatePlatformTenantInput>): Promise<PlatformTenantDetail> {
    const { payload } = await http.patch<PlatformTenantDetail>(
      `/platform/tenants/${encodeURIComponent(tenantId)}`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async resendOwnerInvite({
    tenantId,
    idempotencyKey,
  }: IdempotentCommand & { tenantId: string }): Promise<PlatformTenantDetail> {
    const { payload } = await http.post<PlatformTenantDetail>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/resend-owner-invite`,
      {},
      { idempotencyKey },
    );
    return payload;
  },

  async extendTrial(
    command: TenantCommand<ExtendTenantTrialInput>,
  ): Promise<PlatformTenantDetail> {
    const { tenantId, input, idempotencyKey } = command;
    const { payload } = await http.post<PlatformTenantDetail>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/extend-trial`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async suspend(
    command: TenantCommand<TenantReasonInput>,
  ): Promise<PlatformTenantDetail> {
    const { tenantId, input, idempotencyKey } = command;
    const { payload } = await http.post<PlatformTenantDetail>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/suspend`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async reactivate(
    command: TenantCommand<TenantReasonInput>,
  ): Promise<PlatformTenantDetail> {
    const { tenantId, input, idempotencyKey } = command;
    const { payload } = await http.post<PlatformTenantDetail>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/reactivate`,
      input,
      { idempotencyKey },
    );
    return payload;
  },
};
