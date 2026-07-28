import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import type { PropsWithChildren } from "react";
import { ReactQueryProvider } from "./ReactQueryProvider";

const theme = createTheme({
  palette: {
    primary: { main: "#1565c0" },
    background: { default: "#f6f8fb" },
  },
  shape: { borderRadius: 10 },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ReactQueryProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ReactQueryProvider>
  );
}
