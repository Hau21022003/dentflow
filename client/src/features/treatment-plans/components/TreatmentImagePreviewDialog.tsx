import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  src: string | null;
};

export function TreatmentImagePreviewDialog({
  onOpenChange,
  open,
  src,
}: Props) {
  const { t } = useTranslation("treatmentPlans");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92svh] max-w-[calc(100%-1rem)] gap-3 overflow-hidden p-3 sm:max-w-4xl"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between gap-3">
          <DialogTitle>{t("progress.imagePreviewTitle")}</DialogTitle>
          <Button
            aria-label={t("actions.close")}
            onClick={() => onOpenChange(false)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </DialogHeader>
        {src && (
          <div className="grid min-h-0 place-items-center overflow-auto rounded-lg bg-black/90">
            <img
              alt={t("progress.imagePreviewAlt")}
              className="max-h-[78svh] max-w-full object-contain"
              src={src}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
