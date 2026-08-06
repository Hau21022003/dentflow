import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  type SelectProps,
} from "@mui/material";
import { useId, type ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from "react-hook-form";

export type RHFSelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

export type RHFSelectProps<TFieldValues extends FieldValues> = Omit<
  SelectProps,
  | "defaultValue"
  | "error"
  | "inputRef"
  | "label"
  | "name"
  | "onBlur"
  | "onChange"
  | "value"
> & {
  control: Control<TFieldValues>;
  fullWidth?: boolean;
  helperText?: ReactNode;
  label: ReactNode;
  name: FieldPath<TFieldValues>;
  options: readonly RHFSelectOption[];
  rules?: RegisterOptions<TFieldValues, FieldPath<TFieldValues>>;
};

export function RHFSelect<TFieldValues extends FieldValues>({
  control,
  fullWidth = false,
  helperText,
  label,
  name,
  options,
  rules,
  ...selectProps
}: RHFSelectProps<TFieldValues>) {
  const selectId = useId();
  const labelId = `${selectId}-label`;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => {
        const { ref, ...fieldProps } = field;
        const hasError = Boolean(fieldState.error);

        return (
          <FormControl disabled={selectProps.disabled} error={hasError} fullWidth={fullWidth}>
            <InputLabel id={labelId}>{label}</InputLabel>
            <Select
              {...selectProps}
              {...fieldProps}
              id={selectId}
              inputRef={ref}
              label={label}
              labelId={labelId}
              value={field.value ?? ""}
            >
              {options.map((option) => (
                <MenuItem disabled={option.disabled} key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {(fieldState.error?.message ?? helperText) && (
              <FormHelperText>{fieldState.error?.message ?? helperText}</FormHelperText>
            )}
          </FormControl>
        );
      }}
    />
  );
}
