import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import sanitizeHtml from 'sanitize-html';
import { Repository } from 'typeorm';
import {
  EMAIL_TEMPLATE_CONTRACTS,
  EmailTemplateKey,
  type EmailTemplateVariable,
  normalizeEmailTemplateLocale,
} from './email-template-registry';
import {
  EmailTemplateRevision,
  EmailTemplateRevisionStatus,
} from './entities/email-template-revision.entity';

export interface RenderedEmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export class EmailTemplateRenderError extends Error {
  constructor(
    readonly code:
      | 'PUBLISHED_TEMPLATE_NOT_FOUND'
      | 'INVALID_TEMPLATE'
      | 'INVALID_TEMPLATE_VARIABLES',
    message: string,
  ) {
    super(message);
    this.name = EmailTemplateRenderError.name;
  }
}

type EmailTemplateContent = Pick<
  EmailTemplateRevision,
  'templateKey' | 'subject' | 'text' | 'html'
>;

const PLACEHOLDER_PATTERN = /{{([A-Za-z][A-Za-z0-9]*)}}/g;
const UNSUPPORTED_TEMPLATE_SYNTAX = /{{{|}}}|{{\s*[#/>!^]/;
const EMAIL_HTML_SANITIZER_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'a',
    'b',
    'br',
    'em',
    'h1',
    'h2',
    'h3',
    'i',
    'li',
    'ol',
    'p',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'completelyDiscard',
};

@Injectable()
export class EmailTemplateRenderer {
  constructor(
    @InjectRepository(EmailTemplateRevision)
    private readonly revisions: Repository<EmailTemplateRevision>,
  ) {}

  async renderPublished(
    templateKey: EmailTemplateKey,
    requestedLocale: string | null | undefined,
    variables: Readonly<Record<string, string>>,
  ): Promise<RenderedEmailTemplate> {
    const locale = normalizeEmailTemplateLocale(requestedLocale);
    const revision = await this.revisions.findOneBy({
      templateKey,
      locale,
      status: EmailTemplateRevisionStatus.PUBLISHED,
    });
    if (!revision) {
      throw new EmailTemplateRenderError(
        'PUBLISHED_TEMPLATE_NOT_FOUND',
        'Published email template was not found.',
      );
    }

    return this.renderContent(revision, variables);
  }

  validateContent(content: EmailTemplateContent): void {
    const contract = EMAIL_TEMPLATE_CONTRACTS[content.templateKey];
    if (!contract) {
      throw new EmailTemplateRenderError(
        'INVALID_TEMPLATE',
        'Email template key is not registered.',
      );
    }

    const fields: Readonly<Record<'subject' | 'text' | 'html', string>> = {
      subject: content.subject,
      text: content.text,
      html: content.html,
    };
    const placeholders = new Map<
      keyof typeof fields,
      Set<EmailTemplateVariable>
    >();

    (Object.entries(fields) as Array<[keyof typeof fields, string]>).forEach(
      ([field, value]) => {
        if (UNSUPPORTED_TEMPLATE_SYNTAX.test(value)) {
          throw new EmailTemplateRenderError(
            'INVALID_TEMPLATE',
            `${field} contains unsupported template syntax.`,
          );
        }

        const names = new Set<EmailTemplateVariable>();
        const matches = value.matchAll(PLACEHOLDER_PATTERN);
        for (const match of matches) {
          const name = match[1] as EmailTemplateVariable;
          if (!contract.allowedVariables.includes(name)) {
            throw new EmailTemplateRenderError(
              'INVALID_TEMPLATE_VARIABLES',
              `${field} uses an unsupported email template variable.`,
            );
          }
          names.add(name);
        }

        if (/{{|}}/.test(value.replace(PLACEHOLDER_PATTERN, ''))) {
          throw new EmailTemplateRenderError(
            'INVALID_TEMPLATE',
            `${field} contains an invalid template placeholder.`,
          );
        }
        placeholders.set(field, names);
      },
    );

    (['text', 'html'] as const).forEach((field) => {
      contract.requiredVariables[field].forEach((name) => {
        if (!placeholders.get(field)?.has(name)) {
          throw new EmailTemplateRenderError(
            'INVALID_TEMPLATE_VARIABLES',
            `${field} must include the ${name} variable.`,
          );
        }
      });
    });

    const validationVariables = Object.fromEntries(
      contract.allowedVariables.map((name) => [
        name,
        name === 'invitationUrl' ? 'https://template.invalid/invitation' : name,
      ]),
    ) as Record<string, string>;
    const sanitizedHtml = sanitizeHtml(
      this.interpolate(content.html, validationVariables, (value) =>
        this.escapeHtml(value),
      ),
      EMAIL_HTML_SANITIZER_OPTIONS,
    );
    if (!sanitizedHtml.trim()) {
      throw new EmailTemplateRenderError(
        'INVALID_TEMPLATE',
        'Email HTML does not contain allowed content.',
      );
    }

    if (/\r|\n/.test(content.subject)) {
      throw new EmailTemplateRenderError(
        'INVALID_TEMPLATE',
        'Email subject cannot contain line breaks.',
      );
    }
  }

  private renderContent(
    content: EmailTemplateContent,
    variables: Readonly<Record<string, string>>,
  ): RenderedEmailTemplate {
    this.validateContent(content);
    const contract = EMAIL_TEMPLATE_CONTRACTS[content.templateKey];
    const suppliedNames = Object.keys(variables);
    if (
      suppliedNames.some(
        (name) =>
          !contract.allowedVariables.includes(name as EmailTemplateVariable),
      )
    ) {
      throw new EmailTemplateRenderError(
        'INVALID_TEMPLATE_VARIABLES',
        'Email template received an unsupported variable.',
      );
    }

    const text = this.interpolate(content.text, variables, (value) => value);
    const html = sanitizeHtml(
      this.interpolate(content.html, variables, (value) =>
        this.escapeHtml(value),
      ),
      EMAIL_HTML_SANITIZER_OPTIONS,
    );
    const subject = this.interpolate(
      content.subject,
      variables,
      (value) => value,
    );
    if (/\r|\n/.test(subject)) {
      throw new EmailTemplateRenderError(
        'INVALID_TEMPLATE_VARIABLES',
        'Email subject rendered an invalid line break.',
      );
    }

    return { subject, text, html };
  }

  private interpolate(
    source: string,
    variables: Readonly<Record<string, string>>,
    escape: (value: string) => string,
  ): string {
    return source.replace(PLACEHOLDER_PATTERN, (_match, name: string) => {
      const value = variables[name];
      if (value === undefined) {
        throw new EmailTemplateRenderError(
          'INVALID_TEMPLATE_VARIABLES',
          `Email template variable ${name} is missing.`,
        );
      }

      return escape(value);
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>'"]/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        })[character] ?? character,
    );
  }
}
