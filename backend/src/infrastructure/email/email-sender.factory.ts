import { SESv2Client, SESv2ClientConfig } from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';
import type { EmailConfig, SmtpEmailConfig } from '../../config/email.config';
import { RuntimeEnvironment } from '../../config/environment.constants';
import { RedirectingEmailSender } from './redirecting-email.sender';
import { EmailSender } from './email.types';
import { SesEmailSender } from './providers/ses-email.sender';
import { SmtpEmailSender } from './providers/smtp-email.sender';

function createSmtpEmailSender(config: SmtpEmailConfig): EmailSender {
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    ...(config.smtp.user &&
      config.smtp.pass && {
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      }),
  });

  return new SmtpEmailSender(config, transport);
}

function createSesEmailSender(
  config: Extract<EmailConfig, { provider: 'ses' }>,
) {
  const clientConfig: SESv2ClientConfig = {
    region: config.ses.region,
  };

  if (config.ses.accessKeyId && config.ses.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.ses.accessKeyId,
      secretAccessKey: config.ses.secretAccessKey,
    };
  }

  return new SesEmailSender(config, new SESv2Client(clientConfig));
}

export function createEmailSender(
  config: EmailConfig,
  runtimeEnvironment: RuntimeEnvironment,
): EmailSender {
  const sender =
    config.provider === 'smtp'
      ? createSmtpEmailSender(config)
      : createSesEmailSender(config);

  if (
    (runtimeEnvironment === 'development' ||
      runtimeEnvironment === 'staging') &&
    config.redirectTo
  ) {
    return new RedirectingEmailSender(sender, config.redirectTo);
  }

  return sender;
}
