export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

export const PERMISSIONS = {
  platformEmailTemplateManage: "platform.email-template.manage",
  platformTenantManage: "platform.tenant.manage",
  platformPlanManage: "platform.plan.manage",
  platformSaasBillingRead: "platform.saas-billing.read",
  platformSupportManage: "platform.support.manage",
  platformSystemRead: "platform.system.read",
  platformAuditLogRead: "platform.audit-log.read",
  tenantSettingsManage: "tenant.settings.manage",
  branchManage: "branch.manage",
  serviceCatalogManage: "service-catalog.manage",
  staffManage: "staff.manage",
  staffBranchManage: "staff.branch.manage",
  reportRead: "report.read",
  auditLogRead: "audit-log.read",
  saasBillingManage: "saas-billing.manage",
  notificationSettingsManage: "notification-settings.manage",
  fileUpload: "file.upload",
  patientAdministrativeManage: "patient.administrative.manage",
  appointmentManage: "appointment.manage",
  patientInvoiceCreate: "patient-invoice.create",
  patientPaymentRecord: "patient-payment.record",
  appointmentAssignedRead: "appointment.assigned.read",
  clinicalVisitWrite: "clinical.visit.write",
  treatmentPlanWrite: "treatment-plan.write",
  treatmentItemComplete: "treatment-item.complete",
  followUpRecommend: "follow-up.recommend",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PlatformRoleCode = "PLATFORM_ADMIN";

export type TenantRoleCode =
  "TENANT_ADMIN" | "BRANCH_ADMIN" | "RECEPTIONIST" | "DENTIST";

export type TenantStatus =
  "PROVISIONING" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";

export type BranchStatus = "ACTIVE" | "INACTIVE";

export type TenantLookup = { id: string } | { slug: string };

export type TenantAuthorization = {
  tenant: {
    id: string;
    slug: string;
    displayName: string;
    status: TenantStatus;
  };
  roles: TenantRoleCode[];
  permissions: Permission[];
  branches: Array<{
    branch: {
      id: string;
      slug: string;
      name: string;
      timezone: string;
      status: BranchStatus;
    };
    roles: TenantRoleCode[];
    permissions: Permission[];
  }>;
};

export type AuthorizationSnapshot = {
  platform: {
    roles: PlatformRoleCode[];
    permissions: Permission[];
  };
  tenants: TenantAuthorization[];
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  authorization: AuthorizationSnapshot;
};

export type UserProfile = Pick<
  AuthUser,
  "id" | "email" | "fullName" | "avatarUrl"
>;

export type UpdateMyProfileInput = {
  fullName: string;
  avatarObjectKey?: string | null;
};

export type AuthResponse = {
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AcceptTenantOwnerInvitationInput = {
  token: string;
  fullName?: string;
  password?: string;
};

export type AcceptTenantOwnerInvitationResponse = {
  tenantId: string;
  tenantSlug: string;
  ownerUserId: string;
};
