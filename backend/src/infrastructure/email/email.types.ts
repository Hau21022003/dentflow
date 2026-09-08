import { MailProvider } from '../../config/environment.constants';

/**
 * Provider-neutral command for transactional email delivery.
 *
 * The sender address is deliberately not caller-controlled: every adapter uses
 * the configured MAIL_FROM address.
 */
export interface SendEmailCommand {
  to: readonly string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailSendResult {
  provider: MailProvider;
  messageId: string;
}

export interface EmailSender {
  send(command: SendEmailCommand): Promise<EmailSendResult>;
}
