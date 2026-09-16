import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLogoutMutation } from "@/features/auth/auth.hooks";
import { useAuthStore } from "@/features/auth/auth.store";
import { cn } from "@/shared/lib/utils";
import { UserAvatar } from "@/shared/components/UserAvatar";
import {
  Bell,
  Menu,
  Stethoscope,
  UserRoundCog,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";
import { WorkspaceSwitcher } from "../workspace/WorkspaceSwitcher";
import type { WorkspaceSelection } from "../workspace/workspace-context";
import { useNavigationWorkspaceContext } from "../workspace/use-navigation-workspace-context";
import {
  resolveNavigationSections,
  type NavigationSection,
} from "../workspace/workspace-navigation";
import { PATHS, pathFor } from "../router/paths";

function LanguageFlag({ language }: { language: "en" | "vi" }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-border/50"
    >
      <span
        className={cn("fi fis text-xl", language === "en" ? "fi-us" : "fi-vn")}
      />
    </span>
  );
}

const sidebarLinkClass = (isActive: boolean) =>
  cn(
    "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-secondary text-secondary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      className="flex items-center gap-2.5 text-foreground"
      onClick={onNavigate}
      to={PATHS.root}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Stethoscope aria-hidden="true" className="size-5" />
      </span>
      <span className="text-lg font-bold tracking-tight">DentFlow</span>
    </Link>
  );
}

/**
 * Chỉ render navigation đã được resolve ở workspace-navigation. Component này
 * không tự kiểm tra quyền để tránh hai nguồn policy khác nhau giữa desktop và
 * mobile sidebar.
 */
