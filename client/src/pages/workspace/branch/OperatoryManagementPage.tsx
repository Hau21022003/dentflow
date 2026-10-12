import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useChangeOperatoryActivityMutation,
  useCreateOperatoryMutation,
  useOperatoriesQuery,
  useUpdateOperatoryMutation,
} from "@/features/operatories/operatories.hooks";
import type {
  Operatory,
  OperatoryListQuery,
  OperatorySortBy,
  OperatoryType,
} from "@/features/operatories/operatories.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import { cn } from "@/shared/lib/utils";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
} from "@tanstack/react-table";
import {
  Armchair,
  Ban,
  DoorOpen,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

const PAGE_SIZE_OPTIONS = [5, 10, 25];

function stringFilter(
  columnFilters: ColumnFiltersState,
  columnId: string,
): string | undefined {
  const value = columnFilters.find((filter) => filter.id === columnId)?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toSortBy(sorting: SortingState): OperatorySortBy | undefined {
  const id = sorting[0]?.id;
  return id === "code" ||
    id === "name" ||
    id === "type" ||
    id === "isActive" ||
    id === "createdAt"
    ? id
    : undefined;
}

export function OperatoryManagementPage() {
  const { i18n, t } = useTranslation("operatories");
  const { t: tCommon } = useTranslation("common");
  const { branchSlug, tenantSlug } = useRouteWorkspaceContext();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editing, setEditing] = useState<Operatory | null | undefined>();
  const [lifecycle, setLifecycle] = useState<Operatory | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(globalFilter.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const status = stringFilter(columnFilters, "isActive");
  const isActive =
    status === "ACTIVE" ? true : status === "INACTIVE" ? false : undefined;
  const sortBy = toSortBy(sorting);
  const queryInput = useMemo<OperatoryListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sorting[0] ? { sortOrder: sorting[0].desc ? "DESC" : "ASC" } : {}),
    }),
    [debouncedSearch, isActive, pagination, sortBy, sorting],
  );
  const query = useOperatoriesQuery(tenantSlug, branchSlug, queryInput);
  const dataTableLocale = useMemo(
    () => createDataTableLocale(tCommon),
    [tCommon],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN",
        { dateStyle: "medium", timeStyle: "short" },
      ),
    [i18n.resolvedLanguage],
  );

  const columns = useMemo<ColumnDef<Operatory>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("list.code")} />
        ),
        cell: ({ row }) => (
          <span className="font-semibold tracking-tight text-[#142033]">
            {row.original.code}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("list.name")} />
        ),
        cell: ({ row }) => (
          <span className="block min-w-56 font-semibold text-[#142033]">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("list.type")} />
        ),
        cell: ({ row }) => <OperatoryTypeBadge type={row.original.type} />,
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("list.status")} />
        ),
        cell: ({ row }) => <OperatoryStatusBadge operatory={row.original} />,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("list.createdAt")} />
        ),
        cell: ({ row }) => (
          <time
            className="inline-block min-w-44 text-[#596579]"
            dateTime={row.original.createdAt}
          >
            {dateTimeFormatter.format(new Date(row.original.createdAt))}
          </time>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => (
          <span className="block text-right">{t("list.actions")}</span>
        ),
        cell: ({ row }) => (
          <div className="flex min-w-max justify-end gap-2">
            <Button
              className="h-9 rounded-lg border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#27364B] shadow-none hover:bg-[#F5F8FA] hover:text-[#142033]"
              onClick={() => setEditing(row.original)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Pencil aria-hidden="true" />
              {t("actions.edit")}
            </Button>
            <Button
              className={cn(
                "h-9 rounded-lg border-transparent px-3 text-sm font-medium shadow-none",
                row.original.isActive
                  ? "bg-[#FDE8E8] text-[#B42318] hover:bg-[#F9D6D6] hover:text-[#922018]"
                  : "bg-[#DDF5EB] text-[#176B50] hover:bg-[#CBEDE0] hover:text-[#12563F]",
              )}
              onClick={() => setLifecycle(row.original)}
              size="sm"
              type="button"
              variant="outline"
            >
              {row.original.isActive ? (
                <Ban aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              {t(
                row.original.isActive
                  ? "actions.deactivate"
                  : "actions.activate",
              )}
            </Button>
          </div>
        ),
      },
    ],
    [dateTimeFormatter, t],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function setStatusFilter(nextStatus: "ALL" | "ACTIVE" | "INACTIVE") {
    setColumnFilters(
      nextStatus === "ALL" ? [] : [{ id: "isActive", value: nextStatus }],
    );
    resetToFirstPage();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-[#142033] sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#596579] sm:text-base">
            {t("description")}
          </p>
        </div>
        <Button
          className="h-10 rounded-lg bg-[#007F75] px-4 font-semibold text-white shadow-sm hover:bg-[#006D65]"
          onClick={() => setEditing(null)}
          type="button"
        >
          <Plus aria-hidden="true" />
          {t("actions.create")}
        </Button>
      </div>

      <Card className="rounded-lg border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#596579]"
              />
              <Input
                className="h-10 rounded-lg border-[#E2E8F0] bg-white pl-9 text-[#142033] shadow-none placeholder:text-[#7A8699] focus:border-[#007F75] focus:ring-[#007F75]/15 sm:min-w-80"
                disabled={query.isLoading}
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                  resetToFirstPage();
                }}
                placeholder={t("list.search")}
                value={globalFilter}
              />
            </div>
            <Select
              onValueChange={(value) =>
                setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")
              }
              value={status ?? "ALL"}
            >
              <SelectTrigger
                aria-label={t("filters.statusLabel")}
                className="h-10 w-full rounded-lg border-[#E2E8F0] bg-white text-[#27364B] shadow-none focus:border-[#007F75] focus:ring-[#007F75]/15 sm:w-52"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("filters.all")}</SelectItem>
                <SelectItem value="ACTIVE">{t("filters.active")}</SelectItem>
                <SelectItem value="INACTIVE">
                  {t("filters.inactive")}
                </SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm font-medium text-[#596579] sm:ml-auto">
              {t("list.itemCount", { count: query.data?.meta.total ?? 0 })}
            </span>
          </div>

          <div className="[&>div]:space-y-4 [&_[data-slot=table-container]]:rounded-lg [&_[data-slot=table-container]]:border-[#E2E8F0] [&_[data-slot=table-header]]:bg-[#F5F8FA] [&_[data-slot=table-head]]:h-12 [&_[data-slot=table-head]]:px-4 [&_[data-slot=table-head]]:font-semibold [&_[data-slot=table-head]]:text-[#27364B] [&_[data-slot=table-cell]]:h-16 [&_[data-slot=table-cell]]:px-4 [&_[data-slot=table-row]]:border-[#E2E8F0] [&_[data-slot=table-body]_[data-slot=table-row]]:transition-colors [&_[data-slot=table-body]_[data-slot=table-row]]:hover:bg-[#F2FBFA]">
            <DataTable
              columns={columns}
              data={query.data?.items ?? []}
              emptyState={
                query.isError ? (
                  <Alert className="m-5" variant="destructive">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>{getErrorMessage(query.error)}</span>
                      <Button
                        onClick={() => void query.refetch()}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RefreshCw aria-hidden="true" />
                        {t("actions.retry")}
                      </Button>
                    </div>
                  </Alert>
                ) : (
                  <p className="p-10 text-center text-sm text-[#596579]">
                    {t("list.empty")}
                  </p>
                )
              }
              isFetching={query.isFetching}
              isLoading={query.isLoading}
              locale={dataTableLocale}
              pagination={{
                manual: true,
                pageIndex: pagination.pageIndex,
                pageSize: pagination.pageSize,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                rowCount: query.data?.meta.total ?? 0,
                onPaginationChange: (next) =>
                  setPagination((current) => ({
                    pageIndex:
                      next.pageSize === current.pageSize ? next.pageIndex : 0,
                    pageSize: next.pageSize,
                  })),
              }}
              serverState={{
                sorting: {
                  value: sorting,
                  onChange: (next) => {
                    setSorting(next);
                    resetToFirstPage();
                  },
                },
                filtering: {
                  globalFilter,
                  columnFilters,
                  onGlobalFilterChange: (next) => {
                    setGlobalFilter(next);
                    resetToFirstPage();
                  },
                  onColumnFiltersChange: (next) => {
                    setColumnFilters(next);
                    resetToFirstPage();
                  },
                },
              }}
              toolbar={{ search: false, viewOptions: false }}
            />
          </div>
        </CardContent>
      </Card>

      {editing !== undefined && (
        <OperatoryFormDialog
          branchSlug={branchSlug}
          onClose={() => setEditing(undefined)}
          operatory={editing}
          tenantSlug={tenantSlug}
        />
      )}
      {lifecycle && (
        <OperatoryLifecycleDialog
          branchSlug={branchSlug}
          onClose={() => setLifecycle(null)}
          operatory={lifecycle}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
}

function OperatoryTypeBadge({ type }: { type: OperatoryType }) {
  const { t } = useTranslation("operatories");
  const Icon = type === "ROOM" ? DoorOpen : Armchair;

  return (
    <Badge
      className={cn(
        "h-7 gap-1.5 rounded-full border-transparent px-2.5 text-sm font-medium shadow-none",
        type === "ROOM"
          ? "bg-[#E3F0FC] text-[#236C9E]"
          : "bg-[#DDF5EB] text-[#176B50]",
      )}
      variant="outline"
    >
      <Icon aria-hidden="true" data-icon="inline-start" />
      {t(`types.${type}`)}
    </Badge>
  );
}

function OperatoryStatusBadge({ operatory }: { operatory: Operatory }) {
  const { t } = useTranslation("operatories");

  return (
    <Badge
      className={cn(
        "h-7 gap-1.5 rounded-full border-transparent px-2.5 text-sm font-medium shadow-none",
        operatory.isActive
          ? "bg-[#DDF5EB] text-[#176B50]"
          : "bg-[#F1F3F5] text-[#596579]",
      )}
      variant="outline"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          operatory.isActive ? "bg-[#0A9477]" : "bg-[#9AA6B2]",
        )}
      />
      {t(operatory.isActive ? "filters.active" : "filters.inactive")}
    </Badge>
  );
}

function OperatoryFormDialog({
  branchSlug,
  onClose,
  operatory,
  tenantSlug,
}: {
  branchSlug: string;
  onClose: () => void;
  operatory: Operatory | null;
  tenantSlug: string;
}) {
  const { t } = useTranslation("operatories");
  const [code, setCode] = useState(operatory?.code ?? "");
  const [name, setName] = useState(operatory?.name ?? "");
  const [type, setType] = useState<OperatoryType>(operatory?.type ?? "CHAIR");
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateOperatoryMutation();
  const updateMutation = useUpdateOperatoryMutation();
  const pending = createMutation.isPending || updateMutation.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setError(null);
    try {
      if (operatory) {
        await updateMutation.mutateAsync({
          tenantSlug,
          branchSlug,
          operatoryId: operatory.id,
          input: { name: name.trim(), type },
          idempotencyKey: crypto.randomUUID(),
        });
      } else {
        await createMutation.mutateAsync({
          tenantSlug,
          branchSlug,
          input: { code: code.trim(), name: name.trim(), type },
          idempotencyKey: crypto.randomUUID(),
        });
      }
      onClose();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {t(operatory ? "form.editTitle" : "form.createTitle")}
            </DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="operatory-code">{t("list.code")}</Label>
            <Input
              disabled={Boolean(operatory) || pending}
              id="operatory-code"
              maxLength={100}
              onChange={(event) => setCode(event.target.value)}
              required
              value={code}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operatory-name">{t("list.name")}</Label>
            <Input
              disabled={pending}
              id="operatory-name"
              maxLength={150}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operatory-type">{t("form.type")}</Label>
            <Select
              disabled={pending}
              onValueChange={(value) => setType(value as OperatoryType)}
              value={type}
            >
              <SelectTrigger id="operatory-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROOM">{t("types.ROOM")}</SelectItem>
                <SelectItem value="CHAIR">{t("types.CHAIR")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {t("actions.save")}
            </Button>
            <Button onClick={onClose} type="button" variant="outline">
              {t("actions.cancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OperatoryLifecycleDialog({
  branchSlug,
  onClose,
  operatory,
  tenantSlug,
}: {
  branchSlug: string;
  onClose: () => void;
  operatory: Operatory;
  tenantSlug: string;
}) {
  const { t } = useTranslation("operatories");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useChangeOperatoryActivityMutation();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    setError(null);
    try {
      await mutation.mutateAsync({
        tenantSlug,
        branchSlug,
        operatoryId: operatory.id,
        active: !operatory.isActive,
        reason: reason.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      onClose();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {t(
                operatory.isActive
                  ? "lifecycle.deactivateTitle"
                  : "lifecycle.activateTitle",
                { name: operatory.name },
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                operatory.isActive
                  ? "lifecycle.deactivateDescription"
                  : "lifecycle.activateDescription",
              )}
            </DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="operatory-reason">{t("lifecycle.reason")}</Label>
            <Input
              disabled={mutation.isPending}
              id="operatory-reason"
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              required
              value={reason}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              type="submit"
              variant={operatory.isActive ? "destructive" : "default"}
            >
              {t(
                operatory.isActive ? "actions.deactivate" : "actions.activate",
              )}
            </Button>
            <Button onClick={onClose} type="button" variant="outline">
              {t("actions.cancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
