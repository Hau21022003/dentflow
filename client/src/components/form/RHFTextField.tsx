import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/lib/utils";

export type RHFTextFieldProps<TFieldValues extends FieldValues> = Omit<
  ComponentProps<typeof Input>,
  | "defaultValue"
  | "id"
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
  rules?: RegisterOptions<TFieldValues, FieldPath<TFieldValues>>;
};

export function RHFTextField<TFieldValues extends FieldValues>({
  control,
  fullWidth,
  name,
  rules,
  helperText,
  label,
  className,
  ...inputProps
}: RHFTextFieldProps<TFieldValues>) {
  const inputId = useId();
  const messageId = `${inputId}-message`;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => {
        const { ref, ...fieldProps } = field;
        const message = fieldState.error?.message ?? helperText;

        return (
          <div className="grid w-full gap-2">
            <Label htmlFor={inputId}>
              {label}
              {inputProps.required && <span aria-hidden="true" className="text-destructive">*</span>}
            </Label>
            <Input
              {...inputProps}
              {...fieldProps}
              aria-describedby={message ? messageId : undefined}
              aria-invalid={Boolean(fieldState.error)}
              className={cn(fullWidth && "w-full", className)}
              id={inputId}
              ref={ref}
              value={field.value ?? ""}
            />
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
