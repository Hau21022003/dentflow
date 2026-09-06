// import ms from 'ms';
import ms, { StringValue } from 'ms';
import { z } from 'zod';
import {
  MAIL_PROVIDERS,
  PAYPAL_MODES,
  RUNTIME_ENVIRONMENTS,
  SAAS_BILLING_PROVIDERS,
} from './environment.constants';

type Environment = Record<string, string | undefined>;

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
};

const requiredText = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1, 'is required.'),
);

const requiredUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1, 'is required.').url('must be a valid URL.'),
);

const optionalText = z.preprocess(
  emptyToUndefined,
  z.string().trim().optional(),
);

const currencyCode = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'must be a three-letter ISO currency code.')
    .transform((value) => value.toUpperCase()),
);

const positiveInteger = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive(),
);

const optionalPositiveInteger = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

const bcryptSaltRounds = z
  .preprocess(emptyToUndefined, z.coerce.number().int().min(4).max(31))
  .default(12);

const booleanFlag = z.preprocess(
  emptyToUndefined,
  z.enum(['true', 'false']).transform((value) => value === 'true'),
);

const duration = requiredText.refine((value) => {
  const parsed = ms(value as StringValue);
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0;
}, 'must be a positive duration accepted by the ms package.');

const timezone = optionalText.refine((value) => {
  if (!value) {
    return true;
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, 'must be a valid IANA timezone.');

export const envSchema = z
  .object({
    NODE_ENV: z
      .preprocess(emptyToUndefined, z.enum(RUNTIME_ENVIRONMENTS))
      .default('development'),
    RUNTIME_ENV_ONLY: booleanFlag.default(false),

    APP_URL: requiredUrl,
    FRONTEND_ORIGIN: requiredUrl,
    APP_NAME: requiredText,
    APP_SHORT_NAME: requiredText,
    TIMEZONE: timezone,
    FALLBACK_LANG: optionalText.default('en'),

    DB_HOST: requiredText,
    DB_PORT: positiveInteger,
    DB_USERNAME: requiredText,
    DB_PASSWORD: requiredText,
    DB_NAME: requiredText,
    DB_SYNCHRONIZE: booleanFlag.default(false),
    DB_LOGGING: booleanFlag.default(false),

    REDIS_HOST: requiredText,
    REDIS_PORT: positiveInteger,
    REDIS_TTL: positiveInteger,

    JWT_ACCESS_SECRET: requiredText,
    JWT_ACCESS_EXPIRES_IN: duration,
    JWT_REFRESH_SECRET: requiredText,
    JWT_REFRESH_EXPIRES_IN: duration,
    AUDIT_IP_HMAC_SECRET: requiredText,
    IDEMPOTENCY_HMAC_SECRET: requiredText,
    IDEMPOTENCY_PROCESSING_LEASE: duration.default('5m'),
    IDEMPOTENCY_COMPLETED_RETENTION: duration.default('30d'),

    PORT: optionalPositiveInteger,
    UPLOAD_MAX_FILE_SIZE_MB: optionalPositiveInteger,
    MAX_LOGIN_ATTEMPTS: optionalPositiveInteger,
    LOGIN_LOCK_MINUTES: optionalPositiveInteger,
    BCRYPT_SALT_ROUNDS: bcryptSaltRounds,
    DEFAULT_PASSWORD: optionalText,

    MAIL_PROVIDER: z
      .preprocess(emptyToUndefined, z.enum(MAIL_PROVIDERS))
      .default('smtp'),
    MAIL_FROM: requiredText,
    MAIL_REDIRECT_TO: requiredText,
    MAIL_HOST: optionalText,
    MAIL_PORT: optionalPositiveInteger,
    MAIL_USER: optionalText,
    MAIL_PASS: optionalText,
    AWS_SES_REGION: optionalText,
    AWS_USE_PATH_STYLE_ENDPOINT: booleanFlag.optional(),

    AWS_SES_ACCESS_KEY_ID: optionalText,
    AWS_SES_SECRET_ACCESS_KEY: optionalText,
    AWS_ACCESS_KEY_ID: optionalText,
    AWS_SECRET_ACCESS_KEY: optionalText,
    AWS_DEFAULT_REGION: optionalText,
    AWS_BUCKET: optionalText,
    FIREBASE_CREDENTIALS: optionalText,
    PUSH_REDIRECT_TOKENS: optionalText,
    SAAS_BILLING_PROVIDER: z
      .preprocess(emptyToUndefined, z.enum(SAAS_BILLING_PROVIDERS))
      .default('stripe'),
    SAAS_BILLING_CURRENCY: currencyCode.default('USD'),
    STRIPE_SECRET_KEY: optionalText,
    STRIPE_WEBHOOK_SECRET: optionalText,
    PAYPAL_CLIENT_ID: optionalText,
    PAYPAL_CLIENT_SECRET: optionalText,
    PAYPAL_MODE: z
      .preprocess(emptyToUndefined, z.enum(PAYPAL_MODES))
      .default('sandbox'),
    PAYPAL_WEBHOOK_ID: optionalText,
  })
  .passthrough()
  .superRefine((environment, context) => {
    const addRequiredIssue = (name: string): void => {
      context.addIssue({
        code: 'custom',
        path: [name],
        message: `${name} is required.`,
      });
    };

    if (environment.NODE_ENV !== 'test' && !environment.DEFAULT_PASSWORD) {
      addRequiredIssue('DEFAULT_PASSWORD');
    }

    if (environment.MAIL_PROVIDER === 'smtp') {
      if (!environment.MAIL_HOST) {
        addRequiredIssue('MAIL_HOST');
      }
      if (!environment.MAIL_PORT) {
        addRequiredIssue('MAIL_PORT');
      }
      if (!environment.MAIL_USER) {
        addRequiredIssue('MAIL_USER');
      }
      if (!environment.MAIL_PASS) {
        addRequiredIssue('MAIL_PASS');
      }
    }

    if (environment.MAIL_PROVIDER === 'ses' && !environment.AWS_SES_REGION) {
      addRequiredIssue('AWS_SES_REGION');
    }

    if (environment.SAAS_BILLING_PROVIDER === 'stripe') {
      if (!environment.STRIPE_SECRET_KEY) {
        addRequiredIssue('STRIPE_SECRET_KEY');
      }
      if (!environment.STRIPE_WEBHOOK_SECRET) {
        addRequiredIssue('STRIPE_WEBHOOK_SECRET');
      }
    }

    if (environment.SAAS_BILLING_PROVIDER === 'paypal') {
      if (!environment.PAYPAL_CLIENT_ID) {
        addRequiredIssue('PAYPAL_CLIENT_ID');
      }
      if (!environment.PAYPAL_CLIENT_SECRET) {
        addRequiredIssue('PAYPAL_CLIENT_SECRET');
      }
      if (!environment.PAYPAL_WEBHOOK_ID) {
        addRequiredIssue('PAYPAL_WEBHOOK_ID');
      }
    }
  });

export type EnvironmentConfig = z.infer<typeof envSchema>;

export function parseEnvironment(environment: Environment): EnvironmentConfig {
  const result = envSchema.safeParse(environment);

  if (result.success) {
    return result.data;
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.') || 'environment';
    return `${path} ${issue.message}`;
  });

  throw new Error(
    `Invalid environment configuration:\n- ${errors.join('\n- ')}`,
  );
}

export function validateEnvironment(
  environment: Environment,
): EnvironmentConfig {
  return parseEnvironment(environment);
}
