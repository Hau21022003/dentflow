# DentFlow — Role Workflows

## 1. Mục tiêu

Tài liệu này xác định quyền theo vai trò và các điểm bàn giao trong quy trình vận hành. Role là một quyền nghiệp vụ, còn phạm vi dữ liệu được xác định độc lập bởi `tenantId` và danh sách `branchId` được gán cho người dùng.

```text
Tenant Admin → Branch Admin → Receptionist → Dental Assistant → Dentist → Receptionist
                                      ↖────────────── tái khám ──────────────┘
```

`Platform Admin` vận hành DentFlow SaaS và được mô tả riêng tại [02-platform-admin.md](./02-platform-admin.md). Dòng tiền SaaS và tiền điều trị được mô tả tại [01-payment-model.md](./01-payment-model.md).

## 2. Ma trận role và phạm vi

| Vai trò | Phạm vi mặc định | Trách nhiệm chính | Ranh giới bắt buộc |
| --- | --- | --- | --- |
| Tenant Admin | Toàn bộ branch trong tenant | Cấu hình chuỗi, người dùng, plan SaaS, báo cáo tổng hợp | Không ghi clinical note nếu không có thêm role Dentist |
| Branch Admin | Một hoặc nhiều branch được gán | Điều phối vận hành và nhân sự tại branch | Không truy cập branch ngoài assignment |
| Receptionist | Một hoặc nhiều branch được gán | Tiếp nhận, lịch hẹn, invoice và thu tiền | Không chẩn đoán hay sửa clinical note |
| Dentist | Một hoặc nhiều branch được gán, ca được phân công | Khám, chẩn đoán, điều trị và tái khám | Không chỉnh sửa payment hoặc ca không được gán |
| Dental Assistant | Một hoặc nhiều branch được gán, ca được phân công | Chuẩn bị/ghi nhận hỗ trợ ghế nha khoa | Không kết luận chẩn đoán hoặc duyệt điều trị |

MVP triển khai bốn role tenant-facing: `TENANT_ADMIN`, `BRANCH_ADMIN`, `RECEPTIONIST`, `DENTIST`. `DENTAL_ASSISTANT` là milestone ngay sau MVP để phản ánh hoạt động chairside thực tế. Một user có thể có nhiều role, ví dụ `TENANT_ADMIN` đồng thời là `DENTIST`; API phải kiểm tra role cần thiết cho từng hành động, không suy luận quyền lâm sàng từ role quản trị.

## 3. Tenant Admin: quản trị tenant

Tenant Admin quản lý cấu hình tenant, branch, danh mục dịch vụ, user/role assignment, báo cáo toàn chuỗi, audit log và SaaS billing. Role này có scope toàn tenant nhưng không tự cấp quyền lâm sàng, không sửa payment điều trị đã ghi nhận và không truy cập tenant khác.

Một Tenant Admin đồng thời là Dentist chỉ có clinical permission khi role `DENTIST`, branch scope và assignment ca đều hợp lệ. Trạng thái thanh toán SaaS chỉ được đồng bộ từ Stripe webhook, không được đánh dấu thủ công từ UI Tenant Admin.

Chi tiết nghiệp vụ, cài đặt tenant, luồng onboarding, API định hướng và acceptance criteria được quy định tại [04-tenant-admin.md](./04-tenant-admin.md).

## 4. Branch Admin: điều phối một phòng khám

### Đầu ngày

1. Mở danh sách lịch hẹn hôm nay, ca chưa xác nhận, lịch trùng và bác sĩ vắng mặt.
2. Điều chỉnh phân công bác sĩ hoặc slot lịch hẹn trong branch được gán; thay đổi phải lưu lý do/audit log nếu ca đã confirmed.
3. Theo dõi trạng thái bệnh nhân chờ và cân bằng tải lịch cho nhân sự.

### Trong ngày

- Hỗ trợ Receptionist xử lý lịch hủy, no-show, walk-in và chuyển ca.
- Mời/điều chỉnh nhân sự chỉ trong branch scope; không cấp Tenant Admin hoặc mở rộng scope của chính mình.
- Theo dõi dashboard branch: lịch theo trạng thái, ca đang diễn ra, doanh thu đã thu trong ngày và treatment plan cần follow-up.

### Cuối ngày

- Rà soát lịch chưa hoàn tất, no-show và các invoice chưa thanh toán.
- Ghi nhận vấn đề vận hành và xem audit log liên quan.
- Không sửa giao dịch payment để "khớp sổ"; chỉ tạo adjustment/refund theo quyền và quy trình sau này.

## 5. Receptionist: tiếp nhận đến thu tiền và tái khám

### Luồng bệnh nhân mới hoặc quay lại

