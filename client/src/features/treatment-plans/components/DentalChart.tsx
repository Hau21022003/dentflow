import { cn } from "@/shared/lib/utils";
import { TOOTH_ASSETS } from "./tooth-assets";
import {
  DENTAL_CHART_VIEWBOX,
  type ToothLayout,
} from "./tooth-layout";

export function DentalChart({
  disabledCodes = [],
  expanded = false,
  lowerLabel,
  onToggle,
  readOnly = false,
  selectedCodes,
  teeth,
  toothLabel,
  upperLabel,
}: {
  disabledCodes?: readonly string[];
  expanded?: boolean;
  lowerLabel: string;
  onToggle: (code: string) => void;
  readOnly?: boolean;
  selectedCodes: readonly string[];
  teeth: readonly ToothLayout[];
  toothLabel: (code: string) => string;
  upperLabel: string;
}) {
  const selected = new Set(selectedCodes);
  const disabled = new Set(disabledCodes);

  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/20",
        expanded
          ? "w-[720px] max-w-none overflow-visible"
          : "w-full max-w-full overflow-hidden",
      )}
    >
      <svg
        aria-label={`${upperLabel}, ${lowerLabel}`}
        className={cn(
          "block h-auto",
          expanded ? "w-[720px] max-w-none" : "w-full min-w-0",
        )}
        role="group"
        viewBox={`0 0 ${DENTAL_CHART_VIEWBOX.width} ${DENTAL_CHART_VIEWBOX.height}`}
      >
        <path
          aria-hidden="true"
          className="fill-none stroke-border/60"
          d="M24 103C164 26 278 58 360 106C442 58 556 26 696 103"
          strokeDasharray="3 7"
          strokeLinecap="round"
        />
        <path
          aria-hidden="true"
          className="fill-none stroke-border/60"
          d="M24 237C164 314 278 282 360 234C442 282 556 314 696 237"
          strokeDasharray="3 7"
          strokeLinecap="round"
        />
        <line
          aria-hidden="true"
          className="stroke-border/60"
          strokeDasharray="2 6"
          x1="360"
          x2="360"
          y1="55"
          y2="285"
        />

        <text className="fill-muted-foreground text-[11px] font-medium" textAnchor="middle" x="360" y="24">
          {upperLabel}
        </text>
        <text className="fill-muted-foreground text-[11px] font-medium" textAnchor="middle" x="360" y="326">
          {lowerLabel}
        </text>

        {teeth.map((tooth) => {
          const asset = TOOTH_ASSETS[tooth.type];
          const isSelected = selected.has(tooth.number);
          const isDisabled = disabled.has(tooth.number);
          const verticalScale = tooth.jaw === "upper" ? -tooth.scale : tooth.scale;
          const labelY = tooth.jaw === "upper" ? tooth.y + 43 : tooth.y - 41;

          return (
            <g key={tooth.number}>
              <g
                aria-disabled={!readOnly && isDisabled ? true : undefined}
                aria-label={toothLabel(tooth.number)}
                aria-pressed={readOnly ? undefined : isSelected}
                className={cn(
                  "group outline-none",
                  readOnly
                    ? "cursor-default"
                    : isDisabled
                      ? "cursor-not-allowed opacity-40"
                      : "cursor-pointer",
                )}
                onClick={() => !readOnly && !isDisabled && onToggle(tooth.number)}
                onKeyDown={(event) => {
                  if (
                    readOnly ||
                    isDisabled ||
                    (event.key !== "Enter" && event.key !== " ")
                  )
                    return;
                  event.preventDefault();
                  onToggle(tooth.number);
                }}
                role={readOnly ? "img" : "button"}
                tabIndex={readOnly || isDisabled ? -1 : 0}
                transform={`translate(${tooth.x} ${tooth.y}) rotate(${tooth.rotation})`}
              >
                <rect
                  aria-hidden="true"
                  className="fill-transparent stroke-primary opacity-0 transition-opacity group-focus-visible:opacity-100"
                  height="76"
                  rx="7"
                  strokeWidth="2"
                  transform={`scale(${tooth.scaleX} ${tooth.jaw === "upper" ? -1 : 1})`}
                  width="42"
                  x="-21"
                  y="-38"
                />
                <g transform={`scale(${tooth.scale * tooth.scaleX} ${verticalScale})`}>
                  <path
                    className={cn(
                      "fill-background stroke-input transition-colors duration-150 group-hover:stroke-primary/70",
                      isSelected && "fill-primary/25 stroke-primary",
                    )}
                    d={asset.outline}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.65"
                  />
                  {asset.details.map((detail) => (
                    <path
                      className={cn("fill-none stroke-border transition-colors duration-150", isSelected && "stroke-primary/70")}
                      d={detail}
                      key={detail}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.05"
                    />
                  ))}
                </g>
              </g>
              <text
                aria-hidden="true"
                className={cn(
                  "pointer-events-none fill-muted-foreground text-[10px] font-medium",
                  isSelected && "fill-primary font-semibold",
                  isDisabled && "opacity-40",
                )}
                textAnchor="middle"
                x={tooth.x}
                y={labelY}
              >
                {tooth.number}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
