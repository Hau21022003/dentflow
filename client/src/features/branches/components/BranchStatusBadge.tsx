import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { BranchStatus } from "../branches.types";

export function BranchStatusBadge({ status }: { status: BranchStatus }) {
  const { t } = useTranslation("branches");

  return (
    <Badge variant={status === "ACTIVE" ? "default" : "outline"}>
      {t(`statuses.${status}`)}
    </Badge>
  );
}
