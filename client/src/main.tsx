import GlobalStyles from "@mui/material/GlobalStyles";
import { StyledEngineProvider } from "@mui/material/styles";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers/AppProviders";
import { AppRouter } from "./app/router/AppRouter";

import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* <AppProviders>
      <AppRouter />
    </AppProviders> */}
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </StyledEngineProvider>
  </StrictMode>,
);
