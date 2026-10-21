export const PATHS = {
  root: "/",
  login: "/login",
  acceptTenantOwnerInvitation: "/accept-tenant-owner-invitation",
  acceptStaffInvitation: "/accept-staff-invitation",
  forbidden: "/forbidden",
  profile: "/profile",
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
  workspaceBranchStaff: "/workspace/:tenantSlug/branches/:branchSlug/staff",
  workspaceBranchOperatories:
    "/workspace/:tenantSlug/branches/:branchSlug/operatories",
  workspaceReceptionPatients:
    "/workspace/:tenantSlug/branches/:branchSlug/reception/patients",
  workspaceReceptionPatientDetail:
    "/workspace/:tenantSlug/branches/:branchSlug/reception/patients/:patientId",
  workspaceReceptionAppointments:
    "/workspace/:tenantSlug/branches/:branchSlug/reception/appointments",
  workspaceReceptionTreatmentPlanAcceptances:
    "/workspace/:tenantSlug/branches/:branchSlug/reception/treatment-plan-acceptances",
  workspaceDoctor: "/workspace/:tenantSlug/branches/:branchSlug/doctor",
  workspaceDoctorPatients:
    "/workspace/:tenantSlug/branches/:branchSlug/doctor/patients",
  workspaceDoctorVisit:
    "/workspace/:tenantSlug/branches/:branchSlug/doctor/appointments/:appointmentId/visit",
  workspaceDoctorTreatmentPlan:
    "/workspace/:tenantSlug/branches/:branchSlug/doctor/appointments/:appointmentId/visit/treatment-plans/:planId",
  workspaceUploadTest:
    "/workspace/:tenantSlug/branches/:branchSlug/upload-test",
  workspaceDataTableMobileDemo:
    "/workspace/:tenantSlug/branches/:branchSlug/data-table-mobile-demo",
} as const;

function toPathSegment(value: string): string {
  return encodeURIComponent(value);
}

export const pathFor = {
  platformEmailTemplateDetail: (templateKey: string) =>
    `/platform/email-templates/${toPathSegment(templateKey)}`,
  platformTenantDetail: (tenantId: string) =>
    `/platform/tenants/${toPathSegment(tenantId)}`,
  workspace: (tenantSlug: string) => `/workspace/${toPathSegment(tenantSlug)}`,
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
  workspaceBranchStaff: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/staff`,
  workspaceBranchOperatories: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/operatories`,
  workspaceReceptionPatients: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/reception/patients`,
  workspaceReceptionPatientDetail: (
    tenantSlug: string,
    branchSlug: string,
    patientId: string,
  ) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/reception/patients/${toPathSegment(patientId)}`,
  workspaceReceptionAppointments: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/reception/appointments`,
  workspaceReceptionTreatmentPlanAcceptances: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/reception/treatment-plan-acceptances`,
  workspaceDoctor: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/doctor`,
  workspaceDoctorPatients: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/doctor/patients`,
  workspaceDoctorVisit: (
    tenantSlug: string,
    branchSlug: string,
    appointmentId: string,
    date: string,
  ) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/doctor/appointments/${toPathSegment(appointmentId)}/visit?date=${toPathSegment(date)}`,
  workspaceDoctorTreatmentPlan: (
    tenantSlug: string,
    branchSlug: string,
    appointmentId: string,
    planId: string,
    date: string,
  ) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/doctor/appointments/${toPathSegment(appointmentId)}/visit/treatment-plans/${toPathSegment(planId)}?date=${toPathSegment(date)}`,
  workspaceUploadTest: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/upload-test`,
  workspaceDataTableMobileDemo: (tenantSlug: string, branchSlug: string) =>
    `/workspace/${toPathSegment(tenantSlug)}/branches/${toPathSegment(branchSlug)}/data-table-mobile-demo`,
};
