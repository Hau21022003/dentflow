import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link as RouterLink } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PATHS } from "../../app/router/paths";
import {
  RHFSelect,
  RHFTextField,
  type RHFSelectOption,
} from "../../shared/components/form";
import { ApiError, handleApiError } from "../../shared/lib/error";

const GENDER_OPTIONS = [
  { label: "Nam", value: "male" },
  { label: "Nữ", value: "female" },
  { label: "Khác", value: "other" },
] as const satisfies readonly RHFSelectOption[];

const createPatientSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ và tên"),
  phone: z.string().trim().min(1, "Vui lòng nhập số điện thoại"),
  gender: z
    .string()
    .min(1, "Vui lòng chọn giới tính")
    .refine(
      (value) => GENDER_OPTIONS.some((option) => option.value === value),
      "Giới tính không hợp lệ",
    ),
});

type CreatePatientFormValues = z.infer<typeof createPatientSchema>;

type MockCreatePatientErrorResponse = {
  status: 422;
  payload: {
    message: string;
    errors: { [Field in keyof CreatePatientFormValues]: string[] };
  };
};

export function CreatePatientPage() {
  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
  } = useForm<CreatePatientFormValues>({
    defaultValues: {
      fullName: "",
      gender: "",
      phone: "",
    },
    resolver: zodResolver(createPatientSchema),
  });

  function handleValidSubmit() {
    const mockError: MockCreatePatientErrorResponse = {
      status: 422,
      payload: {
        message: "Không thể lưu bệnh nhân. Vui lòng kiểm tra thông tin.",
        errors: {
          fullName: ["Họ và tên cần được xác minh lại."],
          phone: ["Số điện thoại này đã tồn tại."],
          gender: ["Giới tính không hợp lệ cho hồ sơ này."],
        },
      },
    };

    handleApiError<CreatePatientFormValues>({
      error: new ApiError(mockError),
      setError,
    });
  }

  return (
    <form className="mx-auto max-w-3xl space-y-7" noValidate onSubmit={handleSubmit(handleValidSubmit)}>
      <div className="space-y-2">
        <Button asChild className="-ml-3" size="sm" variant="ghost">
          <RouterLink to={PATHS.patients}>
            <ArrowLeft aria-hidden="true" />
            Quay lại danh sách
          </RouterLink>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Thêm bệnh nhân</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Form giao diện mẫu; dữ liệu chưa được gửi tới API.
        </p>
      </div>

      {errors.root?.server?.message && <Alert variant="destructive">{errors.root.server.message}</Alert>}

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <UserRound aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>Thông tin cơ bản</CardTitle>
          <CardDescription>Nhập thông tin hành chính để khởi tạo hồ sơ bệnh nhân.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
          <RHFTextField control={control} fullWidth label="Họ và tên" name="fullName" required />
          <RHFTextField control={control} fullWidth label="Số điện thoại" name="phone" required />
          <div className="sm:col-span-2">
            <RHFSelect
              control={control}
              fullWidth
              label="Giới tính"
              name="gender"
              options={GENDER_OPTIONS}
              required
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <RouterLink to={PATHS.patients}>Hủy</RouterLink>
        </Button>
        <Button type="submit">
          <Save aria-hidden="true" />
          Lưu mẫu
        </Button>
      </div>
    </form>
  );
}
