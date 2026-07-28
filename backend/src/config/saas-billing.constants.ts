import type { SaaSBillingProvider } from './environment.constants';

const MINIMUM_AMOUNT_BY_CURRENCY = {
  USD: 0.5,
  AED: 2.0,
  AUD: 0.5,
  BGN: 1.0,
  BRL: 0.5,
  CAD: 0.5,
  CHF: 0.5,
  CZK: 15.0,
  DKK: 2.5,
  EUR: 0.5,
  GBP: 0.3,
  HKD: 4.0,
  HRK: 0.5,
  HUF: 175.0,
  INR: 0.5,
  JPY: 50.0,
  MXN: 10.0,
  MYR: 2.0,
  NOK: 3.0,
  NZD: 0.5,
  PLN: 2.0,
  RON: 2.0,
  SEK: 3.0,
  SGD: 0.5,
  THB: 10.0,
} as const satisfies Readonly<Record<string, number>>;

export const MINIMUM_AMOUNT_BY_PROVIDER = {
  stripe: MINIMUM_AMOUNT_BY_CURRENCY,
  paypal: MINIMUM_AMOUNT_BY_CURRENCY,
} as const satisfies Readonly<
  Record<SaaSBillingProvider, Readonly<Record<string, number>>>
>;
