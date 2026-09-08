import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { TenantStatus } from "@/features/tenants/tenants.types";

const variants: Record<
  TenantStatus,
  "default" | "secondary" | "destructive" | "outline" | "ghost"
> = {
  PROVISIONING: "outline",
  ACTIVE: "default",
  TRIAL: "secondary",
  PAST_DUE: "outline",
  SUSPENDED: "destructive",
  CANCELED: "ghost",
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  const { t } = useTranslation("tenants");
  return <Badge variant={variants[status]}>{t(`statuses.${status}`)}</Badge>;
}
