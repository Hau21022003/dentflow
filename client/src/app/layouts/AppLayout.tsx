import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLogoutMutation } from "@/features/auth/auth.hooks";
import { useAuthStore } from "@/features/auth/auth.store";
import { PERMISSIONS } from "@/features/auth/auth.types";
import {
  findTenantAuthorization,
  hasBranchAccess,
  hasBranchPermission,
  hasPlatformPermission,
  hasTenantPermission,
} from "@/features/auth/authorization";
import { cn } from "@/shared/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  LayoutDashboard,
  Mail,
  Menu,
  ShieldCheck,
  Stethoscope,
  Tags,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { PATHS, pathFor } from "../router/paths";

type NavigationLink = {
  end?: boolean;
  icon: LucideIcon;
  kind: "link";
  label: string;
  to: string;
};

type NavigationGroup = {
  icon: LucideIcon;
  items: NavigationLink[];
  key: "tenant" | "branch";
  kind: "group";
  label: string;
};

type NavigationItem = NavigationLink | NavigationGroup;

type BranchOption = {
  branchName: string;
  branchSlug: string;
  tenantSlug: string;
  value: string;
};

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

function isActiveRoute(item: NavigationLink, pathname: string): boolean {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

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

function SidebarNavigation({
  expandedGroups,
  items,
  navigationLabel,
  onNavigate,
  onToggleGroup,
  pathname,
}: {
  expandedGroups: Partial<Record<NavigationGroup["key"], boolean>>;
  items: NavigationItem[];
  navigationLabel: string;
  onNavigate?: () => void;
  onToggleGroup: (key: NavigationGroup["key"]) => void;
  pathname: string;
}) {
  return (
    <nav aria-label={navigationLabel} className="space-y-1">
      {items.map((item) => {
        if (item.kind === "link") {
          const Icon = item.icon;

          return (
            <NavLink
              className={({ isActive }) => sidebarLinkClass(isActive)}
              end={item.end}
              key={item.to}
              onClick={onNavigate}
              to={item.to}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        }

        const Icon = item.icon;
        const isExpanded =
          expandedGroups[item.key] ??
          item.items.some((child) => isActiveRoute(child, pathname));
        const submenuId = `sidebar-navigation-${item.key}`;

        return (
          <section className="pt-3 first:pt-0" key={item.key}>
            <button
              aria-controls={submenuId}
              aria-expanded={isExpanded}
              className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              onClick={() => onToggleGroup(item.key)}
              type="button"
            >
              <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-primary"
              />
              <span className="flex-1">{item.label}</span>
              {isExpanded ? (
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
              ) : (
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
              )}
            </button>
            {isExpanded && (
              <div
                className="mt-1 space-y-1 border-l border-border/80 pl-3"
                id={submenuId}
              >
                {item.items.map((child) => {
                  const ChildIcon = child.icon;

                  return (
                    <NavLink
                      className={({ isActive }) => sidebarLinkClass(isActive)}
                      end={child.end}
                      key={child.to}
                      onClick={onNavigate}
                      to={child.to}
                    >
                      <ChildIcon
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />
                      <span>{child.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </nav>
  );
}

export function AppLayout() {
  const { i18n, t } = useTranslation("common");
  const location = useLocation();
  const navigate = useNavigate();
  const { branchSlug, tenantSlug } = useParams();
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogoutMutation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<
    Partial<Record<NavigationGroup["key"], boolean>>
  >({});
  const language = i18n.resolvedLanguage === "en" ? "en" : "vi";
  const tenant = tenantSlug
    ? findTenantAuthorization(user, { slug: tenantSlug })
    : undefined;
  const branchAccess = Boolean(
    tenantSlug &&
    branchSlug &&
    hasBranchAccess(user, { slug: tenantSlug }, branchSlug),
  );

  const navigation = useMemo<NavigationItem[]>(() => {
    const items: NavigationItem[] = [];

    if (hasPlatformPermission(user, PERMISSIONS.platformSystemRead)) {
      items.push({
        end: true,
        icon: ShieldCheck,
        kind: "link",
        label: t("navigation.platform"),
        to: PATHS.platform,
      });
    }

    if (hasPlatformPermission(user, PERMISSIONS.platformTenantManage)) {
      items.push({
        end: false,
        icon: Building2,
        kind: "link",
        label: t("navigation.tenants"),
        to: PATHS.platformTenants,
      });
    }

    if (hasPlatformPermission(user, PERMISSIONS.platformPlanManage)) {
      items.push({
        end: true,
        icon: Tags,
        kind: "link",
        label: t("navigation.plans"),
        to: PATHS.platformPlans,
      });
    }

    if (hasPlatformPermission(user, PERMISSIONS.platformEmailTemplateManage)) {
      items.push({
        end: false,
        icon: Mail,
        kind: "link",
        label: t("navigation.emailTemplates"),
        to: PATHS.platformEmailTemplates,
      });
    }

    if (tenantSlug && tenant) {
      const tenantItems: NavigationLink[] = [];

      if (
        hasTenantPermission(
          user,
          { slug: tenantSlug },
          PERMISSIONS.tenantSettingsManage,
        )
      ) {
        tenantItems.push({
          end: true,
          icon: LayoutDashboard,
          kind: "link",
          label: t("navigation.tenantOverview"),
          to: pathFor.workspaceTenantHome(tenantSlug),
        });
      }

      if (
        hasTenantPermission(
          user,
          { slug: tenantSlug },
          PERMISSIONS.branchManage,
        )
      ) {
        tenantItems.push({
          end: true,
          icon: Building2,
          kind: "link",
          label: t("navigation.branches"),
          to: pathFor.workspaceTenantBranches(tenantSlug),
        });
      }

      if (
        hasTenantPermission(
          user,
          { slug: tenantSlug },
          PERMISSIONS.staffManage,
        )
      ) {
        tenantItems.push({
          end: true,
          icon: UsersRound,
          kind: "link",
          label: t("navigation.staff"),
          to: pathFor.workspaceTenantStaff(tenantSlug),
        });
      }

      if (tenantItems.length > 0) {
        items.push({
          icon: Building2,
          items: tenantItems,
          key: "tenant",
          kind: "group",
          label: t("navigation.tenantAdministration"),
        });
      }
    }

    if (tenantSlug && branchSlug && branchAccess) {
      const branchItems: NavigationLink[] = [
        {
          end: true,
          icon: LayoutDashboard,
          kind: "link",
          label: t("navigation.branchOverview"),
          to: pathFor.workspaceBranch(tenantSlug, branchSlug),
        },
      ];

      if (
        hasBranchPermission(
          user,
          { slug: tenantSlug },
          branchSlug,
          PERMISSIONS.appointmentManage,
        )
      ) {
        branchItems.push({
          end: true,
          icon: CalendarDays,
          kind: "link",
          label: t("navigation.appointments"),
          to: pathFor.workspaceReceptionAppointments(tenantSlug, branchSlug),
        });
      }

      if (
        hasBranchPermission(
          user,
          { slug: tenantSlug },
          branchSlug,
          PERMISSIONS.appointmentAssignedRead,
        )
      ) {
        branchItems.push({
          end: true,
          icon: Stethoscope,
          kind: "link",
          label: t("navigation.doctorWorkspace"),
          to: pathFor.workspaceDoctor(tenantSlug, branchSlug),
        });
      }

      items.push({
        icon: ClipboardList,
        items: branchItems,
        key: "branch",
        kind: "group",
        label: t("navigation.branchOperations"),
      });
    }

    return items;
  }, [branchAccess, branchSlug, t, tenant, tenantSlug, user]);

  const branchOptions = useMemo<BranchOption[]>(
    () =>
      user?.authorization.tenants.flatMap(
        ({ branches, tenant: authorizedTenant }) =>
          branches.map(({ branch }) => ({
            branchName: branch.name,
            branchSlug: branch.slug,
            tenantSlug: authorizedTenant.slug,
            value: `${authorizedTenant.slug}:${branch.slug}`,
          })),
      ) ?? [],
    [user],
  );

  const selectedBranch = branchOptions.find(
    (option) =>
      option.tenantSlug === tenantSlug && option.branchSlug === branchSlug,
  );

  function handleNavigation() {
    setMobileNavigationOpen(false);
    setExpandedGroups({});
  }

  function toggleGroup(key: NavigationGroup["key"]) {
    const group = navigation.find(
      (item): item is NavigationGroup =>
        item.kind === "group" && item.key === key,
    );
    const isExpanded =
      expandedGroups[key] ??
      group?.items.some((child) => isActiveRoute(child, location.pathname)) ??
      false;

    setExpandedGroups((current) => ({ ...current, [key]: !isExpanded }));
  }

  function changeLanguage(nextLanguage: string) {
    void i18n.changeLanguage(nextLanguage);
  }

  function changeBranch(value: string) {
    const branch = branchOptions.find((option) => option.value === value);

    if (branch) {
      handleNavigation();
      navigate(pathFor.workspaceBranch(branch.tenantSlug, branch.branchSlug));
    }
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
      expandedGroups={expandedGroups}
      items={navigation}
      navigationLabel={t("layout.primaryNavigation")}
      onNavigate={handleNavigation}
      onToggleGroup={toggleGroup}
      pathname={location.pathname}
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
          <div
            className="mb-2 flex min-w-0 items-center gap-3 px-3 py-2"
            title={user?.email}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <CircleUserRound aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {user?.fullName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user?.email}
              </span>
            </span>
          </div>
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
              expandedGroups={expandedGroups}
              items={navigation}
              navigationLabel={t("layout.primaryNavigation")}
              onNavigate={handleNavigation}
              onToggleGroup={toggleGroup}
              pathname={location.pathname}
            />
          </div>
          <div className="border-t border-border/80 p-3">
            <p
              className="truncate px-3 py-2 text-sm font-semibold"
              title={user?.fullName}
            >
              {user?.fullName}
            </p>
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

            <div className="flex flex-1 justify-end items-center gap-2 sm:gap-3">
              {branchAccess && selectedBranch && (
                <Select
                  onValueChange={changeBranch}
                  value={selectedBranch.value}
                >
                  <SelectTrigger
                    aria-label={t("layout.branchSelector")}
                    className="h-9 min-w-0 max-w-52 flex-1 sm:max-w-64 lg:max-w-72 lg:flex-none"
                  >
                    <Building2
                      aria-hidden="true"
                      className="size-4 shrink-0 text-primary"
                    />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {user?.authorization.tenants.map(
                      ({ branches, tenant: authorizedTenant }) =>
                        branches.length > 0 ? (
                          <SelectGroup key={authorizedTenant.id}>
                            <SelectLabel>
                              {authorizedTenant.displayName}
                            </SelectLabel>
                            {branches.map(({ branch }) => (
                              <SelectItem
                                key={branch.id}
                                value={`${authorizedTenant.slug}:${branch.slug}`}
                              >
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ) : null,
                    )}
                  </SelectContent>
                </Select>
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
