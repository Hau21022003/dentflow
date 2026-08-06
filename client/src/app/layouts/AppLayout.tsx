import { Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, Link as RouterLink } from "react-router-dom";
import { PATHS } from "../router/paths";

export function AppLayout() {
  const { i18n, t } = useTranslation("common");
  const language = i18n.resolvedLanguage === "en" ? "en" : "vi";

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function toggleLanguage() {
    void i18n.changeLanguage(language === "vi" ? "en" : "vi");
  }

  return (
    <>
      <Box
        component="header"
        sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}
      >
        <Toolbar>
          <Typography component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
            DentFlow
          </Typography>
          <Button color="inherit" component={RouterLink} to={PATHS.patients}>
            {t("navigation.patients")}
          </Button>
          <Button color="inherit" component={RouterLink} to={PATHS.login}>
            {t("navigation.demoLogin")}
          </Button>
          <Button
            aria-label={
              language === "vi"
                ? t("language.switchToEnglish")
                : t("language.switchToVietnamese")
            }
            color="inherit"
            onClick={toggleLanguage}
          >
            {language === "vi" ? "EN" : "VI"}
          </Button>
        </Toolbar>
      </Box>

      <Container component="main" maxWidth="md" sx={{ py: 5 }}>
        <Outlet />
      </Container>
    </>
  );
}
