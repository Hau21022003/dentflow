import type { DataTableLocale } from "@/components/shadcntable/types/locale";

import type { Translate } from "./validation";

type DeepPartial<T> = {
  [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key];
};

export type DataTableLocaleOverrides = DeepPartial<DataTableLocale>;

export function createDataTableLocale(
  t: Translate,
  overrides: DataTableLocaleOverrides = {},
): DataTableLocale {
  const locale: DataTableLocale = {
    body: {
      noResults: t("dataTable.body.noResults"),
    },
    pagination: {
      rowsSelected: t("dataTable.pagination.rowsSelected"),
      rowsPerPage: t("dataTable.pagination.rowsPerPage"),
      page: t("dataTable.pagination.page"),
      of: t("dataTable.pagination.of"),
      goToFirstPage: t("dataTable.pagination.goToFirstPage"),
      goToPreviousPage: t("dataTable.pagination.goToPreviousPage"),
      goToNextPage: t("dataTable.pagination.goToNextPage"),
      goToLastPage: t("dataTable.pagination.goToLastPage"),
    },
    toolbar: {
      searchPlaceholder: t("dataTable.toolbar.searchPlaceholder"),
    },
    viewOptions: {
      view: t("dataTable.viewOptions.view"),
      toggleColumns: t("dataTable.viewOptions.toggleColumns"),
    },
    rowSelection: {
      selectAll: t("dataTable.rowSelection.selectAll"),
      selectRow: t("dataTable.rowSelection.selectRow"),
    },
    columnHeader: {
      sortAscending: t("dataTable.columnHeader.sortAscending"),
      sortDescending: t("dataTable.columnHeader.sortDescending"),
      clearSorting: t("dataTable.columnHeader.clearSorting"),
      hideColumn: t("dataTable.columnHeader.hideColumn"),
      clearFilter: t("dataTable.columnHeader.clearFilter"),
      sortMenuLabel: t("dataTable.columnHeader.sortMenuLabel"),
      filterMenuLabel: t("dataTable.columnHeader.filterMenuLabel"),
    },
    filters: {
      select: {
        placeholder: t("dataTable.filters.select.placeholder"),
      },
      multiSelect: {
        search: t("dataTable.filters.multiSelect.search"),
        noResults: t("dataTable.filters.multiSelect.noResults"),
      },
      numberRange: {
        min: t("dataTable.filters.numberRange.min"),
        max: t("dataTable.filters.numberRange.max"),
      },
    },
  };

  return {
    body: { ...locale.body, ...overrides.body },
    pagination: { ...locale.pagination, ...overrides.pagination },
    toolbar: { ...locale.toolbar, ...overrides.toolbar },
    viewOptions: { ...locale.viewOptions, ...overrides.viewOptions },
    rowSelection: { ...locale.rowSelection, ...overrides.rowSelection },
    columnHeader: { ...locale.columnHeader, ...overrides.columnHeader },
    filters: {
      select: { ...locale.filters.select, ...overrides.filters?.select },
      multiSelect: {
        ...locale.filters.multiSelect,
        ...overrides.filters?.multiSelect,
      },
      numberRange: {
        ...locale.filters.numberRange,
        ...overrides.filters?.numberRange,
      },
    },
  };
}
