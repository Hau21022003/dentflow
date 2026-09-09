import { Repository } from 'typeorm';
import {
  EmailTemplateKey,
  EmailTemplateLocale,
  normalizeEmailTemplateLocale,
} from './email-template-registry';
import {
  EmailTemplateRenderError,
  EmailTemplateRenderer,
} from './email-template-renderer.service';
import {
  EmailTemplateRevision,
  EmailTemplateRevisionStatus,
} from './entities/email-template-revision.entity';

describe('EmailTemplateRenderer', () => {
  const revision = createRevision();
  const repository = {
    findOneBy: jest.fn(),
  } as unknown as Repository<EmailTemplateRevision>;
  const renderer = new EmailTemplateRenderer(repository);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('interpolates text, escapes variables in HTML, and sanitizes output', async () => {
    jest.spyOn(repository, 'findOneBy').mockResolvedValue({
      ...revision,
      html: '<script>window.bad = true</script><p><a href="{{invitationUrl}}">{{tenantDisplayName}}</a></p><p>{{expiresAt}}</p>',
    });

    await expect(
      renderer.renderPublished(revision.templateKey, revision.locale, {
        tenantDisplayName: 'North <Dental> & Co.',
        invitationUrl: 'https://frontend.example.test/accept?token=abc&x=1',
        expiresAt: '10 Sep 2026, 10:00',
      }),
    ).resolves.toEqual({
      subject: 'Activate North <Dental> & Co.',
      text: 'Use https://frontend.example.test/accept?token=abc&x=1 before 10 Sep 2026, 10:00.',
      html: '<p><a href="https://frontend.example.test/accept?token=abc&amp;x=1">North &lt;Dental&gt; &amp; Co.</a></p><p>10 Sep 2026, 10:00</p>',
    });
    expect(repository.findOneBy).toHaveBeenCalledWith({
      templateKey: EmailTemplateKey.TENANT_OWNER_INVITATION,
      locale: EmailTemplateLocale.EN,
      status: EmailTemplateRevisionStatus.PUBLISHED,
    });
  });

  it('rejects unsupported and missing variables before a draft can be saved', () => {
    expect(() =>
      renderer.validateContent({
        ...revision,
        html: '<p>{{invitationUrl}} {{expiresAt}} {{patientName}}</p>',
      }),
    ).toThrow(EmailTemplateRenderError);

    expect(() =>
      renderer.validateContent({
        ...revision,
        text: 'Use {{invitationUrl}}.',
      }),
    ).toThrow('expiresAt');

    expect(() =>
      renderer.validateContent({
        ...revision,
        subject: '{{{tenantDisplayName}}}',
      }),
    ).toThrow('unsupported template syntax');

    expect(() =>
      renderer.validateContent({
        ...revision,
        html: '<script>{{invitationUrl}} {{expiresAt}}</script>',
      }),
    ).toThrow('does not contain allowed content');
  });

  it('uses vi as the locale fallback', () => {
    expect(normalizeEmailTemplateLocale('en')).toBe(EmailTemplateLocale.EN);
    expect(normalizeEmailTemplateLocale('EN')).toBe(EmailTemplateLocale.EN);
    expect(normalizeEmailTemplateLocale('fr')).toBe(EmailTemplateLocale.VI);
    expect(normalizeEmailTemplateLocale(undefined)).toBe(
      EmailTemplateLocale.VI,
    );
  });
});

function createRevision(): EmailTemplateRevision {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    templateKey: EmailTemplateKey.TENANT_OWNER_INVITATION,
    locale: EmailTemplateLocale.EN,
    version: 1,
    status: EmailTemplateRevisionStatus.PUBLISHED,
    subject: 'Activate {{tenantDisplayName}}',
    text: 'Use {{invitationUrl}} before {{expiresAt}}.',
    html: '<p><a href="{{invitationUrl}}">Activate</a></p><p>{{expiresAt}}</p>',
    createdByUserId: null,
    publishedByUserId: null,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdByUser: null,
    publishedByUser: null,
  };
}
