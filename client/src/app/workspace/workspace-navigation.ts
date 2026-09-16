import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Stethoscope,
  Tags,
  UsersRound,
} from "lucide-react";
import {
  hasBranchAccess,
  hasBranchPermission,
  hasPlatformPermission,
  hasTenantPermission,
} from "@/features/auth/authorization";
import { PERMISSIONS, type AuthUser, type Permission } from "@/features/auth/auth.types";
import { PATHS, pathFor } from "@/app/router/paths";
import type { NavigationWorkspaceContext } from "./workspace-context";

export type NavigationSectionId = "management" | "platform" | "work";

type NavigationScope = "branch" | "platform" | "tenant";

type NavigationItem = {
  end?: boolean;
  group: NavigationSectionId;
  icon: LucideIcon;
  id: string;
  labelKey: string;
  order: number;
  permission?: Permission;
  scope: NavigationScope;
  to: (context: NavigationWorkspaceContext | null) => string | null;
};

export type ResolvedNavigationItem = Omit<NavigationItem, "to"> & {
  to: string;
};

export type NavigationSection = {
  id: NavigationSectionId;
  items: ResolvedNavigationItem[];
  labelKey: string;
  order: number;
};

/**
 * Khai báo tập trung cấu trúc navigation, thứ tự và quyền hiển thị. Permission
 * tại đây chỉ lọc UI để tránh đường dẫn gây nhiễu; route guard và backend vẫn
 * là lớp bắt buộc để thực thi authorization.
 */
const NAVIGATION_SECTIONS: readonly Omit<NavigationSection, "items">[] = [
  { id: "platform", labelKey: "navigation.platformSection", order: 10 },
  { id: "work", labelKey: "navigation.work", order: 20 },
  { id: "management", labelKey: "navigation.management", order: 30 },
];

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    end: true,
    group: "platform",
    icon: ShieldCheck,
    id: "platform-home",
    labelKey: "navigation.platform",
    order: 10,
    permission: PERMISSIONS.platformSystemRead,
    scope: "platform",
    to: () => PATHS.platform,
  },
  {
    end: false,
    group: "platform",
    icon: Building2,
    id: "platform-tenants",
    labelKey: "navigation.tenants",
    order: 20,
    permission: PERMISSIONS.platformTenantManage,
    scope: "platform",
    to: () => PATHS.platformTenants,
  },
  {
    end: true,
    group: "platform",
    icon: Tags,
    id: "platform-plans",
    labelKey: "navigation.plans",
    order: 30,
    permission: PERMISSIONS.platformPlanManage,
    scope: "platform",
    to: () => PATHS.platformPlans,
  },
  {
    end: false,
    group: "platform",
    icon: Mail,
    id: "platform-email-templates",
    labelKey: "navigation.emailTemplates",
    order: 40,
    permission: PERMISSIONS.platformEmailTemplateManage,
    scope: "platform",
    to: () => PATHS.platformEmailTemplates,
  },
  {
    end: true,
    group: "work",
    icon: LayoutDashboard,
    id: "branch-home",
    labelKey: "navigation.branchOverview",
    order: 10,
    scope: "branch",
    to: (context) =>
      context?.branchSlug
        ? pathFor.workspaceBranch(context.tenantSlug, context.branchSlug)
        : null,
  },
  {
    end: true,
    group: "work",
    icon: CalendarDays,
    id: "appointments",
    labelKey: "navigation.appointments",
    order: 20,
    permission: PERMISSIONS.appointmentManage,
    scope: "branch",
    to: (context) =>
      context?.branchSlug
        ? pathFor.workspaceReceptionAppointments(
            context.tenantSlug,
            context.branchSlug,
          )
        : null,
  },
  {
    end: true,
    group: "work",
    icon: Stethoscope,
    id: "doctor-workspace",
    labelKey: "navigation.doctorWorkspace",
    order: 30,
    permission: PERMISSIONS.appointmentAssignedRead,
    scope: "branch",
    to: (context) =>
      context?.branchSlug
        ? pathFor.workspaceDoctor(context.tenantSlug, context.branchSlug)
        : null,
  },
  {
    end: true,
    group: "management",
    icon: LayoutDashboard,
    id: "tenant-home",
    labelKey: "navigation.tenantOverview",
    order: 10,
    permission: PERMISSIONS.tenantSettingsManage,
    scope: "tenant",
    to: (context) =>
      context
        ? pathFor.workspaceTenantHome(context.tenantSlug)
        : null,
  },
  {
    end: true,
    group: "management",
    icon: Building2,
    id: "tenant-branches",
    labelKey: "navigation.branches",
    order: 20,
    permission: PERMISSIONS.branchManage,
    scope: "tenant",
    to: (context) =>
      context
        ? pathFor.workspaceTenantBranches(context.tenantSlug)
        : null,
  },
  {
    end: true,
    group: "management",
    icon: Tags,
    id: "tenant-services",
    labelKey: "navigation.services",
    order: 30,
    permission: PERMISSIONS.serviceCatalogManage,
    scope: "tenant",
    to: (context) =>
      context
        ? pathFor.workspaceTenantServices(context.tenantSlug)
        : null,
  },
  {
    end: true,
    group: "management",
    icon: UsersRound,
    id: "tenant-staff",
    labelKey: "navigation.tenantStaff",
    order: 40,
    permission: PERMISSIONS.staffManage,
    scope: "tenant",
    to: (context) =>
      context
        ? pathFor.workspaceTenantStaff(context.tenantSlug)
        : null,
  },
  {
    end: true,
    group: "management",
    icon: UsersRound,
    id: "branch-staff",
    labelKey: "navigation.branchStaff",
    order: 50,
    permission: PERMISSIONS.staffBranchManage,
    scope: "branch",
    to: (context) =>
      context?.branchSlug
        ? pathFor.workspaceBranchStaff(context.tenantSlug, context.branchSlug)
        : null,
  },
];

