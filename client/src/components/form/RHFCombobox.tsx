import { useId, type ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from "react-hook-form";
import {
  Combobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

export type RHFComboboxOption = ComboboxOption;

export type RHFComboboxProps<TFieldValues extends FieldValues> = {
  className?: string;
  control: Control<TFieldValues>;
  disabled?: boolean;
  emptyMessage?: ReactNode;
  fullWidth?: boolean;
  helperText?: ReactNode;
  label: ReactNode;
  name: FieldPath<TFieldValues>;
  options: readonly RHFComboboxOption[];
  placeholder?: string;
  required?: boolean;
  rules?: RegisterOptions<TFieldValues, FieldPath<TFieldValues>>;
  searchPlaceholder?: string;
};

export function RHFCombobox<TFieldValues extends FieldValues>({
  className,
  control,
  disabled = false,
  emptyMessage,
  fullWidth = false,
  helperText,
  label,
  name,
  options,
  placeholder,
  required = false,
  rules,
  searchPlaceholder,
}: RHFComboboxProps<TFieldValues>) {
  const { t } = useTranslation("common");
  const comboboxId = useId();
  const messageId = `${comboboxId}-message`;
  const resolvedPlaceholder = placeholder ?? t("form.combobox.placeholder");
  const resolvedSearchPlaceholder =
    searchPlaceholder ?? t("form.combobox.searchPlaceholder");
  const resolvedEmptyMessage = emptyMessage ?? t("form.combobox.noResults");

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => {
        const message = fieldState.error?.message ?? helperText;

        return (
          <div className={fullWidth ? "grid w-full gap-2" : "grid gap-2"}>
            <Label htmlFor={comboboxId}>
              {label}
              {required && <span aria-hidden="true" className="text-destructive">*</span>}
            </Label>
            <Combobox
              aria-describedby={message ? messageId : undefined}
              aria-invalid={Boolean(fieldState.error)}
              className={className}
              disabled={disabled}
              emptyMessage={resolvedEmptyMessage}
              id={comboboxId}
              onOpenChange={(open) => {
                if (!open) field.onBlur();
              }}
              onValueChange={field.onChange}
              options={options}
              placeholder={resolvedPlaceholder}
              searchPlaceholder={resolvedSearchPlaceholder}
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
