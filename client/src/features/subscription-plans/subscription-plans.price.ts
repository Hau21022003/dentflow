import {
  formatCurrencyOption,
  formatMajorAmountForInput,
  formatMinorAmount,
  getCurrencyFractionDigits,
  localeForLanguage,
  parseMajorAmount as parseMinorAmount,
} from "@/shared/lib/money";

export const MAX_SUBSCRIPTION_PLAN_AMOUNT = 2_147_483_647;
export const PLAN_CURRENCY_CODES = ["VND", "USD"] as const;

export {
  formatCurrencyOption,
  formatMajorAmountForInput,
  getCurrencyFractionDigits,
  localeForLanguage,
};

export function formatSubscriptionPlanAmount(
  amount: number,
  currency: string,
  locale: string,
): string {
  return formatMinorAmount(amount, currency, locale);
}

export function parseMajorAmount(
  value: string,
  currency: string,
  locale: string,
): number | null {
  return parseMinorAmount(value, currency, locale, MAX_SUBSCRIPTION_PLAN_AMOUNT);
}
