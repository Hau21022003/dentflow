import { normalizeEmailCommand } from './email-message.validation';
import { EmailSender, EmailSendResult, SendEmailCommand } from './email.types';

/**
 * Keeps non-production mail inside a safe mailbox without exposing the
 * original recipients in message content or transport metadata.
 */
export class RedirectingEmailSender implements EmailSender {
  constructor(
    private readonly delegate: EmailSender,
    private readonly redirectTo: string,
  ) {}

  async send(command: SendEmailCommand): Promise<EmailSendResult> {
    const normalizedCommand = normalizeEmailCommand(command);

    return this.delegate.send({
      ...normalizedCommand,
      to: [this.redirectTo],
    });
  }
}
