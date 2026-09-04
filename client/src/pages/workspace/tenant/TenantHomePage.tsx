import { pathFor } from "@/app/router/paths";
import {
  StaticListCard,
  StaticMetricGrid,
  StaticPageHeader,
} from "@/components/static-dashboard";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ChartNoAxesCombined,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkspaceContext } from "../use-workspace-context";

export function TenantHomePage() {
  const { tenant, tenantSlug } = useWorkspaceContext();
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;

  return (
    <div className="space-y-7">
      <StaticPageHeader
        context={`TENANT_ADMIN · ${tenantName}`}
        description="Quản lý cấu hình chuỗi, chi nhánh, nhân sự, báo cáo và SaaS billing trong tenant hiện tại."
        eyebrow="Workspace · Tenant Admin"
        title="Workspace quản trị tenant"
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild type="button">
          <Link to={pathFor.workspaceTenantBranches(tenantSlug)}>
            Quản lý branch
          </Link>
        </Button>
        <Button disabled type="button" variant="outline">
          Mời nhân sự
        </Button>
      </div>
      <StaticMetricGrid
        metrics={[
          {
            label: "Chi nhánh hoạt động",
            value: "3",
            description: "Toàn bộ trong tenant",
            icon: Building2,
          },
          {
            label: "Nhân sự đang hoạt động",
            value: "42",
            description: "Theo role và branch scope",
            icon: UsersRound,
            tone: "blue",
          },
          {
            label: "Báo cáo cần xem",
            value: "4",
            description: "Số liệu tổng hợp theo branch",
            icon: ChartNoAxesCombined,
            tone: "amber",
          },
          {
            label: "Kỳ SaaS hiện tại",
            value: "12 ngày",
            description: "Thông tin subscription mẫu",
            icon: ReceiptText,
            tone: "rose",
          },
        ]}
      />
      <section className="grid gap-5 lg:grid-cols-2">
        <StaticListCard
          description="Các khu vực quản trị toàn tenant, không tự cấp quyền clinical."
          items={[
            {
              title: "Cấu hình tổ chức",
              detail: "Nhận diện, locale, timezone và quy ước hiển thị.",
              status: "Sẵn sàng",
            },
            {
              title: "Danh mục dịch vụ",
              detail: "Dịch vụ và giá niêm yết cho các chi nhánh.",
              status: "18 dịch vụ",
            },
            {
              title: "Phân quyền nhân sự",
              detail: "Role cố định cùng branch scope được gán.",
              status: "42 user",
            },
          ]}
          title="Thiết lập tenant"
        />
        <StaticListCard
          description="Tổng hợp vận hành và billing SaaS, tách biệt với payment điều trị."
          items={[
            {
              title: "Hiệu suất theo branch",
              detail: "Lịch hẹn, no-show và công suất trong ngày.",
              status: "3 branch",
            },
            {
              title: "Audit log",
              detail: "Thay đổi quyền và cấu hình cần kiểm soát.",
              status: "Mới",
            },
            {
              title: "SaaS billing",
              detail: "Plan, subscription và hóa đơn DentFlow.",
              status: "Trial",
            },
          ]}
          title="Theo dõi chuỗi"
        />
      </section>
    </div>
  );
}
