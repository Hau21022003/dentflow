import { Building2, MapPin, Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaticPageHeader } from "@/shared/components/static-dashboard";
import { useWorkspaceContext } from "../use-workspace-context";

const demoBranches = [
  { name: "Chi nhánh Quận 1", address: "Quận 1, TP. Hồ Chí Minh", staff: "16 nhân sự", status: "ACTIVE" },
  { name: "Chi nhánh Thủ Đức", address: "TP. Thủ Đức, TP. Hồ Chí Minh", staff: "14 nhân sự", status: "ACTIVE" },
  { name: "Chi nhánh Bình Thạnh", address: "Bình Thạnh, TP. Hồ Chí Minh", staff: "12 nhân sự", status: "ACTIVE" },
];

export function BranchManagementPage() {
  const { tenant, tenantSlug } = useWorkspaceContext();
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;

  return (
    <div className="space-y-7">
      <StaticPageHeader
        context={`TENANT_ADMIN · ${tenantName}`}
        description="Quản lý các chi nhánh thuộc tenant bằng danh sách UI mẫu, chưa kết nối thao tác tạo hoặc cập nhật."
        eyebrow="Workspace · Tenant"
        title="Quản lý branch"
      />
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/70">
          <div>
            <CardTitle>Danh sách branch</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Mọi địa chỉ và số liệu dưới đây đều là synthetic.</p>
          </div>
          <Button disabled type="button"><Plus aria-hidden="true" />Tạo branch</Button>
        </CardHeader>
        <CardContent className="divide-y divide-border/70 p-0">
          {demoBranches.map((branch) => (
            <div className="grid gap-3 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center" key={branch.name}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><Building2 aria-hidden="true" className="size-5" /></span>
                <div>
                  <p className="font-semibold">{branch.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="size-3.5" />{branch.address}</p>
                </div>
              </div>
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><UsersRound aria-hidden="true" className="size-4" />{branch.staff}</span>
              <span className="w-fit rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{branch.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
