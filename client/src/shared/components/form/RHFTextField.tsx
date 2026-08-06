import { TextField, type TextFieldProps } from "@mui/material";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from "react-hook-form";

export type RHFTextFieldProps<TFieldValues extends FieldValues> = Omit<
  TextFieldProps,
  | "defaultValue"
  | "error"
  | "helperText"
  | "inputRef"
  | "name"
  | "onBlur"
  | "onChange"
  | "value"
> & {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, FieldPath<TFieldValues>>;
  helperText?: TextFieldProps["helperText"];
};

export function RHFTextField<TFieldValues extends FieldValues>({
  control,
  name,
  rules,
  helperText,
  ...textFieldProps
}: RHFTextFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => {
        const { ref, ...fieldProps } = field;

        return (
          <TextField
            {...textFieldProps}
            {...fieldProps}
            inputRef={ref}
            error={Boolean(fieldState.error)}
            helperText={fieldState.error?.message ?? helperText}
          />
        );
      }}
    />
  );
}
