import { Navigate, type RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/features/auth/auth.types";
import { LoginPage } from "../../pages/auth/LoginPage";
import { AcceptTenantOwnerInvitationPage } from "../../pages/auth/AcceptTenantOwnerInvitationPage";
import { AcceptStaffInvitationPage } from "../../pages/auth/AcceptStaffInvitationPage";
import { PatientManagementPage } from "../../pages/workspace/reception/PatientManagementPage";
import { ProfilePage } from "../../pages/profile/ProfilePage";
import { PlatformHomePage } from "../../pages/platform/PlatformHomePage";
import { EmailTemplateDetailPage } from "../../pages/platform/EmailTemplateDetailPage";
import { EmailTemplateManagementPage } from "../../pages/platform/EmailTemplateManagementPage";
import { SubscriptionPlanManagementPage } from "../../pages/platform/SubscriptionPlanManagementPage";
import { TenantManagementPage } from "../../pages/platform/TenantManagementPage";
import { TenantDetailPage } from "../../pages/platform/TenantDetailPage";
import { BranchWorkspaceHomePage } from "../../pages/workspace/branch/BranchWorkspaceHomePage";
import { BranchStaffManagementPage } from "../../pages/workspace/branch/BranchStaffManagementPage";
import { TempImageUploadTestPage } from "../../pages/workspace/branch/TempImageUploadTestPage";
import { DoctorHomePage } from "../../pages/workspace/doctor/DoctorHomePage";
import { DoctorVisitPage } from "../../pages/workspace/doctor/DoctorVisitPage";
import { AppointmentsPage } from "../../pages/workspace/reception/AppointmentsPage";
import { TreatmentPlanAcceptancesPage } from "../../pages/workspace/reception/TreatmentPlanAcceptancesPage";
import { BranchManagementPage } from "../../pages/workspace/tenant/BranchManagementPage";
import { ServiceManagementPage } from "../../pages/workspace/tenant/ServiceManagementPage";
import { TenantHomePage } from "../../pages/workspace/tenant/TenantHomePage";
import { StaffManagementPage } from "../../pages/workspace/tenant/StaffManagementPage";
import { AppLayout } from "../layouts/AppLayout";
import { LegacyBranchStaffRedirect } from "./LegacyBranchStaffRedirect";
import { RoleHomeRedirect } from "./RoleHomeRedirect";
import {
  WorkspaceRootRedirect,
  WorkspaceTenantRedirect,
} from "./WorkspaceRedirects";
import { ForbiddenPage } from "./guards/ForbiddenPage";
import { RedirectIfAuthenticated } from "./guards/RedirectIfAuthenticated";
import { RequireAuth } from "./guards/RequireAuth";
import { RequireBranchAccess } from "./guards/RequireBranchAccess";
import { RequireBranchPermission } from "./guards/RequireBranchPermission";
import { RequirePlatformPermission } from "./guards/RequirePlatformPermission";
import { RequireTenantAccess } from "./guards/RequireTenantAccess";
import { RequireTenantPermission } from "./guards/RequireTenantPermission";
import { PATHS } from "./paths";

export const routes: RouteObject[] = [
  {
    path: PATHS.acceptTenantOwnerInvitation,
    element: <AcceptTenantOwnerInvitationPage />,
  },
  {
    path: PATHS.acceptStaffInvitation,
    element: <AcceptStaffInvitationPage />,
  },
  {
    path: PATHS.login,
    element: <RedirectIfAuthenticated />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: PATHS.root,
        element: <AppLayout />,
        children: [
          { index: true, element: <RoleHomeRedirect /> },
          { path: PATHS.forbidden, element: <ForbiddenPage /> },
          { path: PATHS.profile, element: <ProfilePage /> },
          {
            path: PATHS.platform,
            element: (
              <RequirePlatformPermission
                permission={PERMISSIONS.platformSystemRead}
              />
            ),
            children: [
              { index: true, element: <PlatformHomePage /> },
              {
                path: "tenants",
                element: (
                  <RequirePlatformPermission
                    permission={PERMISSIONS.platformTenantManage}
                  />
                ),
                children: [
                  { index: true, element: <TenantManagementPage /> },
                  { path: ":tenantId", element: <TenantDetailPage /> },
                ],
              },
            ],
          },
          {
            path: PATHS.platformEmailTemplates,
            element: (
              <RequirePlatformPermission
                permission={PERMISSIONS.platformEmailTemplateManage}
              />
            ),
            children: [
              { index: true, element: <EmailTemplateManagementPage /> },
              { path: ":templateKey", element: <EmailTemplateDetailPage /> },
            ],
          },
          {
            path: PATHS.platformPlans,
            element: (
              <RequirePlatformPermission
                permission={PERMISSIONS.platformPlanManage}
              />
            ),
            children: [
              { index: true, element: <SubscriptionPlanManagementPage /> },
            ],
          },
          {
            path: PATHS.workspace,
            children: [
              { index: true, element: <WorkspaceRootRedirect /> },
              {
                path: ":tenantSlug",
                element: <RequireTenantAccess />,
                children: [
                  { index: true, element: <WorkspaceTenantRedirect /> },
                  {
                    path: "tenant",
                    element: (
                      <RequireTenantPermission
                        permission={PERMISSIONS.tenantSettingsManage}
                      />
                    ),
                    children: [
                      { index: true, element: <TenantHomePage /> },
                      {
                        path: "branches",
                        element: (
                          <RequireTenantPermission
                            permission={PERMISSIONS.branchManage}
                          />
                        ),
                        children: [
                          { index: true, element: <BranchManagementPage /> },
                        ],
                      },
                      {
                        path: "services",
                        element: (
                          <RequireTenantPermission
                            permission={PERMISSIONS.serviceCatalogManage}
                          />
                        ),
                        children: [
                          { index: true, element: <ServiceManagementPage /> },
                        ],
                      },
                      {
                        path: "staff",
                        element: (
                          <RequireTenantPermission
                            permission={PERMISSIONS.staffManage}
                          />
                        ),
                        children: [
                          { index: true, element: <StaffManagementPage /> },
                        ],
                      },
                    ],
                  },
                  {
                    path: "branches/:branchSlug",
                    element: <RequireBranchAccess />,
                    children: [
                      { index: true, element: <BranchWorkspaceHomePage /> },
                      {
                        path: "staff",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.staffBranchManage}
                          />
                        ),
                        children: [
                          { index: true, element: <BranchStaffManagementPage /> },
                        ],
                      },
                      {
                        path: "branch/staff",
                        element: <LegacyBranchStaffRedirect />,
                      },
                      // Temporary, unlinked diagnostic route for direct-storage E2E coverage.
                      {
                        path: "upload-test",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.fileUpload}
                          />
                        ),
                        children: [
                          { index: true, element: <TempImageUploadTestPage /> },
                        ],
                      },
                      {
                        path: "reception/patients",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.patientAdministrativeManage}
                          />
                        ),
                        children: [{ index: true, element: <PatientManagementPage /> }],
                      },
                      {
                        path: "reception/appointments",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.appointmentManage}
                          />
                        ),
                        children: [
                          { index: true, element: <AppointmentsPage /> },
                        ],
                      },
                      {
                        path: "doctor",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.appointmentAssignedRead}
                          />
                        ),
                        children: [
                          { index: true, element: <DoctorHomePage /> },
                        ],
                      },
                      {
                        path: "reception/treatment-plan-acceptances",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.treatmentPlanAccept}
                          />
                        ),
                        children: [
                          { index: true, element: <TreatmentPlanAcceptancesPage /> },
                        ],
                      },
                      {
                        path: "doctor/appointments/:appointmentId/visit",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.clinicalVisitWrite}
                          />
                        ),
                        children: [{ index: true, element: <DoctorVisitPage /> }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate replace to={PATHS.root} /> },
];
