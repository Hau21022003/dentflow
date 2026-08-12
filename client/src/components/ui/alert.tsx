import { cn } from "@/shared/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-sm [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        destructive: "border-destructive/25 bg-destructive/5 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type AlertProps = ComponentProps<"div"> & VariantProps<typeof alertVariants>;

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
