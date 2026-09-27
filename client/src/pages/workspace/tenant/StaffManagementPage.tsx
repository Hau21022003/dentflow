import { DataTable } from "@/components/shadcntable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/UserAvatar";
import { authQueryKeys } from "@/features/auth/auth.hooks";
import { authService } from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { StaffActionDialog } from "@/features/staff/components/StaffActionDialog";
import { StaffRoleAssignmentDialog } from "@/features/staff/components/StaffRoleAssignmentDialog";
import {
  useDisableStaffMutation,
  useEnableStaffMutation,
  useResendStaffInvitationMutation,
  useRevokeStaffInvitationMutation,
  useRevokeStaffRoleMutation,
  useTenantStaffBranchesQuery,
  useTenantStaffQuery,
} from "@/features/staff/staff.hooks";
import type {
  StaffAssignment,
  StaffInvitationItem,
  StaffListItem,
  StaffListQuery,
  StaffListStatus,
  StaffMemberItem,
} from "@/features/staff/staff.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import { useQueryClient } from "@tanstack/react-query";
import { type ColumnDef, type ColumnFiltersState } from "@tanstack/react-table";
import {
  Ellipsis,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type StaffActionSelection =
  | {
      action: "disable" | "enable";
      item: StaffMemberItem;
      kind: "member";
    }
  | {
      action: "resend" | "revokeInvitation";
      item: StaffInvitationItem;
      kind: "invitation";
    }
  | {
      action: "revokeRole";
      assignment: StaffAssignment;
      item: StaffMemberItem;
      kind: "assignment";
    };

function statusVariant(status: StaffListStatus) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "DISABLED") return "destructive" as const;
  return "secondary" as const;
}

