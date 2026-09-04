import { useState, type FormEventHandler, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/shared/lib/utils";

export type FormDialogProps = {
  children: ReactNode;
  contentClassName?: string;
  description?: ReactNode;
  isDirty?: boolean;
  isSubmitting?: boolean;
  noValidate?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  open: boolean;
  cancelText?: ReactNode;
  submitDisabled?: boolean;
  submitText: ReactNode;
  title: ReactNode;
};

export function FormDialog({
  children,
  contentClassName,
  description,
  isDirty = false,
  isSubmitting = false,
  noValidate = false,
  onOpenChange,
  onSubmit,
  open,
  cancelText,
  submitDisabled = false,
  submitText,
  title,
}: FormDialogProps) {
  const { t } = useTranslation("common");
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);

  function requestClose() {
    if (isSubmitting) {
      return;
    }

    if (isDirty) {
      setDiscardConfirmationOpen(true);
      return;
    }

    onOpenChange(false);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    requestClose();
  }

  function discardChanges() {
    setDiscardConfirmationOpen(false);
    onOpenChange(false);
  }

  const resolvedCancelText = cancelText ?? t("formDialog.cancel");

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
          contentClassName,
        )}
        showCloseButton={false}
      >
        <form className="flex min-h-0 flex-1 flex-col" noValidate={noValidate} onSubmit={onSubmit}>
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
            <DialogHeader className="gap-1 pr-3">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <Button
              aria-label={t("formDialog.close")}
              disabled={isSubmitting}
              onClick={requestClose}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

          <DialogFooter className="mx-0 mb-0 shrink-0 px-5 py-4">
            <Button disabled={isSubmitting} onClick={requestClose} type="button" variant="outline">
              {resolvedCancelText}
            </Button>
            <Button disabled={isSubmitting || submitDisabled} type="submit">
              {isSubmitting && <Spinner aria-label={t("formDialog.submitting")} />}
              {submitText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog open={discardConfirmationOpen} onOpenChange={setDiscardConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("formDialog.discardChanges.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("formDialog.discardChanges.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" variant="outline">
              {t("formDialog.discardChanges.keepEditing")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={discardChanges} type="button" variant="destructive">
              {t("formDialog.discardChanges.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
