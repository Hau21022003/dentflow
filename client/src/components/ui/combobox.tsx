import { ChevronsUpDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/shared/lib/utils";

export type ComboboxOption = {
  disabled?: boolean;
  keywords?: readonly string[];
  label: string;
  value: string;
};

export type ComboboxProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  emptyMessage: ReactNode;
  id?: string;
  onOpenChange?: (open: boolean) => void;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  value?: string;
};

export function Combobox({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  className,
  disabled = false,
  emptyMessage,
  id,
  onOpenChange,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  value,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    handleOpenChange(false);
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-describedby={ariaDescribedBy}
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            className,
          )}
          disabled={disabled}
          id={id}
          role="combobox"
          type="button"
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !selectedOption && "text-muted-foreground",
            )}
          >
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] gap-0 p-0">
        <Command defaultValue={value}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  data-checked={option.value === value}
                  disabled={option.disabled}
                  key={option.value}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  onSelect={() => handleSelect(option.value)}
                  value={option.value}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
