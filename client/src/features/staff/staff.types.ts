import type { TenantRoleCode } from "@/features/auth/auth.types";

export type StaffMembershipStatus = "ACTIVE" | "DISABLED";
export type StaffListStatus = StaffMembershipStatus | "INVITED";
export type StaffInvitationDeliveryStatus = "PENDING" | "SENT" | "FAILED";

export type StaffAssignment = {
  id: string;
  roleCode: TenantRoleCode;
  branchId: string | null;
  assignedAt: string;
};

export type StaffMembership = {
  id: string;
  userId: string;
  status: StaffMembershipStatus;
  disabledAt: string | null;
  updatedAt: string;
};

export type StaffMemberItem = {
  kind: "MEMBER";
  id: string;
  fullName: string;
  email: string;
  status: StaffMembershipStatus;
  membership: StaffMembership;
  assignments: StaffAssignment[];
};

export type StaffInvitationItem = {
  kind: "INVITATION";
  id: string;
  fullName: string;
  email: string;
  status: "INVITED";
  invitation: {
    id: string;
    expiresAt: string;
    deliveryStatus: StaffInvitationDeliveryStatus;
    lastSentAt: string | null;
    proposedAssignments: Array<{
      roleCode: TenantRoleCode;
      branchId: string | null;
    }>;
  };
  assignments: StaffAssignment[];
};

export type StaffListItem = StaffMemberItem | StaffInvitationItem;

export type StaffListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: StaffListStatus;
};

export type StaffPage = {
  items: StaffListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type StaffRoleSelection = {
  roleCode: TenantRoleCode;
  branchSlugs: string[];
};

export type CreateStaffInvitationInput = {
  email: string;
  fullName: string;
  reason?: string;
  assignments: StaffRoleSelection[];
};

export type GrantStaffRolesInput = {
  reason?: string;
  assignments: StaffRoleSelection[];
};

export type StaffReasonInput = { reason: string };

export type AcceptStaffInvitationInput = {
  token: string;
  password?: string;
};

export type AcceptStaffInvitationResponse = {
  tenantId: string;
  userId: string;
  membershipId: string;
};
