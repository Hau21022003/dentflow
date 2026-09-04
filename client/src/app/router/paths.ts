export const PATHS = {
  root: "/",
  login: "/login",
  forbidden: "/forbidden",
  patients: "/patients",
  platform: "/platform",
  platformTenants: "/platform/tenants",
  platformPlans: "/platform/plans",
  workspace: "/workspace",
  workspaceTenant: "/workspace/:tenantSlug",
  workspaceTenantHome: "/workspace/:tenantSlug/tenant",
  workspaceTenantBranches: "/workspace/:tenantSlug/tenant/branches",
  workspaceBranch: "/workspace/:tenantSlug/branches/:branchSlug",
  workspaceBranchStaff:
    "/workspace/:tenantSlug/branches/:branchSlug/branch/staff",
  workspaceReceptionAppointments:
    "/workspace/:tenantSlug/branches/:branchSlug/reception/appointments",
  workspaceDoctor: "/workspace/:tenantSlug/branches/:branchSlug/doctor",
} as const;

function toPathSegment(value: string): string {
  return encodeURIComponent(value);
}

export const pathFor = {
  workspace: (tenantSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}`,
  workspaceTenantHome: (tenantSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/tenant`,
  workspaceTenantBranches: (tenantSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/tenant/branches`,
  workspaceBranch: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}`,
  workspaceBranchStaff: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/branch/staff`,
  workspaceReceptionAppointments: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/reception/appointments`,
  workspaceDoctor: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/doctor`,
};
