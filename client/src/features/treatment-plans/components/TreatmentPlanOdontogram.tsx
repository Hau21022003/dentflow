import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { Eraser, Maximize2, MoveDiagonal2, MousePointer2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DentalChart } from "./DentalChart";
import { formatFdiPosition } from "./treatment-plan-odontogram";
import {
  PERMANENT_TOOTH_LAYOUT,
  PRIMARY_TOOTH_LAYOUT,
} from "./tooth-layout";

export type Dentition = "permanent" | "primary";

function DentitionPicker({
  dentition,
  label,
  onChange,
  primaryLabel,
  permanentLabel,
}: {
  dentition: Dentition;
  label: string;
  onChange: (dentition: Dentition) => void;
  primaryLabel: string;
  permanentLabel: string;
}) {
  const labels = { permanent: permanentLabel, primary: primaryLabel };

  return (
    <div
      aria-label={label}
      className="inline-flex h-9 w-fit shrink-0 items-center rounded-xl bg-muted p-1"
      role="group"
    >
      {(["permanent", "primary"] as const).map((value) => (
        <button
          aria-pressed={dentition === value}
          className={cn(
            "inline-flex h-7 items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4",
            dentition === value
              ? "bg-background text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          key={value}
          onClick={() => onChange(value)}
          type="button"
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}

export function TreatmentPlanOdontogram({
  dentition,
  onClear,
  onDentitionChange,
  onToggle,
  selectedCodes,
}: {
  dentition: Dentition;
  onClear: () => void;
  onDentitionChange: (dentition: Dentition) => void;
  onToggle: (code: string) => void;
  selectedCodes: readonly string[];
}) {
  const { t } = useTranslation("treatmentPlans");
  const [zoomOpen, setZoomOpen] = useState(false);
  const teeth =
    dentition === "permanent"
      ? PERMANENT_TOOTH_LAYOUT
      : PRIMARY_TOOTH_LAYOUT;

  return (
    <Card className="overflow-hidden xl:sticky xl:top-4">
      <CardHeader className="border-b px-3 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="min-w-0">{t("odontogram.title")}</CardTitle>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <DentitionPicker
              dentition={dentition}
              label={t("odontogram.dentitionLabel")}
              onChange={onDentitionChange}
              permanentLabel={t("odontogram.dentitions.permanent")}
              primaryLabel={t("odontogram.dentitions.primary")}
            />
            <Button
              aria-label={t("odontogram.zoom")}
              className="sm:hidden"
              onClick={() => setZoomOpen(true)}
              size="icon"
              title={t("odontogram.zoom")}
              type="button"
              variant="outline"
            >
              <Maximize2 aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:space-y-4 sm:p-5">
        <DentalChart
          lowerLabel={t("odontogram.lowerArch")}
          onToggle={onToggle}
          selectedCodes={selectedCodes}
          teeth={teeth}
          toothLabel={(code) => t("odontogram.toothLabel", { code })}
          upperLabel={t("odontogram.upperArch")}
        />

        <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <MousePointer2 aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-primary">
                  {t("odontogram.selectedCount", { count: selectedCodes.length })}
                </span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {selectedCodes.length > 0
                    ? t("odontogram.selectedList", {
                        codes: formatFdiPosition(selectedCodes),
                      })
                    : t("odontogram.description")}
                </span>
              </span>
            </div>
            <Button
              disabled={selectedCodes.length === 0}
              onClick={onClear}
              size="sm"
              type="button"
              variant="outline"
            >
              <Eraser aria-hidden="true" />
              {t("odontogram.clear")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-sm border border-primary bg-primary/25" />
            {t("odontogram.legend.selected")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-sm border border-input bg-background" />
            {t("odontogram.legend.normal")}
          </span>
        </div>
      </CardContent>

      <Dialog onOpenChange={setZoomOpen} open={zoomOpen}>
        <DialogContent
          aria-describedby="odontogram-zoom-description"
          className="inset-0 top-0 left-0 h-svh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none p-0 sm:max-w-none"
          showCloseButton={false}
        >
          <DialogHeader className="border-b bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>{t("odontogram.zoomTitle")}</DialogTitle>
              <DialogClose asChild>
                <Button
                  aria-label={t("actions.close")}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                </Button>
              </DialogClose>
            </div>
            <DentitionPicker
              dentition={dentition}
              label={t("odontogram.dentitionLabel")}
              onChange={onDentitionChange}
              permanentLabel={t("odontogram.dentitions.permanent")}
              primaryLabel={t("odontogram.dentitions.primary")}
            />
          </DialogHeader>

          <div className="min-h-0 overflow-auto overscroll-contain p-4 touch-pan-x">
            <div className="flex min-h-full min-w-max items-center">
              <DentalChart
                expanded
                lowerLabel={t("odontogram.lowerArch")}
                onToggle={onToggle}
                selectedCodes={selectedCodes}
                teeth={teeth}
                toothLabel={(code) => t("odontogram.toothLabel", { code })}
                upperLabel={t("odontogram.upperArch")}
              />
            </div>
          </div>

          <DialogDescription
            className="m-3 flex items-center justify-center gap-2 rounded-xl border bg-muted/40 p-3 text-center text-xs"
            id="odontogram-zoom-description"
          >
            <MoveDiagonal2 aria-hidden="true" className="size-4 shrink-0" />
            {t("odontogram.zoomHint")}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
