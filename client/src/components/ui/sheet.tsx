import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

type SheetSide = "top" | "right" | "bottom" | "left";

export function Sheet({ ...props }: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

export function SheetTrigger({ ...props }: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

export function SheetClose({ ...props }: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base font-bold tracking-tight", className)}
      {...props}
    />
  );
}

export function SheetContent({
  children,
  className,
  side = "left",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { side?: SheetSide }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col bg-card text-card-foreground shadow-2xl outline-none data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:border-t data-[side=bottom]:data-[state=closed]:slide-out-to-bottom data-[side=bottom]:data-[state=open]:slide-in-from-bottom data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:w-[17rem] data-[side=left]:max-w-[calc(100vw-2.5rem)] data-[side=left]:border-r data-[side=left]:data-[state=closed]:slide-out-to-left data-[side=left]:data-[state=open]:slide-in-from-left data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:w-full data-[side=right]:max-w-md data-[side=right]:border-l data-[side=right]:data-[state=closed]:slide-out-to-right data-[side=right]:data-[state=open]:slide-in-from-right data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:border-b data-[side=top]:data-[state=closed]:slide-out-to-top data-[side=top]:data-[state=open]:slide-in-from-top data-[state=closed]:animate-out data-[state=open]:animate-in",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetCloseButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <SheetClose asChild>
      <button
        aria-label="Close"
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        type="button"
        {...props}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </SheetClose>
  );
}

export type { SheetSide };
