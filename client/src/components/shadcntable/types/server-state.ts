import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";

export interface DataTableServerSortingConfig {
  value: SortingState;
  onChange: (sorting: SortingState) => void;
}

export interface DataTableServerFilteringConfig {
  globalFilter: string;
  columnFilters: ColumnFiltersState;
  onGlobalFilterChange: (value: string) => void;
  onColumnFiltersChange: (filters: ColumnFiltersState) => void;
}

/** Controlled server-side state. Pagination remains configured separately. */
export interface DataTableServerState {
  sorting?: DataTableServerSortingConfig;
  filtering?: DataTableServerFilteringConfig;
}
