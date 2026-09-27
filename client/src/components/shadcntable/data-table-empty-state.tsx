import { Box } from "lucide-react";

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { useDataTableLocale } from "./contexts/data-table-locale-context";

export function DataTableEmptyState() {
  const locale = useDataTableLocale();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Box />
        </EmptyMedia>
        <EmptyTitle>{locale.body.noResults}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}
