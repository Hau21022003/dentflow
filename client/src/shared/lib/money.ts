export function localeForLanguage(language: string | undefined): string {
  return language === "en" ? "en-US" : "vi-VN";
}

export function getCurrencyFractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatMinorAmount(
  amount: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount / 10 ** getCurrencyFractionDigits(currency));
}

export function formatCurrencyOption(currency: string, locale: string): string {
  try {
    const displayName = new Intl.DisplayNames(locale, { type: "currency" }).of(
      currency,
    );

    return displayName ? `${currency} — ${displayName}` : currency;
  } catch {
    return currency;
  }
}

export function formatMajorAmountForInput(
  amount: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: getCurrencyFractionDigits(currency),
  }).format(amount / 10 ** getCurrencyFractionDigits(currency));
}

export function parseMajorAmount(
  value: string,
  currency: string,
  locale: string,
  maximumAmount: number,
): number | null {
  const normalized = normalizeLocalizedDecimal(value, locale, currency);
  const fractionDigits = getCurrencyFractionDigits(currency);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);

  if (!match) {
    return null;
  }

  const integerPart = match[1];
  const fractionPart = match[2] ?? "";
  if (fractionPart.length > fractionDigits) {
    return null;
  }

  const minorAmount = Number(
    `${integerPart}${fractionPart.padEnd(fractionDigits, "0")}`,
  );

  return Number.isSafeInteger(minorAmount) &&
    minorAmount >= 0 &&
    minorAmount <= maximumAmount
    ? minorAmount
    : null;
}

function normalizeLocalizedDecimal(
  value: string,
  locale: string,
  currency: string,
): string {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).formatToParts(12345.6);
  const group = parts.find((part) => part.type === "group")?.value ?? ",";
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";

  return value
    .trim()
    .replaceAll(" ", "")
    .replaceAll(group, "")
    .replace(decimal, ".");
}
