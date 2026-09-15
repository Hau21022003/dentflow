import { registerAs } from '@nestjs/config';
import { parseEnvironment } from './env.validation';
import { MINIMUM_AMOUNT_BY_PROVIDER } from './saas-billing.constants';

export default registerAs('app', () => {
  const env = parseEnvironment(process.env);

  return {
    url: env.APP_URL,
    nodeEnv: env.NODE_ENV,
    cors: {
      frontendOrigin: env.FRONTEND_ORIGIN,
    },
    common: {
      appName: env.APP_NAME,
      appShortName: env.APP_SHORT_NAME,
      maxLoginAttempts: env.MAX_LOGIN_ATTEMPTS,
      uploadMaxFileSizeMb: env.UPLOAD_MAX_FILE_SIZE_MB,
      defaultPassword: env.DEFAULT_PASSWORD,
      loginLockMinutes: env.LOGIN_LOCK_MINUTES,
      bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
      timezone: env.TIMEZONE,
    },
    i18n: {
      fallbackLanguage: env.FALLBACK_LANG,
    },
    database: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      name: env.DB_NAME,
      synchronize: env.DB_SYNCHRONIZE,
      logging: env.DB_LOGGING,
      timezone: 'UTC',
    },
    redis: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      ttl: env.REDIS_TTL,
    },
    auth: {
      jwtAccess: {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
      jwtRefresh: {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      },
    },
    audit: {
      ipHmacSecret: env.AUDIT_IP_HMAC_SECRET,
    },
    idempotency: {
      hmacSecret: env.IDEMPOTENCY_HMAC_SECRET,
      processingLease: env.IDEMPOTENCY_PROCESSING_LEASE,
      completedRetention: env.IDEMPOTENCY_COMPLETED_RETENTION,
    },
    tenantInvitation: {
      tokenSecret:
        env.TENANT_INVITATION_TOKEN_SECRET ??
        'test-only-tenant-invitation-token-secret',
      ttl: env.TENANT_INVITATION_TTL,
    },
    email: {
      provider: env.MAIL_PROVIDER,
      from: env.MAIL_FROM,
      redirectTo: env.MAIL_REDIRECT_TO, // dev / staging

      smtp: {
        host: env.MAIL_HOST,
        port: env.MAIL_PORT,
        secure: env.MAIL_SECURE ?? env.MAIL_PORT === 465,
        user: env.MAIL_USER,
        pass: env.MAIL_PASS,
      },

      ses: {
        region: env.AWS_SES_REGION,
        accessKeyId: env.AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY,
      },
    },

    // ========== AWS S3 ==========
    s3: {
      enabled: env.S3_ENABLED,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      region: env.AWS_DEFAULT_REGION,
      bucket: env.AWS_BUCKET,
      endpoint: env.S3_ENDPOINT,
      presignedPostTtl: env.S3_PRESIGNED_POST_TTL,
      usePathStyleEndpoint: env.AWS_USE_PATH_STYLE_ENDPOINT ?? false,
    },

    firebase: {
      credentials: env.FIREBASE_CREDENTIALS,
      pushRedirectTokens: env.PUSH_REDIRECT_TOKENS,
    },

    saasBilling: {
      provider: env.SAAS_BILLING_PROVIDER,
      currency: env.SAAS_BILLING_CURRENCY,
      stripe: {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      },
      paypal: {
        clientId: env.PAYPAL_CLIENT_ID,
        clientSecret: env.PAYPAL_CLIENT_SECRET,
        mode: env.PAYPAL_MODE,
        webhookId: env.PAYPAL_WEBHOOK_ID,
      },
      minimumAmount: MINIMUM_AMOUNT_BY_PROVIDER,
    },
  };
});
