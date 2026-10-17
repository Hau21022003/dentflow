import {
  PERMANENT_TOOTH_LAYOUT,
  PRIMARY_TOOTH_LAYOUT,
} from "./tooth-layout";

const ALL_FDI_CODES = [
  ...PERMANENT_TOOTH_LAYOUT.map(({ number }) => number),
  ...PRIMARY_TOOTH_LAYOUT.map(({ number }) => number),
] as const;
const FDI_CODE_SET = new Set<string>(ALL_FDI_CODES);
const FDI_ORDER = new Map<string, number>(
  ALL_FDI_CODES.map((code, index) => [code, index]),
);

function sortFdiCodes(codes: string[]): string[] {
  return [...codes].sort(
    (left, right) =>
      (FDI_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (FDI_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function parseFdiPosition(value: string | null | undefined): {
  codes: string[];
  hasLegacyText: boolean;
} {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { codes: [], hasLegacyText: false };

  const tokens = trimmed.split(/[\s,;]+/).filter(Boolean);
  const codes = Array.from(
    new Set(tokens.filter((token) => FDI_CODE_SET.has(token))),
  );

  return {
    codes: sortFdiCodes(codes),
    hasLegacyText: tokens.some((token) => !FDI_CODE_SET.has(token)),
  };
}

export function formatFdiPosition(codes: Iterable<string>): string {
  return sortFdiCodes(Array.from(new Set(codes))).join(", ");
}
