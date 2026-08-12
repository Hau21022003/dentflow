import { Plus, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PATHS } from "../../app/router/paths";

export function PatientsListPage() {
  const { t } = useTranslation("patients");

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-sm font-semibold text-primary">DentFlow Care</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">{t("description")}</p>
        </div>
        <Button asChild className="h-10">
          <RouterLink to={PATHS.newPatient}>
            <Plus aria-hidden="true" />
            {t("actions.create")}
          </RouterLink>
        </Button>
      </div>

      <Card className="overflow-hidden border-dashed">
        <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 py-14 text-center">
          <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <UsersRound aria-hidden="true" className="size-7" />
          </span>
          <h2 className="text-lg font-semibold">{t("emptyState.title")}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {t("emptyState.description")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
