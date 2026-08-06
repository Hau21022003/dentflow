import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink } from "react-router-dom";
import { z } from "zod";
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
  const [submitted, setSubmitted] = useState(false);
  const { control, handleSubmit, setError } = useForm<CreatePatientFormValues>({
    defaultValues: {
      fullName: "",
      gender: "",
      phone: "",
    },
    resolver: zodResolver(createPatientSchema),
  });

  function handleValidSubmit() {
    setSubmitted(false);

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
    <Stack component="form" noValidate onSubmit={handleSubmit(handleValidSubmit)} spacing={3}>
      <Box>
        <Typography component="h1" variant="h4">
          Thêm bệnh nhân
        </Typography>
        <Typography color="text.secondary">
          Form giao diện mẫu; dữ liệu chưa được gửi tới API.
        </Typography>
      </Box>

      {submitted && <Alert severity="info">Mẫu đã nhận submit, nhưng chưa lưu dữ liệu.</Alert>}

      <RHFTextField control={control} fullWidth label="Họ và tên" name="fullName" required />
      <RHFTextField control={control} fullWidth label="Số điện thoại" name="phone" required />
      <RHFSelect
        control={control}
        fullWidth
        label="Giới tính"
        name="gender"
        options={GENDER_OPTIONS}
        required
      />

      <Stack direction="row" spacing={2}>
        <Button component={RouterLink} to={PATHS.patients} variant="text">
          Hủy
        </Button>
        <Button type="submit" variant="contained">
          Lưu mẫu
        </Button>
      </Stack>
    </Stack>
  );
}
