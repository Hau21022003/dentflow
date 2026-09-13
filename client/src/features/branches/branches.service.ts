import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  Branch,
  BranchListQuery,
  BranchPage,
  BranchReasonInput,
  CreateBranchInput,
  UpdateBranchInput,
} from "./branches.types";

type TenantBranchCommand<TInput> = IdempotentCommand & {
  tenantSlug: string;
  branchSlug: string;
  input: TInput;
};

function branchesRoute(tenantSlug: string): string {
  return `/tenants/${encodeURIComponent(tenantSlug)}/branches`;
}

function branchRoute(tenantSlug: string, branchSlug: string): string {
  return `${branchesRoute(tenantSlug)}/${encodeURIComponent(branchSlug)}`;
}

export const branchesService = {
  async list(tenantSlug: string, query: BranchListQuery): Promise<BranchPage> {
    const { payload } = await http.get<BranchPage>(branchesRoute(tenantSlug), {
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
    input: CreateBranchInput;
  }): Promise<Branch> {
    const { payload } = await http.post<Branch>(branchesRoute(tenantSlug), input, {
      idempotencyKey,
    });
    return payload;
  },

  async update({
    tenantSlug,
    branchSlug,
    input,
    idempotencyKey,
  }: TenantBranchCommand<UpdateBranchInput>): Promise<Branch> {
    const { payload } = await http.patch<Branch>(
      branchRoute(tenantSlug, branchSlug),
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async deactivate({
    tenantSlug,
    branchSlug,
    input,
    idempotencyKey,
  }: TenantBranchCommand<BranchReasonInput>): Promise<Branch> {
    const { payload } = await http.post<Branch>(
      `${branchRoute(tenantSlug, branchSlug)}/deactivate`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async activate({
    tenantSlug,
    branchSlug,
    input,
    idempotencyKey,
  }: TenantBranchCommand<BranchReasonInput>): Promise<Branch> {
    const { payload } = await http.post<Branch>(
      `${branchRoute(tenantSlug, branchSlug)}/activate`,
      input,
      { idempotencyKey },
    );
    return payload;
  },
};
