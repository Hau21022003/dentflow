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
import { UserAvatar } from "@/shared/components/UserAvatar";
import { getErrorMessage } from "@/shared/lib/error";
import { StaffActionDialog } from "@/features/staff/components/StaffActionDialog";
import { BranchStaffRoleDialog } from "@/features/staff/components/BranchStaffRoleDialog";
import {
  useBranchStaffQuery,
  useRemoveBranchStaffMutation,
  useResendBranchStaffInvitationMutation,
  useRevokeBranchStaffInvitationMutation,
  useRevokeBranchStaffRoleMutation,
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
import { type ColumnDef, type ColumnFiltersState } from "@tanstack/react-table";
import {
  Ellipsis,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type BranchStaffActionSelection =
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
    }
  | {
      action: "removeFromBranch";
      item: StaffMemberItem;
      kind: "member";
    };

function statusVariant(status: StaffListStatus) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "DISABLED") return "destructive" as const;
  return "secondary" as const;
}

function isManagedRole(roleCode: string): boolean {
  return roleCode === "RECEPTIONIST" || roleCode === "DENTIST";
}

function canManageMember(item: StaffMemberItem): boolean {
  return (
    !item.assignments.some(
      (assignment) =>
        assignment.roleCode === "TENANT_ADMIN" ||
        assignment.roleCode === "BRANCH_ADMIN",
    ) && item.assignments.some((assignment) => isManagedRole(assignment.roleCode))
  );
}

export function BranchStaffManagementPage() {
  const { i18n, t } = useTranslation("staff");
  const { t: tCommon } = useTranslation("common");
  const { branch, branchSlug, tenant, tenantSlug } = useRouteWorkspaceContext();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [grantMember, setGrantMember] = useState<StaffMemberItem | null>(null);
  const [actionSelection, setActionSelection] =
    useState<BranchStaffActionSelection | null>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StaffListStatus | undefined>();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const resendInvitation = useResendBranchStaffInvitationMutation();
  const revokeInvitation = useRevokeBranchStaffInvitationMutation();
  const revokeRole = useRevokeBranchStaffRoleMutation();
  const removeStaff = useRemoveBranchStaffMutation();
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;
  const branchName = branch?.branch.name ?? branchSlug;

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
  const staffQuery = useBranchStaffQuery(tenantSlug, branchSlug, query);
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("table.searchPlaceholder") },
      }),
    [t, tCommon],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN",
        { dateStyle: "medium", timeStyle: "short" },
      ),
    [i18n.resolvedLanguage],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

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
          const memberIsManageable =
            item.kind === "MEMBER" && canManageMember(item);
          return (
            <div className="grid min-w-52 gap-2">
              {assignments.map((assignment) => (
                <div
                  className="flex items-center gap-2"
                  key={`${assignment.roleCode}-${assignment.branchId ?? "branch"}`}
                >
                  <Badge variant="outline">{t(`roles.${assignment.roleCode}`)}</Badge>
                  {item.kind === "MEMBER" &&
                    memberIsManageable &&
                    isManagedRole(assignment.roleCode) &&
                    "id" in assignment && (
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
          const showMemberActions =
            item.kind === "MEMBER" && canManageMember(item);
          if (item.kind === "MEMBER" && !showMemberActions) return null;
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
                        setActionSelection({ action: "resend", item, kind: "invitation" })
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
                          action: "removeFromBranch",
                          item,
                          kind: "member",
                        })
                      }
                      variant="destructive"
                    >
                      <UserMinus aria-hidden="true" />
                      {t("actions.removeFromBranch.label")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [dateFormatter, t],
  );

  async function submitAction(
    reason: string | undefined,
    idempotencyKey: string,
  ) {
    if (!actionSelection) return;
    if (actionSelection.kind === "invitation") {
      if (actionSelection.action === "resend") {
        await resendInvitation.mutateAsync({
          tenantSlug,
          branchSlug,
          invitationId: actionSelection.item.id,
          idempotencyKey,
        });
      } else {
        await revokeInvitation.mutateAsync({
          tenantSlug,
          branchSlug,
          invitationId: actionSelection.item.id,
          input: { reason: reason ?? "" },
          idempotencyKey,
        });
      }
      return;
    }
    if (actionSelection.kind === "assignment") {
      await revokeRole.mutateAsync({
        tenantSlug,
        branchSlug,
        userId: actionSelection.item.id,
        assignmentId: actionSelection.assignment.id,
        input: { reason: reason ?? "" },
        idempotencyKey,
      });
      return;
    }
    await removeStaff.mutateAsync({
      tenantSlug,
      branchSlug,
      userId: actionSelection.item.id,
      input: { reason: reason ?? "" },
      idempotencyKey,
    });
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
          <p className="text-sm font-semibold text-primary">{t("branch.eyebrow")}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("branch.title")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {t("branch.description", { branch: branchName })}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} type="button">
          <UserPlus aria-hidden="true" />
          {t("actions.invite")}
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("table.title")}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("branch.table.description", { tenant: tenantName, branch: branchName })}
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
                setStatus(value === "ALL" ? undefined : (value as StaffListStatus));
                resetToFirstPage();
              }}
              value={status ?? "ALL"}
            >
              <SelectTrigger aria-label={t("table.statusFilter")} className="w-40">
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
                    <EmptyDescription>{getErrorMessage(staffQuery.error)}</EmptyDescription>
                    <Button onClick={() => void staffQuery.refetch()} size="sm" type="button">
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
                    <EmptyDescription>{t("branch.empty.description")}</EmptyDescription>
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
                  pageIndex: next.pageSize === current.pageSize ? next.pageIndex : 0,
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

      <BranchStaffRoleDialog
        branchSlug={branchSlug}
        mode="invite"
        onOpenChange={setInviteOpen}
        open={inviteOpen}
        tenantSlug={tenantSlug}
      />
      {grantMember && (
        <BranchStaffRoleDialog
          branchSlug={branchSlug}
          member={grantMember}
          mode="grant"
          onOpenChange={(open) => {
            if (!open) setGrantMember(null);
          }}
          open
          tenantSlug={tenantSlug}
        />
      )}
      {actionSelection && (
        <StaffActionDialog
          action={actionSelection.action}
          description={actionDescription}
          intentCommand={{
            operation: `branch.staff.${actionSelection.action}`,
            tenantSlug,
            branchSlug,
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
