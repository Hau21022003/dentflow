export const PATHS = {
  root: "/",
  login: "/login",
  acceptTenantOwnerInvitation: "/accept-tenant-owner-invitation",
  acceptStaffInvitation: "/accept-staff-invitation",
  forbidden: "/forbidden",
  patients: "/patients",
  platform: "/platform",
  platformEmailTemplates: "/platform/email-templates",
  platformTenants: "/platform/tenants",
  platformPlans: "/platform/plans",
  workspace: "/workspace",
  workspaceTenant: "/workspace/:tenantSlug",
  workspaceTenantHome: "/workspace/:tenantSlug/tenant",
  workspaceTenantBranches: "/workspace/:tenantSlug/tenant/branches",
  workspaceTenantServices: "/workspace/:tenantSlug/tenant/services",
  workspaceTenantStaff: "/workspace/:tenantSlug/tenant/staff",
  workspaceBranch: "/workspace/:tenantSlug/branches/:branchSlug",
  workspaceReceptionAppointments:
    "/workspace/:tenantSlug/branches/:branchSlug/reception/appointments",
  workspaceDoctor: "/workspace/:tenantSlug/branches/:branchSlug/doctor",
} as const;

function toPathSegment(value: string): string {
  return encodeURIComponent(value);
}

export const pathFor = {
  platformEmailTemplateDetail: (templateKey: string) =>
    `/platform/email-templates/${toPathSegment(templateKey)}`,
  platformTenantDetail: (tenantId: string) =>
    `/platform/tenants/${toPathSegment(tenantId)}`,
  workspace: (tenantSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}`,
  workspaceTenantHome: (tenantSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/tenant`,
  workspaceTenantBranches: (tenantSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/tenant/branches`,
  workspaceTenantServices: (tenantSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/tenant/services`,
  workspaceTenantStaff: (tenantSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/tenant/staff`,
  workspaceBranch: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}`,
  workspaceReceptionAppointments: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/reception/appointments`,
  workspaceDoctor: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/doctor`,
};
