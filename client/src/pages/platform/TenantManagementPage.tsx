import { type ColumnDef } from "@tanstack/react-table";
import { Building2 } from "lucide-react";

import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
import { StaticPageHeader } from "@/components/static-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createDataTableLocale } from "@/i18n/data-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type TenantStatus = "ACTIVE" | "TRIAL" | "PAST_DUE" | "SUSPENDED" | "CANCELED";

type TenantTableRow = {
  id: string;
  name: string;
  plan: string;
  branchCount: number;
  status: TenantStatus;
};

const tenantRows: TenantTableRow[] = [
  {
    id: "tenant-001",
    name: "BrightSmile Dental",
    plan: "Growth",
    branchCount: 3,
    status: "ACTIVE",
  },
  {
    id: "tenant-002",
    name: "Harmony Dental",
    plan: "Starter",
    branchCount: 1,
    status: "TRIAL",
  },
  {
    id: "tenant-003",
    name: "Riverfront Dental",
    plan: "Starter",
    branchCount: 2,
    status: "PAST_DUE",
  },
  {
    id: "tenant-004",
    name: "An Phu Dental Care",
    plan: "Growth",
    branchCount: 4,
    status: "ACTIVE",
  },
  {
    id: "tenant-005",
    name: "Sunrise Orthodontics",
    plan: "Professional",
    branchCount: 5,
    status: "ACTIVE",
  },
  {
    id: "tenant-006",
    name: "Lotus Dental Studio",
    plan: "Starter",
    branchCount: 1,
    status: "SUSPENDED",
  },
  {
    id: "tenant-007",
    name: "Westlake Dental",
    plan: "Growth",
    branchCount: 3,
    status: "ACTIVE",
  },
  {
    id: "tenant-008",
    name: "Nha khoa Minh Tâm",
    plan: "Starter",
    branchCount: 1,
    status: "TRIAL",
  },
  {
    id: "tenant-009",
    name: "Greenfield Dental",
    plan: "Professional",
    branchCount: 6,
    status: "ACTIVE",
  },
  {
    id: "tenant-010",
    name: "Nha khoa Bình An",
    plan: "Growth",
    branchCount: 2,
    status: "PAST_DUE",
  },
  {
    id: "tenant-011",
    name: "Coastal Smile Clinic",
    plan: "Starter",
    branchCount: 1,
    status: "CANCELED",
  },
  {
    id: "tenant-012",
    name: "Nha khoa Thành Công",
    plan: "Growth",
    branchCount: 4,
    status: "ACTIVE",
  },
  {
    id: "tenant-013",
    name: "Maple Dental Group",
    plan: "Professional",
    branchCount: 7,
    status: "ACTIVE",
  },
  {
    id: "tenant-014",
    name: "Nha khoa Hòa Bình",
    plan: "Starter",
    branchCount: 1,
    status: "SUSPENDED",
  },
  {
    id: "tenant-015",
    name: "Skyline Dental",
    plan: "Growth",
    branchCount: 3,
    status: "TRIAL",
  },
];

const tenantStatusLabels: Record<TenantStatus, string> = {
  ACTIVE: "Đang hoạt động",
  TRIAL: "Dùng thử",
  PAST_DUE: "Quá hạn thanh toán",
  SUSPENDED: "Đã tạm khóa",
  CANCELED: "Đã hủy",
};

const tenantStatusBadgeVariants: Record<
  TenantStatus,
  "default" | "secondary" | "destructive" | "outline" | "ghost"
> = {
  ACTIVE: "default",
  TRIAL: "secondary",
  PAST_DUE: "outline",
  SUSPENDED: "destructive",
  CANCELED: "ghost",
};

const tenantColumns: ColumnDef<TenantTableRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tenant" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Building2 aria-hidden="true" className="size-4" />
        </span>
        <div>
          <p className="font-semibold">{row.original.name}</p>
          <p className="text-sm text-muted-foreground">Tenant SaaS mẫu</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "plan",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Gói dịch vụ" />
    ),
  },
  {
    accessorKey: "branchCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Chi nhánh" />
    ),
    cell: ({ row }) => `${row.original.branchCount} chi nhánh`,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trạng thái" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;

      return (
        <Badge variant={tenantStatusBadgeVariants[status]}>
          {tenantStatusLabels[status]}
        </Badge>
      );
    },
    meta: {
      filterConfig: {
        variant: "select",
        title: "Lọc theo trạng thái",
        description: "Chỉ hiển thị tenant có trạng thái đã chọn.",
        placeholder: "Chọn trạng thái",
        options: Object.entries(tenantStatusLabels).map(([value, label]) => ({
          label,
          value,
        })),
      },
    },
  },
];

export function TenantManagementPage() {
  const { t } = useTranslation("common");
  const dataTableLocale = useMemo(() => createDataTableLocale(t), [t]);

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
              Dữ liệu demo synthetic không liên kết API và không cho phép thay
              đổi trạng thái tenant.
            </p>
          </div>
          <Button disabled type="button">
            Tạo tenant
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            columns={tenantColumns}
            data={tenantRows}
            emptyState={
              <div className="py-10 text-center text-sm text-muted-foreground">
                Không tìm thấy tenant phù hợp.
              </div>
            }
            locale={dataTableLocale}
            pagination={{
              pageSize: 10,
              pageSizeOptions: [5, 10, 25],
            }}
            toolbar={{ search: true, viewOptions: true }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
