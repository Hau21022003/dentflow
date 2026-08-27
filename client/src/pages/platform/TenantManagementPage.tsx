import { Building2, CreditCard, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaticPageHeader } from "@/shared/components/static-dashboard";

const tenantRows = [
  { name: "BrightSmile Dental", plan: "Growth", branches: "3 branch", status: "ACTIVE" },
  { name: "Harmony Dental", plan: "Trial", branches: "1 branch", status: "TRIAL" },
  { name: "Riverfront Dental", plan: "Starter", branches: "2 branch", status: "PAST_DUE" },
];

export function TenantManagementPage() {
  return (
    <div className="space-y-7">
      <StaticPageHeader
        context="PLATFORM_ADMIN · platform.tenant.manage"
        description="Danh sách tenant và thông tin SaaS dùng để kiểm tra UI phân quyền Platform."
        eyebrow="DentFlow Platform"
        title="Quản lý tenant"
      />
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/70">
          <div>
            <CardTitle>Tenant trên hệ thống</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Dữ liệu demo không liên kết API và không cho phép thay đổi trạng thái tenant.
            </p>
          </div>
          <Button disabled type="button">Tạo tenant</Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-border/70 px-6 py-4 text-sm text-muted-foreground">
            <Search aria-hidden="true" className="size-4" />
            Tìm kiếm tenant (UI mẫu)
          </div>
          <div className="divide-y divide-border/70">
            {tenantRows.map((tenant) => (
              <div className="grid gap-3 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center" key={tenant.name}>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <Building2 aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{tenant.name}</p>
                    <p className="text-sm text-muted-foreground">Tenant SaaS mẫu</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard aria-hidden="true" className="size-4" />{tenant.plan}</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><UsersRound aria-hidden="true" className="size-4" />{tenant.branches}</span>
                <span className="w-fit rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{tenant.status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
