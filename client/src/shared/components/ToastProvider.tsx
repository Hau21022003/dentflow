import { Toast as ToastPrimitive } from "radix-ui";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ToastNotice = { id: number; title: string; description?: string };
type ToastContextValue = { success: (title: string, description?: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation("common");
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const success = useCallback((title: string, description?: string) => {
    setNotice({ id: Date.now(), title, description });
  }, []);
  const value = useMemo(() => ({ success }), [success]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider duration={4500} swipeDirection="right">
        {children}
        {notice && (
          <ToastPrimitive.Root
            className="grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-4 rounded-xl border border-border bg-popover p-4 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            key={notice.id}
            onOpenChange={(open) => {
              if (!open) setNotice(null);
            }}
            open
          >
            <div className="grid gap-1">
              <ToastPrimitive.Title className="text-sm font-semibold">
                {notice.title}
              </ToastPrimitive.Title>
              {notice.description && (
                <ToastPrimitive.Description className="text-sm text-muted-foreground">
                  {notice.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close asChild>
              <Button aria-label={t("toast.close")} size="icon-xs" type="button" variant="ghost">
                <X aria-hidden="true" />
              </Button>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )}
        <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-100 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}
