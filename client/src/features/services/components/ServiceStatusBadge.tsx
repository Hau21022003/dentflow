import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export function ServiceStatusBadge({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation("services");

  return (
    <Badge variant={isActive ? "default" : "outline"}>
      {t(isActive ? "statuses.ACTIVE" : "statuses.INACTIVE")}
    </Badge>
  );
}
