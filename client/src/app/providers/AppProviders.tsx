import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { enUS, viVN } from "@mui/material/locale";
import { useMemo, type PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { AuthSessionBootstrap } from "./AuthSessionBootstrap";
import { ReactQueryProvider } from "./ReactQueryProvider";

export function AppProviders({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  const theme = useMemo(
    () =>
      createTheme(
        {
          palette: {
            primary: { main: "#1565c0" },
            background: { default: "#f6f8fb" },
          },
          shape: { borderRadius: 10 },
        },
        i18n.resolvedLanguage === "en" ? enUS : viVN,
      ),
    [i18n.resolvedLanguage],
  );

  return (
    <ReactQueryProvider>
      <AuthSessionBootstrap />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ReactQueryProvider>
  );
}
