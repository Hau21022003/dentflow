import { Navigate, type RouteObject } from "react-router-dom";
import { LoginPage } from "../../pages/auth/LoginPage";
import { CreatePatientPage } from "../../pages/patients/CreatePatientPage";
import { PatientsListPage } from "../../pages/patients/PatientsListPage";
import { AppLayout } from "../layouts/AppLayout";
import { RedirectIfAuthenticated } from "./guards/RedirectIfAuthenticated";
import { RequireAuth } from "./guards/RequireAuth";
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
          {
            index: true,
            element: <Navigate replace to={PATHS.patients} />,
          },
          { path: PATHS.patients, element: <PatientsListPage /> },
          { path: PATHS.newPatient, element: <CreatePatientPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate replace to={PATHS.root} /> },
];
