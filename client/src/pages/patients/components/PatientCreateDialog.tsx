import {
  FormDialog,
  RHFSelect,
  RHFTextField,
  type RHFSelectOption,
} from "@/components/form";
import { Alert } from "@/components/ui/alert";
import {
  createValidationMessages,
  type Translate,
  type ValidationMessages,
} from "@/i18n/validation";
import { ApiError, handleApiError } from "@/shared/lib/error";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

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

type PatientCreateDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function PatientCreateDialog({
  open,
  onOpenChange,
}: PatientCreateDialogProps) {
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
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    reset,
    setError,
  } = useForm<CreatePatientFormValues>({
    defaultValues: {
      fullName: "",
      gender: "",
      phone: "",
    },
    resolver: zodResolver(patientSchema),
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
    }

    onOpenChange(nextOpen);
  }

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
    <FormDialog
      description={tPatients("form.description")}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      noValidate
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit(handleValidSubmit)}
      open={open}
      submitText={tPatients("form.submit")}
      title={tPatients("form.title")}
    >
      <div className="space-y-5">
        {errors.root?.server?.message && (
          <Alert variant="destructive">{errors.root.server.message}</Alert>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
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
        </div>
      </div>
    </FormDialog>
  );
}
