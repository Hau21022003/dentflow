import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createValidationMessages,
  type Translate,
  type ValidationMessages,
} from "@/i18n/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { z } from "zod";
import { PATHS } from "../../app/router/paths";
import {
  RHFSelect,
  RHFTextField,
  type RHFSelectOption,
} from "../../shared/components/form";
import { ApiError, handleApiError } from "../../shared/lib/error";

const GENDER_VALUES = ["male", "female", "other"] as const;

function createPatientValidationSchema(
  tPatients: Translate,
  validation: ValidationMessages,
) {
  const fullName = tPatients("form.fields.fullName");
  const phone = tPatients("form.fields.phone");
  const gender = tPatients("form.fields.gender");

  return z.object({
    fullName: z.string().trim().min(1, validation.required(fullName)),
    phone: z.string().trim().min(1, validation.required(phone)),
    gender: z
      .string()
      .min(1, validation.selectionRequired(gender))
      .refine(
        (value) => GENDER_VALUES.some((genderValue) => genderValue === value),
        validation.invalid(gender),
      ),
  });
}

type CreatePatientFormValues = z.infer<
  ReturnType<typeof createPatientValidationSchema>
>;

type MockCreatePatientErrorResponse = {
  status: 422;
  payload: {
    message: string;
    errors: { [Field in keyof CreatePatientFormValues]: string[] };
  };
};

export function CreatePatientPage() {
  const { t: tPatients } = useTranslation("patients");
  const { t: tValidation } = useTranslation("validation");
  const validation = useMemo(
    () => createValidationMessages(tValidation),
    [tValidation],
  );
  const genderOptions = useMemo(
    () =>
      GENDER_VALUES.map((value) => ({
        label: tPatients(`form.genderOptions.${value}`),
        value,
      })) satisfies RHFSelectOption[],
    [tPatients],
  );
  const patientSchema = useMemo(
    () => createPatientValidationSchema(tPatients, validation),
    [tPatients, validation],
  );
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
    resolver: zodResolver(patientSchema),
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
    <form
      className="mx-auto max-w-3xl space-y-7"
      noValidate
      onSubmit={handleSubmit(handleValidSubmit)}
    >
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

      {errors.root?.server?.message && (
        <Alert variant="destructive">{errors.root.server.message}</Alert>
      )}

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <UserRound aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>Thông tin cơ bản</CardTitle>
          <CardDescription>
            Nhập thông tin hành chính để khởi tạo hồ sơ bệnh nhân.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
          <RHFTextField
            control={control}
            fullWidth
            label={tPatients("form.fields.fullName")}
            name="fullName"
            required
          />
          <RHFTextField
            control={control}
            fullWidth
            label={tPatients("form.fields.phone")}
            name="phone"
            required
          />
          <div className="sm:col-span-2">
            <RHFSelect
              control={control}
              fullWidth
              label={tPatients("form.fields.gender")}
              name="gender"
              options={genderOptions}
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
