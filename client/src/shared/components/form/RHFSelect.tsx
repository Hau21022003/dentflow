import { useId, type ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export type RHFSelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

export type RHFSelectProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  disabled?: boolean;
  fullWidth?: boolean;
  helperText?: ReactNode;
  label: ReactNode;
  name: FieldPath<TFieldValues>;
  options: readonly RHFSelectOption[];
  placeholder?: string;
  required?: boolean;
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
  placeholder = "Chọn một lựa chọn",
  required = false,
  disabled = false,
}: RHFSelectProps<TFieldValues>) {
  const selectId = useId();
  const messageId = `${selectId}-message`;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => {
        const message = fieldState.error?.message ?? helperText;

        return (
          <div className={fullWidth ? "grid w-full gap-2" : "grid gap-2"}>
            <Label htmlFor={selectId}>
              {label}
              {required && <span aria-hidden="true" className="text-destructive">*</span>}
            </Label>
            <Select
              disabled={disabled}
              onValueChange={field.onChange}
              value={field.value ?? ""}
            >
              <SelectTrigger
                aria-describedby={message ? messageId : undefined}
                aria-invalid={Boolean(fieldState.error)}
                id={selectId}
                onBlur={field.onBlur}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {message && (
              <p
                className={fieldState.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                id={messageId}
              >
                {message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
