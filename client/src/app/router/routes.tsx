import { Navigate, type RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/features/auth/auth.types";
import { LoginPage } from "../../pages/auth/LoginPage";
import { PatientsListPage } from "../../pages/patients/PatientsListPage";
import { PlatformHomePage } from "../../pages/platform/PlatformHomePage";
import { SubscriptionPlanManagementPage } from "../../pages/platform/SubscriptionPlanManagementPage";
import { TenantManagementPage } from "../../pages/platform/TenantManagementPage";
import { BranchWorkspaceHomePage } from "../../pages/workspace/branch/BranchWorkspaceHomePage";
import { StaffManagementPage } from "../../pages/workspace/branch/StaffManagementPage";
import { DoctorHomePage } from "../../pages/workspace/doctor/DoctorHomePage";
import { AppointmentsPage } from "../../pages/workspace/reception/AppointmentsPage";
import { BranchManagementPage } from "../../pages/workspace/tenant/BranchManagementPage";
import { TenantHomePage } from "../../pages/workspace/tenant/TenantHomePage";
import { AppLayout } from "../layouts/AppLayout";
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
                children: [{ index: true, element: <TenantManagementPage /> }],
              },
            ],
          },
          {
            path: PATHS.platformPlans,
            element: (
              <RequirePlatformPermission
                permission={PERMISSIONS.platformPlanManage}
              />
            ),
            children: [{ index: true, element: <SubscriptionPlanManagementPage /> }],
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
                    ],
                  },
                  {
                    path: "branches/:branchSlug",
                    element: <RequireBranchAccess />,
                    children: [
                      { index: true, element: <BranchWorkspaceHomePage /> },
                      {
                        path: "branch/staff",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.staffManage}
                          />
                        ),
                        children: [
                          { index: true, element: <StaffManagementPage /> },
                        ],
                      },
                      {
                        path: "reception/appointments",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.appointmentManage}
                          />
                        ),
                        children: [{ index: true, element: <AppointmentsPage /> }],
                      },
                      {
                        path: "doctor",
                        element: (
                          <RequireBranchPermission
                            permission={PERMISSIONS.appointmentAssignedRead}
                          />
                        ),
                        children: [{ index: true, element: <DoctorHomePage /> }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { path: PATHS.patients, element: <PatientsListPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate replace to={PATHS.root} /> },
];
