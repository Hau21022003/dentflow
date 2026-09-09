import { BadRequestException } from '@nestjs/common';

export enum EmailTemplateKey {
  TENANT_OWNER_INVITATION = 'tenant-owner-invitation',
}

export enum EmailTemplateLocale {
  VI = 'vi',
  EN = 'en',
}

export type EmailTemplateVariable =
  'tenantDisplayName' | 'invitationUrl' | 'expiresAt';

export interface EmailTemplateContract {
  readonly allowedVariables: readonly EmailTemplateVariable[];
  readonly requiredVariables: Readonly<
    Record<'text' | 'html', readonly EmailTemplateVariable[]>
  >;
}

export const EMAIL_TEMPLATE_CONTRACTS: Readonly<
  Record<EmailTemplateKey, EmailTemplateContract>
> = {
  [EmailTemplateKey.TENANT_OWNER_INVITATION]: {
    allowedVariables: ['tenantDisplayName', 'invitationUrl', 'expiresAt'],
    requiredVariables: {
      text: ['invitationUrl', 'expiresAt'],
      html: ['invitationUrl', 'expiresAt'],
    },
  },
};

export function normalizeEmailTemplateLocale(
  locale: string | null | undefined,
): EmailTemplateLocale {
  return locale?.toLowerCase() === EmailTemplateLocale.EN
    ? EmailTemplateLocale.EN
    : EmailTemplateLocale.VI;
}

export function assertEmailTemplateKey(value: string): EmailTemplateKey {
  if (!Object.values(EmailTemplateKey).includes(value as EmailTemplateKey)) {
    throw new BadRequestException('Unsupported email template key.');
  }

  return value as EmailTemplateKey;
}

export function assertEmailTemplateLocale(value: string): EmailTemplateLocale {
  if (
    !Object.values(EmailTemplateLocale).includes(value as EmailTemplateLocale)
  ) {
    throw new BadRequestException('Unsupported email template locale.');
  }

  return value as EmailTemplateLocale;
}
