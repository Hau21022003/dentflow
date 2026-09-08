import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue } from 'ms';
import {
  MailProvider,
  PaypalMode,
  RuntimeEnvironment,
  SaaSBillingProvider,
} from './environment.constants';
import type { EmailConfig } from './email.config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get authConfig() {
    const jwtAccessExpiresIn = this.config.getOrThrow<string>(
      'app.auth.jwtAccess.expiresIn',
    );
    const jwtRefreshExpiresIn = this.config.getOrThrow<string>(
      'app.auth.jwtRefresh.expiresIn',
    );

    return {
      jwtAccess: {
        secret: this.config.getOrThrow<string>('app.auth.jwtAccess.secret'),
        expiresIn: jwtAccessExpiresIn,
        expiresInMs: ms(jwtAccessExpiresIn as StringValue),
      },
      jwtRefresh: {
        secret: this.config.getOrThrow<string>('app.auth.jwtRefresh.secret'),
        expiresIn: jwtRefreshExpiresIn,
        expiresInMs: ms(jwtRefreshExpiresIn as StringValue),
      },
    };
  }

  get auditConfig() {
    return {
      ipHmacSecret: this.config.getOrThrow<string>('app.audit.ipHmacSecret'),
    };
  }

  get idempotencyConfig() {
    const processingLease = this.config.getOrThrow<string>(
      'app.idempotency.processingLease',
    );
    const completedRetention = this.config.getOrThrow<string>(
      'app.idempotency.completedRetention',
    );

    return {
      hmacSecret: this.config.getOrThrow<string>('app.idempotency.hmacSecret'),
      processingLeaseMs: ms(processingLease as StringValue),
      completedRetentionMs: ms(completedRetention as StringValue),
    };
  }

  get tenantInvitationConfig() {
    const ttl = this.config.getOrThrow<string>('app.tenantInvitation.ttl');

    return {
      tokenSecret: this.config.getOrThrow<string>(
        'app.tenantInvitation.tokenSecret',
      ),
      ttlMs: ms(ttl as StringValue),
    };
  }

  get corsConfig() {
    return {
      frontendOrigin: this.config.getOrThrow<string>('app.cors.frontendOrigin'),
    };
  }

  // ========== REDIS ==========
  get redisConfig() {
    return {
      host: this.config.getOrThrow<string>('app.redis.host'),
      port: this.config.getOrThrow<number>('app.redis.port'),
      ttl: this.config.getOrThrow<number>('app.redis.ttl'),
    };
  }

  // ========== DATABASE ==========
  get databaseConfig() {
    return {
      host: this.config.getOrThrow<string>('app.database.host'),
      port: this.config.getOrThrow<number>('app.database.port'),
      username: this.config.getOrThrow<string>('app.database.username'),
      password: this.config.getOrThrow<string>('app.database.password'),
      database: this.config.getOrThrow<string>('app.database.name'),
      synchronize: this.config.get<boolean>('app.database.synchronize', false),
      logging: this.config.get<boolean>('app.database.logging', false),
    };
  }

  // ========== EMAIL ==========
  get emailConfig(): EmailConfig {
    const provider = this.config.getOrThrow<MailProvider>('app.email.provider');
    const from = this.config.getOrThrow<string>('app.email.from');
    const redirectTo = this.config.get<string>('app.email.redirectTo');

    if (provider === 'smtp') {
      return {
        provider,
        from,
        redirectTo,
        smtp: {
          host: this.config.getOrThrow<string>('app.email.smtp.host'),
          port: this.config.getOrThrow<number>('app.email.smtp.port'),
          secure: this.config.getOrThrow<boolean>('app.email.smtp.secure'),
          user: this.config.get<string>('app.email.smtp.user'),
          pass: this.config.get<string>('app.email.smtp.pass'),
        },
      };
    }

    if (provider === 'ses') {
      return {
        provider,
        from,
        redirectTo,
        ses: {
          region: this.config.getOrThrow<string>('app.email.ses.region'),
          accessKeyId: this.config.get<string>('app.email.ses.accessKeyId'),
          secretAccessKey: this.config.get<string>(
            'app.email.ses.secretAccessKey',
          ),
        },
      };
    }

    throw new Error('Unsupported mail provider.');
  }

  // ========== UPLOAD ==========
  get uploadConfig() {
    const maxFileSizeMb = this.config.getOrThrow<number>(
      'app.common.uploadMaxFileSizeMb',
    );

    return {
      maxFileSizeMb,
      maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    };
  }

  // ========== AWS S3 ==========
  get s3Config() {
    return {
      accessKeyId: this.config.getOrThrow<string>('app.s3.accessKeyId'),
      secretAccessKey: this.config.getOrThrow<string>('app.s3.secretAccessKey'),
      region: this.config.getOrThrow<string>('app.s3.region'),
      bucket: this.config.getOrThrow<string>('app.s3.bucket'),
      usePathStyleEndpoint: this.config.get<boolean>(
        'app.s3.usePathStyleEndpoint',
        false,
      ),
    };
  }

  // ========== FIREBASE ==========
  get firebaseConfig() {
    return {
      credentials: this.config.getOrThrow<string>('app.firebase.credentials'),
      pushRedirectTokens: (
        this.config.get<string>('app.firebase.pushRedirectTokens') ?? ''
      )
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean),
    };
  }

  // ========== SAAS BILLING ==========
  get saasBillingConfig() {
    const provider = this.config.getOrThrow<SaaSBillingProvider>(
      'app.saasBilling.provider',
    );
    const currency = this.config.getOrThrow<string>('app.saasBilling.currency');
    const minimumAmount = this.config.get<number>(
      `app.saasBilling.minimumAmount.${provider}.${currency}`,
    );

    if (minimumAmount === undefined) {
      throw new Error(
        `SaaS billing currency ${currency} is not supported by ${provider}.`,
      );
    }

    switch (provider) {
      case 'stripe':
        return {
          provider,
          currency,
          minimumAmount,
          secretKey: this.config.getOrThrow<string>(
            'app.saasBilling.stripe.secretKey',
          ),
          webhookSecret: this.config.getOrThrow<string>(
            'app.saasBilling.stripe.webhookSecret',
          ),
        };
      case 'paypal':
        return {
          provider,
          currency,
          minimumAmount,
          clientId: this.config.getOrThrow<string>(
            'app.saasBilling.paypal.clientId',
          ),
          clientSecret: this.config.getOrThrow<string>(
            'app.saasBilling.paypal.clientSecret',
          ),
          mode: this.config.getOrThrow<PaypalMode>(
            'app.saasBilling.paypal.mode',
          ),
          webhookId: this.config.getOrThrow<string>(
            'app.saasBilling.paypal.webhookId',
          ),
        };
    }
  }

  // ========= I18N ==========
  get i18nConfig() {
    return {
      fallbackLanguage: this.config.getOrThrow<string>(
        'app.i18n.fallbackLanguage',
      ),
    };
  }

  // ========== RUNTIME ==========
  get runtimeConfig() {
    const nodeEnv = this.config.getOrThrow<RuntimeEnvironment>('app.nodeEnv');

    return {
      nodeEnv,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
      isTesting: nodeEnv === 'test',
      isStaging: nodeEnv === 'staging',
    };
  }

  // ========== APPLICATION ==========
  get applicationConfig() {
    return {
      name: this.config.getOrThrow<string>('app.common.appName'),
      shortName: this.config.getOrThrow<string>('app.common.appShortName'),
      url: this.config.getOrThrow<string>('app.url'),
      timezone: this.config.getOrThrow<string>('app.common.timezone'),
    };
  }

  // ========== SECURITY ==========
  get securityConfig() {
    const loginLockMinutes = this.config.getOrThrow<number>(
      'app.common.loginLockMinutes',
    );
    const defaultPassword = this.runtimeConfig.isTesting
      ? this.config.get<string>('app.common.defaultPassword', '12345')
      : this.config.getOrThrow<string>('app.common.defaultPassword');

    return {
      maxLoginAttempts: this.config.getOrThrow<number>(
        'app.common.maxLoginAttempts',
      ),
      loginLockMinutes,
      loginLockSeconds: loginLockMinutes * 60,
      bcryptSaltRounds: this.config.getOrThrow<number>(
        'app.common.bcryptSaltRounds',
      ),
      defaultPassword,
    };
  }
}
