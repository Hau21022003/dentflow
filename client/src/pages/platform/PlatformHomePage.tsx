import {
  StaticListCard,
  StaticMetricGrid,
  StaticPageHeader,
} from "@/components/static-dashboard";
import { Activity, Building2, CreditCard, TriangleAlert } from "lucide-react";

export function PlatformHomePage() {
  return (
    <div className="space-y-7">
      <StaticPageHeader
        context="PLATFORM_ADMIN · Toàn nền tảng"
        description="Theo dõi vận hành SaaS, vòng đời tenant và các tín hiệu cần xử lý trên DentFlow."
        eyebrow="DentFlow Platform"
        title="Bảng điều khiển Platform"
      />
      <StaticMetricGrid
        metrics={[
          {
            label: "Tenant đang hoạt động",
            value: "24",
            description: "Tăng 3 tenant trong tháng",
            icon: Building2,
          },
          {
            label: "Trial sắp hết hạn",
            value: "5",
            description: "Cần theo dõi trong 7 ngày",
            icon: Activity,
            tone: "amber",
          },
          {
            label: "Hóa đơn SaaS cần chú ý",
            value: "3",
            description: "Trạng thái thanh toán chưa ổn định",
            icon: CreditCard,
            tone: "rose",
          },
          {
            label: "Webhook cần kiểm tra",
            value: "2",
            description: "Không bao gồm dữ liệu bệnh nhân",
            icon: TriangleAlert,
            tone: "blue",
          },
        ]}
      />
      <section className="grid gap-5 lg:grid-cols-2">
        <StaticListCard
          description="Các tín hiệu SaaS tổng hợp, không chứa dữ liệu clinical hoặc payment điều trị."
          items={[
            {
              title: "Trial sắp hết hạn",
              detail: "Hai tenant sẽ hết trial trong 48 giờ tới.",
              status: "Theo dõi",
            },
            {
              title: "Thanh toán thất bại",
              detail: "Một subscription cần xem lại grace period.",
              status: "Past due",
            },
            {
              title: "Webhook retry",
              detail: "Hai event đã lưu có thể retry xử lý nội bộ.",
              status: "2 event",
            },
          ]}
          title="Việc cần xử lý"
        />
        <StaticListCard
          description="Entry point mẫu cho tenant, plan, billing và kiểm soát hệ thống."
          items={[
            {
              title: "Quản lý tenant",
              detail: "Hồ sơ SaaS, owner, branch và lifecycle.",
              status: "24 tenant",
            },
            {
              title: "Danh mục plan",
              detail: "Plan, billing cycle và entitlement đang cung cấp.",
              status: "4 plan",
            },
            {
              title: "Audit log Platform",
              detail: "Theo dõi tác vụ ảnh hưởng tới access.",
              status: "Mới",
            },
          ]}
          title="Tổng quan vận hành"
        />
      </section>
    </div>
  );
}
