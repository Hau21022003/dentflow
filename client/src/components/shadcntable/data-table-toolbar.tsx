import { type Table } from "@tanstack/react-table";

import { Input } from "@/components/ui/input";

import { useDataTableLocale } from "./contexts/data-table-locale-context";
import { DataTableViewOptions } from "./data-table-view-options";

export interface DataTableToolbarConfig {
  search?: boolean;
  viewOptions?: boolean;
}

interface DataTableToolbarProps<TData> {
  config?: DataTableToolbarConfig;
  globalFilter?: string;
  isLoading?: boolean;
  onGlobalFilterChange?: (value: string) => void;
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  config,
  globalFilter,
  isLoading,
  onGlobalFilterChange,
  table,
}: DataTableToolbarProps<TData>) {
  "use no memo";
  const locale = useDataTableLocale();
  const { search = true, viewOptions = true } = config ?? {};

  if (!search && !viewOptions) return null;

  return (
    <div className="flex items-center">
      {search && (
        <Input
          disabled={isLoading}
          placeholder={locale.toolbar.searchPlaceholder}
          value={
            globalFilter ?? (table.getState().globalFilter as string) ?? ""
          }
          onChange={(event) => {
            const value = event.target.value;
            if (onGlobalFilterChange) {
              onGlobalFilterChange(value);
              return;
            }
            table.setGlobalFilter(value);
          }}
          className="max-w-sm"
        />
      )}
      {viewOptions && (
        <DataTableViewOptions isLoading={isLoading} table={table} />
      )}
    </div>
  );
}