function SidebarNavigation({
  sections,
  navigationLabel,
  onNavigate,
}: {
  sections: NavigationSection[];
  navigationLabel: string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation("common");

  return (
    <nav aria-label={navigationLabel} className="space-y-5">
      {sections.map((section) => (
        <section key={section.id}>
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(section.labelKey)}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  className={({ isActive }) => sidebarLinkClass(isActive)}
                  end={item.end}
                  key={item.id}
                  onClick={onNavigate}
                  to={item.to}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

/**
 * Khung ứng dụng dùng chung: nhận context đã được xác minh để điều phối bộ
 * chọn tenant/branch và render cùng một navigation cho cả desktop lẫn mobile.
 */
export function AppLayout() {
  const { i18n, t } = useTranslation("common");
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogoutMutation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const language = i18n.resolvedLanguage === "en" ? "en" : "vi";
  const {
    branchOptions,
    context: workspaceContext,
    isLoadingBranchOptions,
  } = useNavigationWorkspaceContext();
  const navigationSections = useMemo(
    () => resolveNavigationSections(user, workspaceContext),
    [user, workspaceContext],
  );

  /** Dùng chung cho link và bộ chọn để đóng sidebar di động sau khi đổi ngữ cảnh. */
  function handleNavigation() {
    setMobileNavigationOpen(false);
  }

  function changeLanguage(nextLanguage: string) {
    void i18n.changeLanguage(nextLanguage);
  }

  /**
   * Đổi workspace từ lựa chọn đã được switcher dựng theo authorization snapshot.
   * Hàm chỉ tạo route; route guard và API vẫn xác minh scope độc lập với UI.
   */
  function changeWorkspace(selection: WorkspaceSelection) {
    handleNavigation();
    navigate(
      selection.branchSlug
        ? pathFor.workspaceBranch(selection.tenantSlug, selection.branchSlug)
        : pathFor.workspaceTenantHome(selection.tenantSlug),
    );
  }

  async function logout() {
    try {
      await logoutMutation.mutateAsync();
      navigate(PATHS.login, { replace: true });
    } catch {
      // Keep the current session visible when logout cannot be confirmed.
    }
  }

  const sidebarNavigation = (
    <SidebarNavigation
      navigationLabel={t("layout.primaryNavigation")}
      onNavigate={handleNavigation}
      sections={navigationSections}
    />
  );

  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside
        aria-label={t("layout.sidebar")}
        className="hidden h-svh flex-col border-r border-border/80 bg-card lg:sticky lg:top-0 lg:flex"
      >
        <div className="flex h-16 items-center border-b border-border/80 px-5">
          <SidebarBrand />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {sidebarNavigation}
        </div>
        <div className="border-t border-border/80 p-3">
          <Link
            aria-label={t("layout.userAccount")}
            className="mb-2 flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
            title={user?.email}
            to={PATHS.profile}
          >
            <UserAvatar
              avatarUrl={user?.avatarUrl}
              fullName={user?.fullName ?? ""}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {user?.fullName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user?.email}
              </span>
            </span>
          </Link>
          <Button
            className="w-full justify-start"
            disabled={logoutMutation.isPending}
            onClick={() => void logout()}
            type="button"
            variant="ghost"
          >
            <UserRoundCog aria-hidden="true" />
            {logoutMutation.isPending
              ? t("layout.loggingOut")
              : t("layout.logout")}
          </Button>
        </div>
      </aside>

      <Sheet onOpenChange={setMobileNavigationOpen} open={mobileNavigationOpen}>
        <SheetContent aria-describedby={undefined} className="lg:hidden">
          <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
            <SheetTitle>{t("layout.primaryNavigation")}</SheetTitle>
            <SheetCloseButton aria-label={t("layout.closeNavigation")} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-6 px-2">
              <SidebarBrand onNavigate={handleNavigation} />
            </div>
            <SidebarNavigation
              navigationLabel={t("layout.primaryNavigation")}
              onNavigate={handleNavigation}
              sections={navigationSections}
            />
          </div>
          <div className="border-t border-border/80 p-3">
            <Link
              aria-label={t("layout.userAccount")}
              className="mb-2 flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
              title={user?.fullName}
              to={PATHS.profile}
            >
              <UserAvatar
                avatarUrl={user?.avatarUrl}
                fullName={user?.fullName ?? ""}
              />
              <span className="truncate text-sm font-semibold">
                {user?.fullName}
              </span>
            </Link>
            <Button
              className="w-full justify-start"
              disabled={logoutMutation.isPending}
              onClick={() => void logout()}
              type="button"
              variant="ghost"
            >
              <UserRoundCog aria-hidden="true" />
              {logoutMutation.isPending
                ? t("layout.loggingOut")
                : t("layout.logout")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 h-16 border-b border-border/80 bg-background/90 backdrop-blur">
          <div className="flex h-full min-w-0 items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <Button
              aria-label={t("layout.openNavigation")}
              className="lg:hidden"
              onClick={() => setMobileNavigationOpen(true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Menu aria-hidden="true" />
            </Button>

            <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
              {workspaceContext && user && (
                <WorkspaceSwitcher
                  branchOptions={branchOptions}
                  context={workspaceContext}
                  isLoadingBranchOptions={isLoadingBranchOptions}
                  onSelect={changeWorkspace}
                  user={user}
                />
              )}
              <Button
                aria-label={t("layout.notificationsComingSoon")}
                className="h-9 w-9 rounded-full border-0 bg-primary/20 text-foreground hover:bg-primary/15 hover:text-foreground disabled:opacity-100"
                disabled
                size="icon"
                title={t("layout.notificationsComingSoon")}
                type="button"
                variant="ghost"
              >
                <Bell aria-hidden="true" />
              </Button>
              <Select onValueChange={changeLanguage} value={language}>
                <SelectTrigger
                  aria-label={t("layout.languageSelector")}
                  className="h-9 w-9 shrink-0 justify-center px-0 [&>svg]:hidden"
                >
                  <LanguageFlag language={language} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem aria-label={t("language.vietnamese")} value="vi">
                    <span className="flex items-center gap-2">
                      <LanguageFlag language="vi" />
                      <span>VI</span>
                    </span>
                  </SelectItem>
                  <SelectItem aria-label={t("language.english")} value="en">
                    <span className="flex items-center gap-2">
                      <LanguageFlag language="en" />
                      <span>EN</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
