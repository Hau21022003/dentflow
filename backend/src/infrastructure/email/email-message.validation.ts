import { SendEmailCommand } from './email.types';

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InvalidEmailMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmailMessageError';
  }
}

/**
 * Validates the provider-independent contract before any external call.
 * This also prevents header injection through recipient and subject fields.
 */
export function normalizeEmailCommand(
  command: SendEmailCommand,
): SendEmailCommand {
  if (command.to.length === 0) {
    throw new InvalidEmailMessageError(
      'Email must have at least one recipient.',
    );
  }

  const to = command.to.map((recipient: string) => {
    const normalized = recipient.trim();

    if (
      !normalized ||
      /[\r\n]/.test(normalized) ||
      !SIMPLE_EMAIL_PATTERN.test(normalized)
    ) {
      throw new InvalidEmailMessageError('Email recipient is invalid.');
    }

    return normalized;
  });

  const subject = command.subject.trim();
  if (!subject || /[\r\n]/.test(subject)) {
    throw new InvalidEmailMessageError('Email subject is invalid.');
  }

  const hasText = Boolean(command.text?.trim());
  const hasHtml = Boolean(command.html?.trim());
  if (!hasText && !hasHtml) {
    throw new InvalidEmailMessageError(
      'Email must contain text or HTML content.',
    );
  }

  return {
    to,
    subject,
    ...(command.text !== undefined && { text: command.text }),
    ...(command.html !== undefined && { html: command.html }),
  };
}
