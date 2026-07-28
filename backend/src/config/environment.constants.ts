export const RUNTIME_ENVIRONMENTS = [
  'development',
  'test',
  'staging',
  'production',
] as const;

export type RuntimeEnvironment = (typeof RUNTIME_ENVIRONMENTS)[number];

export const MAIL_PROVIDERS = ['smtp', 'ses'] as const;

export type MailProvider = (typeof MAIL_PROVIDERS)[number];

export const SAAS_BILLING_PROVIDERS = ['stripe', 'paypal'] as const;

export type SaaSBillingProvider = (typeof SAAS_BILLING_PROVIDERS)[number];

export const PAYPAL_MODES = ['sandbox', 'live'] as const;

export type PaypalMode = (typeof PAYPAL_MODES)[number];
