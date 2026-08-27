import { CalendarDays, ClipboardList, Stethoscope, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pathFor } from "@/app/router/paths";
import type { TenantRoleCode } from "@/features/auth/auth.types";
import { StaticPageHeader } from "@/shared/components/static-dashboard";
import { useWorkspaceContext } from "../use-workspace-context";

type RolePanel = {
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
  to: string;
};

export function BranchWorkspaceHomePage() {
  const { branch, branchSlug, tenant, tenantSlug } = useWorkspaceContext();
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;
  const branchName = branch?.branch.name ?? branchSlug;
  const rolePanels: Partial<Record<TenantRoleCode, RolePanel>> = {
    BRANCH_ADMIN: {
      title: "Quản trị chi nhánh",
      description: "Điều phối nhân sự và theo dõi vận hành trong branch được gán.",
      action: "Mở quản lý nhân sự",
      icon: UsersRound,
      to: pathFor.workspaceBranchStaff(tenantSlug, branchSlug),
    },
    RECEPTIONIST: {
      title: "Tiếp nhận",
      description: "Quản lý lịch hẹn, check-in và handoff tại quầy.",
      action: "Mở quản lý lịch hẹn",
      icon: CalendarDays,
      to: pathFor.workspaceReceptionAppointments(tenantSlug, branchSlug),
    },
    DENTIST: {
      title: "Bác sĩ",
      description: "Theo dõi các ca được phân công và tiến độ chuyên môn.",
      action: "Mở danh sách ca",
      icon: Stethoscope,
      to: pathFor.workspaceDoctor(tenantSlug, branchSlug),
    },
  };
  const visiblePanels = (branch?.roles ?? [])
    .map((role) => rolePanels[role])
    .filter((panel): panel is RolePanel => panel !== undefined);

  return (
    <div className="space-y-7">
      <StaticPageHeader
        context={`${tenantName} · ${branchName}`}
        description="Trang chủ branch hiển thị từng khu vực làm việc đúng với các role đang được gán cho tài khoản này."
        eyebrow="Workspace"
        title="Trang chủ workspace"
      />
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{visiblePanels.length} role tại branch hiện tại</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Các card bên dưới thay đổi theo authorization snapshot của user sau khi đăng nhập.
            </p>
          </div>
          <ClipboardList aria-hidden="true" className="size-7 text-primary" />
        </CardContent>
      </Card>
      <section aria-label="Khu vực theo role" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visiblePanels.map((panel) => {
          const Icon = panel.icon;

          return (
            <Link className="group" key={panel.title} to={panel.to}>
              <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-secondary/30">
                <CardHeader>
                  <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><Icon aria-hidden="true" className="size-5" /></span>
                  <CardTitle>{panel.title}</CardTitle>
                  <CardDescription>{panel.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-sm font-semibold text-primary">{panel.action} →</CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
