import { type Table } from "@tanstack/react-table";

import { Spinner } from "@/components/ui/spinner";

import { DataTableEmptyState } from "./data-table-empty-state";
import {
  DataTableRowSelectionControl,
  type DataTableRowSelectionConfig,
} from "./data-table-row-selection";

export type DataTableMobileLayout = "cards" | "divided";

interface DataTableMobileListProps<TData> {
  emptyState?: React.ReactNode;
  isFetching?: boolean;
  isLoading?: boolean;
  layout: DataTableMobileLayout;
  onRowClick?: (row: TData) => void;
  renderMobileItem: (item: TData, index: number) => React.ReactNode;
  rowSelection?: DataTableRowSelectionConfig<TData>;
  table: Table<TData>;
}

export function DataTableMobileList<TData>({
  emptyState,
  isFetching,
  isLoading,
  layout,
  onRowClick,
  renderMobileItem,
  rowSelection,
  table,
}: DataTableMobileListProps<TData>) {
  "use no memo";
  const rows = table.getRowModel().rows;
  const isCardLayout = layout === "cards";
  const listClassName = isCardLayout
    ? "space-y-3"
    : "divide-y divide-border overflow-hidden rounded-md border";
  const loadingItemClassName = isCardLayout
    ? "space-y-3 rounded-2xl border border-border/80 p-4"
    : "space-y-3 p-4";

  return (
    <div className="relative md:hidden">
      {isLoading ? (
        <div
          aria-busy="true"
          className={listClassName}
          data-slot="data-table-mobile-list"
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <div className={loadingItemClassName} key={index}>
              <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : rows.length ? (
        <div className={listClassName} data-slot="data-table-mobile-list">
          {rows.map((row, index) => (
            <div
              className={
                onRowClick
                  ? isCardLayout
                    ? "flex items-start gap-3 cursor-pointer"
                    : "flex items-start gap-3 p-4 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted cursor-pointer"
                  : isCardLayout
                    ? "flex items-start gap-3"
                    : "flex items-start gap-3 p-4 transition-colors data-[state=selected]:bg-muted"
              }
              data-slot="data-table-mobile-item"
              data-state={row.getIsSelected() && "selected"}
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
            >
              {rowSelection && (
                <div
                  className={
                    isCardLayout
                      ? "flex shrink-0 pt-4"
                      : "flex shrink-0 pt-0.5"
                  }
                >
                  <DataTableRowSelectionControl row={row} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {renderMobileItem(row.original, index)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded-md border"
          data-slot="data-table-mobile-list"
        >
          {emptyState ?? <DataTableEmptyState />}
        </div>
      )}

      {isFetching && !isLoading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/40"
          data-slot="data-table-mobile-fetching-overlay"
        >
          <Spinner />
        </div>
      )}
    </div>
  );
}
