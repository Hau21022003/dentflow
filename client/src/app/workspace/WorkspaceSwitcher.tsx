import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AuthUser } from "@/features/auth/auth.types";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ChevronsUpDown,
  GitBranch,
  LoaderCircle,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useWorkspaceBranchOptions,
  type WorkspaceBranchOption,
} from "./workspace-branch-options";
import {
  canUseTenantWorkspaceHome,
  type NavigationWorkspaceContext,
  type WorkspaceSelection,
} from "./workspace-context";

type WorkspaceSwitcherProps = {
  branchOptions: readonly WorkspaceBranchOption[];
  context: NavigationWorkspaceContext;
  isLoadingBranchOptions: boolean;
  onSelect: (selection: WorkspaceSelection) => void;
  user: AuthUser;
};

/**
 * Bộ chọn workspace phân cấp duy nhất của header. Người dùng chọn phòng khám
 * trước, sau đó chọn phạm vi toàn tenant hoặc một branch. Danh sách branch chỉ
 * được lấy cho tenant đang mở để không tải toàn bộ branch của mọi tenant cùng
 * lúc; quyền và trạng thái ACTIVE vẫn do các hook/route guard xác minh.
 */
export function WorkspaceSwitcher({
  branchOptions: currentBranchOptions,
  context,
  isLoadingBranchOptions: isLoadingCurrentBranchOptions,
  onSelect,
  user,
}: WorkspaceSwitcherProps) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [focusedTenantSlug, setFocusedTenantSlug] = useState<string | null>(
    null,
  );
  const focusedTenant = user.authorization.tenants.find(
    ({ tenant }) => tenant.slug === focusedTenantSlug,
  );
  const {
    branchOptions: focusedBranchOptions,
    isLoading: isLoadingFocusedBranchOptions,
  } = useWorkspaceBranchOptions(user, focusedTenant?.tenant.slug);
  const isFocusedCurrentTenant =
    focusedTenant?.tenant.slug === context.tenantSlug;
  const branchOptions = isFocusedCurrentTenant
    ? currentBranchOptions
    : focusedBranchOptions;
  const isLoadingBranchOptions = isFocusedCurrentTenant
    ? isLoadingCurrentBranchOptions
    : isLoadingFocusedBranchOptions;
  const currentBranchName = context.branchSlug
    ? (currentBranchOptions.find((branch) => branch.slug === context.branchSlug)
        ?.name ?? context.branchSlug)
    : t("layout.allTenant");

  /** Đóng popover sau khi route mới được tạo từ một selection đã hiển thị. */
  function selectWorkspace(selection: WorkspaceSelection) {
    setIsOpen(false);
    setFocusedTenantSlug(null);
    onSelect(selection);
  }

  /** Mỗi lần đóng popover, quay về cấp tenant để lần mở sau có điểm bắt đầu rõ ràng. */
  function changeOpen(nextOpen: boolean) {
    setIsOpen(nextOpen);

    if (!nextOpen) {
      setFocusedTenantSlug(null);
    }
  }

  const canSelectTenantScope = Boolean(
    focusedTenant && canUseTenantWorkspaceHome(user, focusedTenant.tenant.slug),
  );

  return (
    <Popover onOpenChange={changeOpen} open={isOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label={t("layout.workspaceSelector")}
          aria-expanded={isOpen}
          className="h-10 min-w-0 flex-1 justify-start gap-2 px-2.5 text-left sm:max-w-72 lg:w-72 lg:flex-none"
          type="button"
          variant="outline"
        >
          <Building2
            aria-hidden="true"
            className="size-4 shrink-0 text-primary"
          />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">
              {context.tenant.tenant.displayName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {currentBranchName}
            </span>
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0"
      >
        {focusedTenant ? (
          <>
            <div className="flex items-center gap-2 border-b border-border/80 px-2 py-2">
              <Button
                aria-label={t("layout.workspaceBack")}
                onClick={() => setFocusedTenantSlug(null)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <span className="min-w-0 truncate text-sm font-semibold">
                {focusedTenant.tenant.displayName}
              </span>
            </div>
            <Command key={focusedTenant.tenant.slug}>
              <CommandInput placeholder={t("layout.workspaceSearchBranches")} />
              <CommandList>
                {isLoadingBranchOptions ? (
                  <div
                    className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground"
                    role="status"
                  >
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    {t("layout.workspaceLoadingBranches")}
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      {t("layout.workspaceNoResults")}
                    </CommandEmpty>
                    {canSelectTenantScope && (
                      <CommandGroup heading={t("layout.workspaceScope")}>
                        <CommandItem
                          data-checked={
                            context.tenantSlug === focusedTenant.tenant.slug &&
                            !context.branchSlug
                          }
                          onSelect={() =>
                            selectWorkspace({
                              branchSlug: null,
                              tenantSlug: focusedTenant.tenant.slug,
                            })
                          }
                          value={t("layout.allTenant")}
                        >
                          <Building2
                            aria-hidden="true"
                            className="size-4 text-primary"
                          />
                          <span>{t("layout.allTenant")}</span>
                        </CommandItem>
                      </CommandGroup>
                    )}
                    <CommandGroup heading={t("layout.workspaceBranches")}>
                      {branchOptions.map((branch) => {
                        const isCurrentBranch =
                          context.tenantSlug === focusedTenant.tenant.slug &&
                          context.branchSlug === branch.slug;

                        return (
                          <CommandItem
                            className={
                              isCurrentBranch
                                ? "bg-muted hover:bg-muted data-selected:bg-muted"
                                : "bg-transparent hover:bg-muted data-selected:bg-transparent"
                            }
                            data-checked={isCurrentBranch}
                            key={branch.slug}
                            onSelect={() =>
                              selectWorkspace({
                                branchSlug: branch.slug,
                                tenantSlug: focusedTenant.tenant.slug,
                              })
                            }
                            value={branch.name}
                          >
                            <GitBranch
                              aria-hidden="true"
                              className="size-4 text-muted-foreground"
                            />
                            <span>{branch.name}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </>
        ) : (
          <Command key="tenant-list">
            <CommandInput placeholder={t("layout.workspaceSearchPractices")} />
            <CommandList>
              <CommandEmpty>{t("layout.workspaceNoResults")}</CommandEmpty>
              <CommandGroup heading={t("layout.workspacePractices")}>
                {user.authorization.tenants.map(({ tenant }) => (
                  <CommandItem
                    className={
                      context.tenantSlug === tenant.slug
                        ? "bg-muted hover:bg-muted data-selected:bg-muted [&>svg:last-child]:hidden"
                        : "bg-transparent hover:bg-muted data-selected:bg-transparent [&>svg:last-child]:hidden"
                    }
                    key={tenant.id}
                    onSelect={() => setFocusedTenantSlug(tenant.slug)}
                    value={tenant.displayName}
                  >
                    <Building2
                      aria-hidden="true"
                      className="size-4 text-primary"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {tenant.displayName}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="ml-auto size-4 text-muted-foreground"
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