export function StaffManagementPage() {
  const { i18n, t } = useTranslation("staff");
  const { t: tCommon } = useTranslation("common");
  const { tenant, tenantSlug } = useRouteWorkspaceContext();
  const queryClient = useQueryClient();
  const setAuthenticatedUser = useAuthStore(
    (state) => state.setAuthenticatedUser,
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [grantMember, setGrantMember] = useState<StaffMemberItem | null>(null);
  const [actionSelection, setActionSelection] =
    useState<StaffActionSelection | null>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StaffListStatus | undefined>();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const disableMutation = useDisableStaffMutation();
  const enableMutation = useEnableStaffMutation();
  const resendMutation = useResendStaffInvitationMutation();
  const revokeInvitationMutation = useRevokeStaffInvitationMutation();
  const revokeRoleMutation = useRevokeStaffRoleMutation();
  const staffBranchesQuery = useTenantStaffBranchesQuery(tenantSlug);
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(globalFilter.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const query = useMemo<StaffListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status ? { status } : {}),
    }),
    [debouncedSearch, pagination, status],
  );
  const staffQuery = useTenantStaffQuery(tenantSlug, query);
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("table.searchPlaceholder") },
      }),
    [t, tCommon],
  );
  const branchesById = useMemo(
    () =>
      new Map(
        (staffBranchesQuery.data ?? []).map((branch) => [branch.id, branch]),
      ),
    [staffBranchesQuery.data],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN",
        {
          dateStyle: "medium",
          timeStyle: "short",
        },
      ),
    [i18n.resolvedLanguage],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  async function refreshAuthorization() {
    const user = await authService.getMe();
    queryClient.setQueryData(authQueryKeys.me(), user);
    setAuthenticatedUser(user);
  }

  const assignmentScope = useCallback(
    (assignment: { roleCode: string; branchId: string | null }) => {
      if (!assignment.branchId) return t("scope.tenantWide");
      const branch = branchesById.get(assignment.branchId);
      return branch
        ? `${branch.name}${branch.status === "INACTIVE" ? ` · ${t("scope.inactive")}` : ""}`
        : t("scope.unavailable");
    },
    [branchesById, t],
  );

  const columns = useMemo<ColumnDef<StaffListItem>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: () => <span>{t("table.staff")}</span>,
        cell: ({ row }) => (
          <div className="flex min-w-56 items-center gap-3">
            {row.original.kind === "INVITATION" ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Mail aria-hidden="true" className="size-4" />
              </span>
            ) : (
              <UserAvatar
                avatarUrl={row.original.avatarUrl}
                fullName={row.original.fullName}
              />
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {row.original.fullName}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {row.original.email}
              </span>
            </span>
          </div>
        ),
      },
      {
        id: "assignments",
        header: () => <span>{t("table.access")}</span>,
        cell: ({ row }) => {
          const item = row.original;
          const assignments =
            item.kind === "INVITATION"
              ? item.invitation.proposedAssignments
              : item.assignments;
          return (
            <div className="grid min-w-52 gap-2">
              {assignments.map((assignment) => (
                <div
                  className="flex items-center gap-2"
                  key={`${assignment.roleCode}-${assignment.branchId ?? "tenant"}`}
                >
                  <Badge variant="outline">
                    {t(`roles.${assignment.roleCode}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {assignmentScope(assignment)}
                  </span>
                  {item.kind === "MEMBER" && "id" in assignment && (
                    <Button
                      aria-label={t("actions.revokeRole.label", {
                        role: t(`roles.${assignment.roleCode}`),
                      })}
                      className="size-6"
                      onClick={() =>
                        setActionSelection({
                          action: "revokeRole",
                          assignment: assignment as StaffAssignment,
                          item,
                          kind: "assignment",
                        })
                      }
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: () => <span>{t("table.status")}</span>,
        cell: ({ row }) => (
          <div className="grid gap-1">
            <Badge variant={statusVariant(row.original.status)}>
              {t(`status.${row.original.status}`)}
            </Badge>
            {row.original.kind === "INVITATION" && (
              <>
                <span className="text-xs text-muted-foreground">
                  {t(`delivery.${row.original.invitation.deliveryStatus}`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("table.expiresAt", {
                    date: dateFormatter.format(
                      new Date(row.original.invitation.expiresAt),
                    ),
                  })}
                </span>
              </>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">{t("table.actions")}</span>,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("actions.openMenu", { name: item.fullName })}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Ellipsis aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {item.kind === "INVITATION" ? (
                  <>
                    <DropdownMenuItem
                      onSelect={() =>
                        setActionSelection({
                          action: "resend",
                          item,
                          kind: "invitation",
                        })
                      }
                    >
                      <RefreshCw aria-hidden="true" />
                      {t("actions.resend.label")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        setActionSelection({
                          action: "revokeInvitation",
                          item,
                          kind: "invitation",
                        })
                      }
                      variant="destructive"
                    >
                      <X aria-hidden="true" />
                      {t("actions.revokeInvitation.label")}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {item.status === "ACTIVE" && (
                      <DropdownMenuItem onSelect={() => setGrantMember(item)}>
                        <ShieldCheck aria-hidden="true" />
                        {t("actions.grantRoles")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() =>
                        setActionSelection({
                          action:
                            item.status === "ACTIVE" ? "disable" : "enable",
                          item,
                          kind: "member",
                        })
                      }
                      variant={
                        item.status === "ACTIVE" ? "destructive" : "default"
                      }
                    >
                      {item.status === "ACTIVE" ? (
                        <X aria-hidden="true" />
                      ) : (
                        <ShieldCheck aria-hidden="true" />
                      )}
                      {t(
                        `actions.${item.status === "ACTIVE" ? "disable" : "enable"}.label`,
                      )}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [assignmentScope, dateFormatter, t],
  );

  async function submitAction(
    reason: string | undefined,
    idempotencyKey: string,
  ) {
    if (!actionSelection) return;
    if (actionSelection.kind === "member") {
      const command = {
        tenantSlug,
        userId: actionSelection.item.id,
        input: { reason: reason ?? "" },
        idempotencyKey,
      };
      if (actionSelection.action === "disable") {
        await disableMutation.mutateAsync(command);
      } else {
        await enableMutation.mutateAsync(command);
      }
      await refreshAuthorization();
      return;
    }
    if (actionSelection.kind === "invitation") {
      if (actionSelection.action === "resend") {
        await resendMutation.mutateAsync({
          tenantSlug,
          invitationId: actionSelection.item.id,
          idempotencyKey,
        });
      } else {
        await revokeInvitationMutation.mutateAsync({
          tenantSlug,
          invitationId: actionSelection.item.id,
          input: { reason: reason ?? "" },
          idempotencyKey,
        });
      }
      return;
    }
    await revokeRoleMutation.mutateAsync({
      tenantSlug,
      userId: actionSelection.item.id,
      assignmentId: actionSelection.assignment.id,
      input: { reason: reason ?? "" },
      idempotencyKey,
    });
    await refreshAuthorization();
  }

  const actionDescription = actionSelection
    ? actionSelection.kind === "assignment"
      ? t("actions.revokeRole.description", {
          name: actionSelection.item.fullName,
          role: t(`roles.${actionSelection.assignment.roleCode}`),
        })
      : t(`actions.${actionSelection.action}.description`, {
          name: actionSelection.item.fullName,
        })
    : "";

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </div>
        <Button
          disabled={staffBranchesQuery.isLoading}
          onClick={() => setInviteOpen(true)}
          type="button"
        >
          <UserPlus aria-hidden="true" />
          {t("actions.invite")}
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("table.title")}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("table.description", { tenant: tenantName })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {staffQuery.isFetching && !staffQuery.isLoading && (
              <RefreshCw
                aria-label={t("loading")}
                className="size-4 animate-spin text-muted-foreground"
              />
            )}
            <Select
              onValueChange={(value) => {
                setStatus(
                  value === "ALL" ? undefined : (value as StaffListStatus),
                );
                resetToFirstPage();
              }}
              value={status ?? "ALL"}
            >
              <SelectTrigger
                aria-label={t("table.statusFilter")}
                className="w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("status.ALL")}</SelectItem>
                <SelectItem value="ACTIVE">{t("status.ACTIVE")}</SelectItem>
                <SelectItem value="DISABLED">{t("status.DISABLED")}</SelectItem>
                <SelectItem value="INVITED">{t("status.INVITED")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={staffQuery.data?.items ?? []}
            emptyState={
              staffQuery.isError ? (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersRound aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("errors.listTitle")}</EmptyTitle>
                    <EmptyDescription>
                      {getErrorMessage(staffQuery.error)}
                    </EmptyDescription>
                    <Button
                      onClick={() => void staffQuery.refetch()}
                      size="sm"
                      type="button"
                    >
                      {t("actions.retry")}
                    </Button>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersRound aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("empty.title")}</EmptyTitle>
                    <EmptyDescription>
                      {t("empty.description")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            }
            isFetching={staffQuery.isFetching}
            isLoading={staffQuery.isLoading}
            locale={dataTableLocale}
            pagination={{
              manual: true,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              rowCount: staffQuery.data?.meta.total ?? 0,
              onPaginationChange: (next) =>
                setPagination((current) => ({
                  pageIndex:
                    next.pageSize === current.pageSize ? next.pageIndex : 0,
                  pageSize: next.pageSize,
                })),
            }}
            serverState={{
              filtering: {
                globalFilter,
                columnFilters,
                onGlobalFilterChange: (next) => {
                  setGlobalFilter(next);
                  resetToFirstPage();
                },
                onColumnFiltersChange: setColumnFilters,
              },
            }}
            toolbar={{ search: true, viewOptions: true }}
          />
        </CardContent>
      </Card>

      <StaffRoleAssignmentDialog
        branches={staffBranchesQuery.data ?? []}
        mode="invite"
        onOpenChange={setInviteOpen}
        open={inviteOpen}
        tenantSlug={tenantSlug}
      />
      {grantMember && (
        <StaffRoleAssignmentDialog
          branches={staffBranchesQuery.data ?? []}
          member={grantMember}
          mode="grant"
          onOpenChange={(open) => {
            if (!open) setGrantMember(null);
          }}
          onSuccess={refreshAuthorization}
          open
          tenantSlug={tenantSlug}
        />
      )}
      {actionSelection && (
        <StaffActionDialog
          action={actionSelection.action}
          description={actionDescription}
          intentCommand={{
            operation: `tenant.staff.${actionSelection.action}`,
            tenantSlug,
            targetId:
              actionSelection.kind === "assignment"
                ? actionSelection.assignment.id
                : actionSelection.item.id,
          }}
          onOpenChange={(open) => {
            if (!open) setActionSelection(null);
          }}
          onSubmit={submitAction}
          open
        />
      )}
    </div>
  );
}
