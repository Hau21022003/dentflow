import {
  formatCurrencyOption,
  formatMajorAmountForInput,
  formatMinorAmount,
  parseMajorAmount,
} from "@/shared/lib/money";

export const MAX_SERVICE_AMOUNT = 2_147_483_647;
export const SERVICE_CURRENCY_CODES = ["VND", "USD"] as const;

export { formatCurrencyOption, formatMajorAmountForInput };

export function formatServiceAmount(
  amount: number,
  currency: string,
  locale: string,
): string {
  return formatMinorAmount(amount, currency, locale);
}

export function parseServiceAmount(
  value: string,
  currency: string,
  locale: string,
): number | null {
  return parseMajorAmount(value, currency, locale, MAX_SERVICE_AMOUNT);
}
