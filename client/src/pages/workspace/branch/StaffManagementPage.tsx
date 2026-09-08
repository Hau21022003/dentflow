import { StaticPageHeader } from "@/components/static-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { useWorkspaceContext } from "../use-workspace-context";

const staff = [
  {
    label: "Điều phối chi nhánh",
    role: "BRANCH_ADMIN",
    status: "Đang hoạt động",
  },
  {
    label: "Tiếp nhận tại quầy",
    role: "RECEPTIONIST",
    status: "Đang hoạt động",
  },
  { label: "Nhóm điều trị", role: "DENTIST", status: "Đang hoạt động" },
];

export function StaffManagementPage() {
  const { branch, tenant, tenantSlug } = useWorkspaceContext();
  const context = `${tenant?.tenant.displayName ?? tenantSlug} · ${branch?.branch.name ?? "Branch"}`;

  return (
    <div className="space-y-7">
      <StaticPageHeader
        context={`BRANCH_ADMIN · ${context}`}
        description="Danh sách nhân sự mẫu trong đúng branch scope; không tạo, sửa hoặc cấp quyền thực tế."
        eyebrow="Workspace · Branch"
        title="Quản lý nhân sự"
      />
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/70">
          <div>
            <CardTitle>Nhân sự tại branch</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Role và trạng thái chỉ dùng để kiểm tra trải nghiệm UI.
            </p>
          </div>
          <Button disabled type="button">
            <UserPlus aria-hidden="true" />
            Mời nhân sự
          </Button>
        </CardHeader>
        <CardContent className="divide-y divide-border/70 p-0">
          {staff.map((member) => (
            <div
              className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
              key={member.label}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <UsersRound aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{member.label}</p>
                  <p className="text-sm text-muted-foreground">
                    Synthetic staff record
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ShieldCheck aria-hidden="true" className="size-4" />
                  {member.role}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                  {member.status}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
