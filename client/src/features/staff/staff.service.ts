import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import { SHARED_ENDPOINTS } from "@/shared/constants/endpoint.constants";
import type {
  AcceptStaffInvitationInput,
  AcceptStaffInvitationResponse,
  BranchStaffRolesInput,
  CreateBranchStaffInvitationInput,
  CreateStaffInvitationInput,
  GrantStaffRolesInput,
  StaffAssignment,
  StaffListQuery,
  StaffPage,
  StaffReasonInput,
} from "./staff.types";

type TenantStaffCommand<TInput = undefined> = IdempotentCommand & {
  tenantSlug: string;
  input: TInput;
};

function staffRoute(tenantSlug: string): string {
  return `/tenants/${encodeURIComponent(tenantSlug)}/staff`;
}

function branchStaffRoute(tenantSlug: string, branchSlug: string): string {
  return `/tenants/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/staff`;
}

export const staffService = {
  async list(tenantSlug: string, query: StaffListQuery): Promise<StaffPage> {
    const { payload } = await http.get<StaffPage>(staffRoute(tenantSlug), {
      params: query,
    });
    return payload;
  },

  async listBranch(
    tenantSlug: string,
    branchSlug: string,
    query: StaffListQuery,
  ): Promise<StaffPage> {
    const { payload } = await http.get<StaffPage>(
      branchStaffRoute(tenantSlug, branchSlug),
      { params: query },
    );
    return payload;
  },

  async createInvitation({
    tenantSlug,
    input,
    idempotencyKey,
  }: TenantStaffCommand<CreateStaffInvitationInput>) {
    const { payload } = await http.post(
      `${staffRoute(tenantSlug)}/invitations`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async resendInvitation({
    tenantSlug,
    invitationId,
    idempotencyKey,
  }: IdempotentCommand & { tenantSlug: string; invitationId: string }) {
    const { payload } = await http.post(
      `${staffRoute(tenantSlug)}/invitations/${encodeURIComponent(invitationId)}/resend`,
      {},
      { idempotencyKey },
    );
    return payload;
  },

  async revokeInvitation({
    tenantSlug,
    invitationId,
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    invitationId: string;
    input: StaffReasonInput;
  }) {
    const { payload } = await http.post(
      `${staffRoute(tenantSlug)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async disable({
    tenantSlug,
    userId,
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    userId: string;
    input: StaffReasonInput;
  }) {
    const { payload } = await http.post(
      `${staffRoute(tenantSlug)}/${encodeURIComponent(userId)}/disable`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async enable({
    tenantSlug,
    userId,
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    userId: string;
    input: StaffReasonInput;
  }) {
    const { payload } = await http.post(
      `${staffRoute(tenantSlug)}/${encodeURIComponent(userId)}/enable`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async grantRoles({
    tenantSlug,
    userId,
    input,
    idempotencyKey,
  }: TenantStaffCommand<GrantStaffRolesInput> & { userId: string }) {
    const { payload } = await http.post<StaffAssignment[]>(
      `${staffRoute(tenantSlug)}/${encodeURIComponent(userId)}/role-assignments`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async revokeRole({
    tenantSlug,
    userId,
    assignmentId,
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    userId: string;
    assignmentId: string;
    input: StaffReasonInput;
  }) {
    const { payload } = await http.delete<StaffAssignment>(
      `${staffRoute(tenantSlug)}/${encodeURIComponent(userId)}/role-assignments/${encodeURIComponent(assignmentId)}`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async acceptInvitation(
    input: AcceptStaffInvitationInput,
  ): Promise<AcceptStaffInvitationResponse> {
    const { payload } = await http.post<AcceptStaffInvitationResponse>(
      SHARED_ENDPOINTS.AUTH.STAFF_INVITATIONS_ACCEPT,
      input,
      { authRequired: false },
    );
    return payload;
  },

  async createBranchInvitation({
    tenantSlug,
    branchSlug,
    input,
    idempotencyKey,
  }: TenantStaffCommand<CreateBranchStaffInvitationInput> & {
    branchSlug: string;
  }) {
    const { payload } = await http.post(
      `${branchStaffRoute(tenantSlug, branchSlug)}/invitations`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async resendBranchInvitation({
    tenantSlug,
    branchSlug,
    invitationId,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    branchSlug: string;
    invitationId: string;
  }) {
    const { payload } = await http.post(
      `${branchStaffRoute(tenantSlug, branchSlug)}/invitations/${encodeURIComponent(invitationId)}/resend`,
      {},
      { idempotencyKey },
    );
    return payload;
  },

  async revokeBranchInvitation({
    tenantSlug,
    branchSlug,
    invitationId,
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    branchSlug: string;
    invitationId: string;
    input: StaffReasonInput;
  }) {
    const { payload } = await http.post(
      `${branchStaffRoute(tenantSlug, branchSlug)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async grantBranchRoles({
    tenantSlug,
    branchSlug,
    userId,
    input,
    idempotencyKey,
  }: TenantStaffCommand<BranchStaffRolesInput> & {
    branchSlug: string;
    userId: string;
  }) {
    const { payload } = await http.post<StaffAssignment[]>(
      `${branchStaffRoute(tenantSlug, branchSlug)}/${encodeURIComponent(userId)}/role-assignments`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async revokeBranchRole({
    tenantSlug,
    branchSlug,
    userId,
    assignmentId,
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    branchSlug: string;
    userId: string;
    assignmentId: string;
    input: StaffReasonInput;
  }) {
    const { payload } = await http.delete<StaffAssignment>(
      `${branchStaffRoute(tenantSlug, branchSlug)}/${encodeURIComponent(userId)}/role-assignments/${encodeURIComponent(assignmentId)}`,
      input,
      { idempotencyKey },
    );
    return payload;
  },

  async removeFromBranch({
    tenantSlug,
    branchSlug,
    userId,
    input,
    idempotencyKey,
  }: IdempotentCommand & {
    tenantSlug: string;
    branchSlug: string;
    userId: string;
    input: StaffReasonInput;
  }) {
    const { payload } = await http.post<StaffAssignment[]>(
      `${branchStaffRoute(tenantSlug, branchSlug)}/${encodeURIComponent(userId)}/remove`,
      input,
      { idempotencyKey },
    );
    return payload;
  },
};
