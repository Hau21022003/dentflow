import { Add } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { PATHS } from "../../app/router/paths";

export function PatientsListPage() {
  const { t } = useTranslation("patients");

  return (
    <Stack spacing={3}>
      <Box sx={{ alignItems: "center", display: "flex", gap: 2, justifyContent: "space-between" }}>
        <Box>
          <Typography component="h1" variant="h4">
            {t("title")}
          </Typography>
          <Typography color="text.secondary">
            {t("description")}
          </Typography>
        </Box>
        <Button component={RouterLink} startIcon={<Add />} to={PATHS.newPatient} variant="contained">
          {t("actions.create")}
        </Button>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontWeight: 600 }}>{t("emptyState.title")}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {t("emptyState.description")}
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
