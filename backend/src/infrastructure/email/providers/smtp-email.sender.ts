import type { SmtpEmailConfig } from '../../../config/email.config';
import { normalizeEmailCommand } from '../email-message.validation';
import { EmailSender, EmailSendResult, SendEmailCommand } from '../email.types';

interface SmtpTransport {
  sendMail(message: {
    from: string;
    to: string[];
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId?: string }>;
}

export class SmtpEmailSender implements EmailSender {
  constructor(
    private readonly config: SmtpEmailConfig,
    private readonly transport: SmtpTransport,
  ) {}

  async send(command: SendEmailCommand): Promise<EmailSendResult> {
    const message = normalizeEmailCommand(command);
    const response = await this.transport.sendMail({
      from: this.config.from,
      ...message,
      to: [...message.to],
    });

    if (!response.messageId) {
      throw new Error('SMTP provider did not return a message ID.');
    }

    return {
      provider: 'smtp',
      messageId: response.messageId,
    };
  }
}
