import {
  StaticListCard,
  StaticMetricGrid,
  StaticPageHeader,
} from "@/components/static-dashboard";
import {
  CalendarDays,
  ClipboardList,
  HeartPulse,
  Stethoscope,
} from "lucide-react";
import { useWorkspaceContext } from "../use-workspace-context";

export function DoctorHomePage() {
  const { branch, tenant, tenantSlug } = useWorkspaceContext();
  const context = `${tenant?.tenant.displayName ?? tenantSlug} · ${branch?.branch.name ?? "Branch"}`;

  return (
    <div className="space-y-7">
      <StaticPageHeader
        context={`DENTIST · ${context}`}
        description="Theo dõi ca được phân công và tiến độ chuyên môn; dữ liệu ca là mock và không lưu clinical note."
        eyebrow="Workspace · Doctor"
        title="Workspace bác sĩ"
      />
      <StaticMetricGrid
        metrics={[
          {
            label: "Ca được phân công",
            value: "8",
            description: "Chỉ thuộc bác sĩ hiện tại",
            icon: CalendarDays,
          },
          {
            label: "Đã check-in",
            value: "4",
            description: "Sẵn sàng mở visit",
            icon: HeartPulse,
            tone: "blue",
          },
          {
            label: "Visit đang mở",
            value: "2",
            description: "Cần hoàn tất clinical note",
            icon: ClipboardList,
            tone: "amber",
          },
          {
            label: "Treatment item",
            value: "6",
            description: "Theo dõi tiến độ được giao",
            icon: Stethoscope,
            tone: "rose",
          },
        ]}
      />
      <section className="grid gap-5 lg:grid-cols-2">
        <StaticListCard
          description="Danh sách mock chỉ mô tả trạng thái, không hiển thị thông tin bệnh nhân."
          items={[
            {
              title: "Ca 09:00",
              detail: "Đã check-in · sẵn sàng bắt đầu visit.",
              status: "Sẵn sàng",
            },
            {
              title: "Ca 10:30",
              detail: "Treatment plan đang chờ ghi nhận.",
              status: "Đang chờ",
            },
            {
              title: "Ca 14:00",
              detail: "Cần hoàn tất và đề xuất tái khám.",
              status: "Follow-up",
            },
          ]}
          title="Lịch điều trị của tôi"
        />
        <StaticListCard
          description="Các entry point chuyên môn chỉ dành cho role Dentist trong branch scope."
          items={[
            {
              title: "Clinical note",
              detail: "Ghi nhận khám và chẩn đoán cho ca được phép.",
              status: "2 mở",
            },
            {
              title: "Kế hoạch điều trị",
              detail: "Tạo hạng mục điều trị và chỉ định liên quan.",
              status: "3 plan",
            },
            {
              title: "Tái khám",
              detail: "Đề xuất lịch để tiếp nhận tạo appointment tiếp theo.",
              status: "1 đề xuất",
            },
          ]}
          title="Tiến độ chuyên môn"
        />
      </section>
    </div>
  );
}