/**
 * Đánh giá một item theo authorization snapshot và workspace đã được resolve.
 * Không có context thì chỉ các item platform độc lập với tenant mới hiện ra.
 */
function canViewNavigationItem(
  item: NavigationItem,
  user: AuthUser | null | undefined,
  context: NavigationWorkspaceContext | null,
): boolean {
  if (item.scope === "platform") {
    return item.permission
      ? hasPlatformPermission(user, item.permission)
      : Boolean(user);
  }

  if (!context) {
    return false;
  }

  if (item.scope === "tenant") {
    return item.permission
      ? hasTenantPermission(user, { slug: context.tenantSlug }, item.permission)
      : true;
  }

  if (!context.branchSlug) {
    return false;
  }

  return item.permission
    ? hasBranchPermission(
        user,
        { slug: context.tenantSlug },
        context.branchSlug,
        item.permission,
      )
    : hasBranchAccess(user, { slug: context.tenantSlug }, context.branchSlug);
}

/**
 * Chuyển cấu hình navigation thành các section có thể render: lọc theo quyền,
 * tính URL từ context hợp lệ, sắp xếp và bỏ các section rỗng. UI chỉ cần render
 * kết quả này thay vì tự ghép permission với route ở nhiều nơi.
 */
export function resolveNavigationSections(
  user: AuthUser | null | undefined,
  context: NavigationWorkspaceContext | null,
): NavigationSection[] {
  return NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    items: NAVIGATION_ITEMS.filter(
      (item) => item.group === section.id && canViewNavigationItem(item, user, context),
    )
      .map((item) => {
        const to = item.to(context);

        return to ? { ...item, to } : undefined;
      })
      .filter((item): item is ResolvedNavigationItem => item !== undefined)
      .sort((left, right) => left.order - right.order),
  })).filter((section) => section.items.length > 0);
}
