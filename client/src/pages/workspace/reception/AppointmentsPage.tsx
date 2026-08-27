import { CalendarCheck2, CalendarClock, CircleDollarSign, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StaticListCard,
  StaticMetricGrid,
  StaticPageHeader,
} from "@/shared/components/static-dashboard";
import { useWorkspaceContext } from "../use-workspace-context";

export function AppointmentsPage() {
  const { branch, tenant, tenantSlug } = useWorkspaceContext();
  const context = `${tenant?.tenant.displayName ?? tenantSlug} · ${branch?.branch.name ?? "Branch"}`;

  return (
    <div className="space-y-7">
      <StaticPageHeader
        context={`RECEPTIONIST · ${context}`}
        description="Màn hình lịch hẹn mẫu cho tiếp nhận; không tạo appointment, invoice hoặc payment thực tế."
        eyebrow="Workspace · Reception"
        title="Quản lý lịch hẹn"
      />
      <Button disabled type="button">Tạo lịch hẹn</Button>
      <StaticMetricGrid
        metrics={[
          { label: "Lịch hôm nay", value: "36", description: "Tất cả lịch trong branch", icon: CalendarClock },
          { label: "Đã check-in", value: "14", description: "Sẵn sàng bàn giao cho bác sĩ", icon: UserRoundCheck, tone: "blue" },
          { label: "Chờ xác nhận", value: "5", description: "Cần liên hệ lại trong ngày", icon: CalendarCheck2, tone: "amber" },
          { label: "Invoice chờ xử lý", value: "5", description: "Không sửa payment đã ghi nhận", icon: CircleDollarSign, tone: "rose" },
        ]}
      />
      <section className="grid gap-5 lg:grid-cols-2">
        <StaticListCard
          description="Các trạng thái tiếp nhận mẫu ở branch đang chọn."
          items={[
            { title: "Ca 09:00", detail: "Đã xác nhận · chờ check-in tại quầy.", status: "Đã xác nhận" },
            { title: "Ca 10:30", detail: "Walk-in · cần sắp slot phù hợp.", status: "Cần xử lý" },
            { title: "Ca 14:00", detail: "Theo dõi lịch tái khám được đề xuất.", status: "Follow-up" },
          ]}
          title="Lịch ưu tiên"
        />
        <StaticListCard
          description="Handoff sau điều trị mà Receptionist có thể thực hiện."
          items={[
            { title: "Treatment plan đã đề xuất", detail: "Ghi nhận đồng ý trước khi lập invoice.", status: "3 plan" },
            { title: "Thu tại quầy", detail: "Ghi nhận payment mới với mã tham chiếu.", status: "5 invoice" },
            { title: "Lịch tái khám", detail: "Tạo appointment theo đề xuất từ bác sĩ.", status: "6 lịch" },
          ]}
          title="Bàn giao và thu phí"
        />
      </section>
    </div>
  );
}
