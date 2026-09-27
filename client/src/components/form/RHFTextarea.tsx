import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

export type RHFTextareaProps<TFieldValues extends FieldValues> = Omit<
  ComponentProps<typeof Textarea>,
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

export function RHFTextarea<TFieldValues extends FieldValues>({
  control,
  fullWidth,
  helperText,
  label,
  name,
  rules,
  className,
  ...textareaProps
}: RHFTextareaProps<TFieldValues>) {
  const textareaId = useId();
  const messageId = `${textareaId}-message`;

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
            <Label htmlFor={textareaId}>
              {label}
              {textareaProps.required && (
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              )}
            </Label>
            <Textarea
              {...textareaProps}
              {...fieldProps}
              aria-describedby={message ? messageId : undefined}
              aria-invalid={Boolean(fieldState.error)}
              className={cn(fullWidth && "w-full", className)}
              id={textareaId}
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