1. Tìm kiếm bệnh nhân theo số điện thoại trong tenant để tránh tạo trùng.
2. Tạo hoặc cập nhật thông tin hành chính được phép: liên hệ, ngày sinh, địa chỉ, người liên hệ khẩn cấp và nguồn giới thiệu.
3. Tạo appointment với branch, dịch vụ/lý do khám, bác sĩ dự kiến, thời gian và ghi chú.
4. Khi bệnh nhân đến, xác minh thông tin và chuyển appointment sang `CHECKED_IN`.
5. Khi bác sĩ hoàn tất, lập `PatientInvoice` từ treatment plan/hạng mục được chấp nhận.
6. Ghi nhận một hoặc nhiều payment tại quầy: `CASH`, `BANK_TRANSFER`, `CARD` hoặc `OTHER`; lưu mã tham chiếu và người thu.
7. Đặt lịch tái khám theo chỉ định, chuyển appointment sang `COMPLETED` hoặc ghi `NO_SHOW`/`CANCELLED` kèm lý do.

### Ranh giới bắt buộc

- Không tạo chẩn đoán, treatment plan hoặc clinical note.
- Không xóa/sửa payment đã ghi nhận; refund hoặc adjustment là bản ghi mới có audit log.
- Không xem/sửa appointment, payment hoặc patient thuộc branch ngoài scope, trừ patient profile tenant-wide ở mức thông tin hành chính được cho phép.

## 6. Dentist: khám và điều trị

### Luồng một ca điều trị

1. Xem danh sách appointment được phân công tại branch của mình.
2. Khi bệnh nhân đã check-in, bắt đầu appointment và mở `Visit`.
3. Ghi triệu chứng, thông tin khám, chẩn đoán và clinical note.
4. Tạo `TreatmentPlan` gồm hạng mục, dịch vụ, vị trí/răng, số lượng, đơn giá dự kiến, chỉ định và bác sĩ thực hiện.
5. Chuyển kế hoạch sang `PROPOSED`; Receptionist ghi nhận sự chấp thuận của bệnh nhân trước khi tạo invoice.
6. Thực hiện từng treatment item, cập nhật tiến độ và ghi diễn biến điều trị.
7. Hoàn tất visit, đề xuất tái khám hoặc chuyển chuyên khoa; Receptionist tạo appointment tái khám.

### Ranh giới bắt buộc

- Chỉ truy cập ca được phân công hoặc ca được Branch Admin chuyển giao có audit trail.
- Không tự đánh dấu invoice là paid, tạo refund hay sửa payment.
- Không truy cập clinical notes của bác sĩ khác ngoài chính sách tenant/branch đã cấp.

## 7. Dental Assistant: hỗ trợ ghế nha khoa (sau MVP)

### Luồng chairside

1. Xem ca và bác sĩ được phân công trong ngày.
2. Chuẩn bị ghế/dụng cụ, đánh dấu ca sẵn sàng nếu tenant bật tính năng chair management.
3. Ghi nhận các thông tin hỗ trợ được phép như dấu hiệu sinh tồn, checklist chuẩn bị hoặc tệp ảnh được bác sĩ yêu cầu.
4. Hỗ trợ treatment item đang thực hiện; bác sĩ xác nhận tất cả thay đổi chuyên môn và trạng thái hoàn thành.
5. Chuẩn bị hướng dẫn tái khám để Dentist/Receptionist hoàn tất handoff.

### Ranh giới bắt buộc

- Không ghi chẩn đoán, không ký/xác nhận clinical note và không thay đổi giá/kế hoạch điều trị.
- Không lập invoice hoặc ghi nhận payment.

## 8. Điểm bàn giao và quyền sở hữu dữ liệu

| Sự kiện | Người tạo/cập nhật | Người nhận bàn giao | Quy tắc |
| --- | --- | --- | --- |
| Appointment `BOOKED` | Receptionist | Branch Admin, Dentist | Có branch và bác sĩ dự kiến |
| Appointment `CHECKED_IN` | Receptionist | Dentist/Dental Assistant | Không tạo clinical visit trước check-in, trừ walk-in có lý do |
| Treatment plan `PROPOSED` | Dentist | Receptionist, bệnh nhân | Receptionist không sửa nội dung chuyên môn |
| Treatment plan `ACCEPTED` | Receptionist ghi xác nhận | Dentist | Lưu thời điểm và người xác nhận |
| Treatment item `COMPLETED` | Dentist | Receptionist | Chỉ item hoàn tất mới sẵn sàng invoice theo policy |
| Payment recorded | Receptionist | Tenant/Branch reporting | Không thể sửa trực tiếp; dùng adjustment/refund |
| Tái khám | Dentist đề xuất, Receptionist tạo lịch | Patient/Dentist | Liên kết với visit/treatment plan gốc nếu có |

## 9. Acceptance criteria cho RBAC

- Receptionist tạo và check-in appointment trong branch được gán, nhưng nhận `403` khi tạo clinical note.
- Dentist được phân công có thể tạo visit/treatment plan; Dentist không được phân công nhận `403` dù biết appointment ID.
- Branch Admin có thể đổi lịch trong scope nhưng không quản lý user hoặc appointment của branch khác.
- Tenant Admin xem báo cáo tenant và billing SaaS, nhưng không có quyền clinical write nếu không có `DENTIST` role.
- Một payment đã tạo không có endpoint update/delete thông thường; mọi adjustment ghi lại actor, reason và quan hệ payment gốc.
- User có nhiều role được cấp hợp quyền của role trong đúng tenant/branch scope, không được hợp quyền qua tenant khác.
