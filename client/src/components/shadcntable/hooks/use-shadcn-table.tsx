import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";

import { type DataTablePaginationConfig } from "../data-table-pagination";
import { type DataTableRowSelectionConfig } from "../data-table-row-selection";
import type {
  DataTableServerFilteringConfig,
  DataTableServerSortingConfig,
} from "../types/server-state";

interface UseDataTableProps<TData, TValue> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  initialState?: TableState;
  pageSize?: DataTablePaginationConfig["pageSize"];
  rowSelectionConfig?: DataTableRowSelectionConfig<TData>;
  manualPagination?: {
    manual?: boolean;
    pageIndex: number;
    pageSize: number;
    rowCount?: number;
    onPaginationChange?: (pagination: {
      pageIndex: number;
      pageSize: number;
    }) => void;
  };
  serverFiltering?: DataTableServerFilteringConfig;
  serverSorting?: DataTableServerSortingConfig;
}

export function useShadcnTable<TData, TValue>({
  data,
  columns,
  initialState,
  pageSize = 10,
  rowSelectionConfig,
  manualPagination,
  serverFiltering,
  serverSorting,
}: UseDataTableProps<TData, TValue>) {
  "use no memo";
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState<string>("");

  const isManualPagination = manualPagination?.manual === true;
  const isServerFiltering = serverFiltering !== undefined;
  const isServerSorting = serverSorting !== undefined;

  const resolveNextPagination = (
    updater: Updater<PaginationState>,
  ): PaginationState => {
    const current: PaginationState = {
      pageIndex: manualPagination?.pageIndex ?? pagination.pageIndex,
      pageSize: manualPagination?.pageSize ?? pagination.pageSize,
    };

    return typeof updater === "function" ? updater(current) : updater;
  };

  const resolveNextState = <TState,>(
    updater: Updater<TState>,
    current: TState,
  ): TState =>
    typeof updater === "function"
      ? (updater as (current: TState) => TState)(current)
      : updater;

  /* eslint-disable-next-line react-hooks/incompatible-library */
  const table = useReactTable({
    data,
    columns,
    enableRowSelection: rowSelectionConfig?.enableRowSelection ?? true,
    enableMultiSort: !isServerSorting,
    getCoreRowModel: getCoreRowModel(),
    ...(isManualPagination
      ? {}
      : { getPaginationRowModel: getPaginationRowModel() }),
    ...(isServerSorting ? {} : { getSortedRowModel: getSortedRowModel() }),
    ...(isServerFiltering
      ? {}
      : { getFilteredRowModel: getFilteredRowModel() }),
    initialState,
    ...(isManualPagination
      ? {
          manualPagination: true,
          rowCount: manualPagination?.rowCount,
          onPaginationChange: (updater: Updater<PaginationState>) => {
            const next = resolveNextPagination(updater);
            manualPagination?.onPaginationChange?.(next);
          },
        }
      : {
          onPaginationChange: setPagination,
        }),
    ...(isServerSorting
      ? {
          manualSorting: true,
          onSortingChange: (updater: Updater<SortingState>) => {
            serverSorting.onChange(
              resolveNextState(updater, serverSorting.value),
            );
          },
        }
      : { onSortingChange: setSorting }),
    ...(isServerFiltering
      ? {
          manualFiltering: true,
          onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => {
            serverFiltering.onColumnFiltersChange(
              resolveNextState(updater, serverFiltering.columnFilters),
            );
          },
          onGlobalFilterChange: (updater: Updater<string>) => {
            serverFiltering.onGlobalFilterChange(
              resolveNextState(updater, serverFiltering.globalFilter),
            );
          },
        }
      : {
          onColumnFiltersChange: setColumnFilters,
          onGlobalFilterChange: setGlobalFilter,
        }),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      pagination: isManualPagination
        ? {
            pageIndex: manualPagination.pageIndex,
            pageSize: manualPagination.pageSize,
          }
        : pagination,
      sorting: serverSorting?.value ?? sorting,
      columnFilters: serverFiltering?.columnFilters ?? columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: serverFiltering?.globalFilter ?? globalFilter,
    },
  });

  useEffect(() => {
    if (rowSelectionConfig?.onRowSelectionChange) {
      const selectedRows = table
        .getSelectedRowModel()
        .rows.map((row) => row.original);
      rowSelectionConfig?.onRowSelectionChange?.(selectedRows);
    }
  }, [rowSelection, rowSelectionConfig, table]);

  return table;
}
