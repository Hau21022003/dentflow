import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppointmentView } from "./AppointmentDateNavigation";

export function AppointmentViewPlaceholder({ view }: { view: Extract<AppointmentView, "timeline" | "month"> }) {
  const { t } = useTranslation("appointments");
  return (
    <Card>
      <CardContent className="grid min-h-80 place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <CalendarDays aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
          <h2 className="font-semibold">{t(`views.${view}`)}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{t(`placeholders.${view}`)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
