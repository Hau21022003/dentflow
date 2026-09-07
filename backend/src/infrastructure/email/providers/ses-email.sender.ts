import { SendEmailCommand as SesSendEmailCommand } from '@aws-sdk/client-sesv2';
import type { SesEmailConfig } from '../../../config/email.config';
import { normalizeEmailCommand } from '../email-message.validation';
import { EmailSender, EmailSendResult, SendEmailCommand } from '../email.types';

interface SesClient {
  send(command: SesSendEmailCommand): Promise<{ MessageId?: string }>;
}

export class SesEmailSender implements EmailSender {
  constructor(
    private readonly config: SesEmailConfig,
    private readonly client: SesClient,
  ) {}

  async send(command: SendEmailCommand): Promise<EmailSendResult> {
    const message = normalizeEmailCommand(command);
    const response = await this.client.send(
      new SesSendEmailCommand({
        FromEmailAddress: this.config.from,
        Destination: {
          ToAddresses: [...message.to],
        },
        Content: {
          Simple: {
            Subject: {
              Data: message.subject,
              Charset: 'UTF-8',
            },
            Body: {
              ...(message.text !== undefined && {
                Text: {
                  Data: message.text,
                  Charset: 'UTF-8',
                },
              }),
              ...(message.html !== undefined && {
                Html: {
                  Data: message.html,
                  Charset: 'UTF-8',
                },
              }),
            },
          },
        },
      }),
    );

    if (!response.MessageId) {
      throw new Error('SES provider did not return a message ID.');
    }

    return {
      provider: 'ses',
      messageId: response.MessageId,
    };
  }
}
