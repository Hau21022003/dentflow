import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import { PlatformRoleCode } from 'src/modules/authorization/entities/platform-role-assignment.entity';
import { EmailTemplateRevision } from 'src/modules/email-templates/entities/email-template-revision.entity';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-email-template-password';
const TEMPLATE_PATH = '/platform/email-templates/tenant-owner-invitation/en';

describe('Platform email templates (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auditLogsRepository: Repository<AuditLog>;
  let revisionsRepository: Repository<EmailTemplateRevision>;
  let authFixtures: ReturnType<typeof createAuthFixtures>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    auditLogsRepository = dataSource.getRepository(AuditLog);
    revisionsRepository = dataSource.getRepository(EmailTemplateRevision);
    const appConfig = app.get(AppConfigService);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds: appConfig.securityConfig.bcryptSaltRounds,
    });
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('only permits Platform Admin to read the global template catalog', async () => {
    await request(app.getHttpServer())
      .get('/platform/email-templates')
      .expect(401);

    const regularUser = await authFixtures.createUser({
      email: 'email-template-user@example.test',
    });
    const regularAgent = await login(regularUser.email);
    await regularAgent.get('/platform/email-templates').expect(403);

    const { agent } = await createPlatformAdmin();
    await agent
      .get('/platform/email-templates')
      .expect(200)
      .expect((response) => {
        const catalog = response.body as unknown as Array<{
          templateKey: string;
          locale: string;
          draft: unknown;
          published: { version: number } | null;
        }>;
        expect(
          catalog.find(
            (item) =>
              item.templateKey === 'tenant-owner-invitation' &&
              item.locale === 'vi',
          ),
        ).toMatchObject({ draft: null, published: { version: 1 } });
        expect(
          catalog.find(
            (item) =>
              item.templateKey === 'tenant-owner-invitation' &&
              item.locale === 'en',
          ),
        ).toMatchObject({ draft: null, published: { version: 1 } });
      });
  });

  it('saves an audited draft, publishes a new immutable revision, and preserves history', async () => {
    const { agent, user } = await createPlatformAdmin();
    const draftResponse = await saveDraft(agent, {
      subject: 'Welcome to {{tenantDisplayName}}',
      text: 'Open {{invitationUrl}} before {{expiresAt}}.',
      html: '<p><a href="{{invitationUrl}}">Welcome to {{tenantDisplayName}}</a></p><p>{{expiresAt}}</p>',
    }).expect(200);
    const draft = draftResponse.body as { id: string; version: number };
    expect(draft.version).toBe(2);

    const draftAudit = await auditLogsRepository.findOneByOrFail({
      action: AuditAction.EMAIL_TEMPLATE_DRAFT_SAVED,
      resourceId: draft.id,
    });
    expect(draftAudit.actorUserId).toBe(user.id);
    expect(draftAudit.after).toEqual({
      templateKey: 'tenant-owner-invitation',
      locale: 'en',
      version: 2,
      status: 'DRAFT',
      changedFields: ['subject', 'text', 'html'],
    });
    expect(JSON.stringify(draftAudit)).not.toContain('Welcome to');

    const publishedResponse = await agent
      .post(`${TEMPLATE_PATH}/draft/publish`)
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    expect(publishedResponse.body).toMatchObject({
      id: draft.id,
      version: 2,
      status: 'PUBLISHED',
    });

    const detail = await agent.get(TEMPLATE_PATH).expect(200);
    const detailBody = detail.body as {
      published: unknown;
      draft: unknown;
      revisions: unknown;
    };
    expect(detailBody).toMatchObject({
      published: {
        id: draft.id,
        version: 2,
        status: 'PUBLISHED',
        subject: 'Welcome to {{tenantDisplayName}}',
      },
      draft: null,
    });
    expect(detailBody.revisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ version: 2, status: 'PUBLISHED' }),
        expect.objectContaining({ version: 1, status: 'ARCHIVED' }),
      ]),
    );

    await expect(
      revisionsRepository.findOneByOrFail({
        id: '00000000-0000-4000-8000-000000000132',
      }),
    ).resolves.toMatchObject({ status: 'ARCHIVED' });
  });

  it('directly publishes form content as a new revision without changing history', async () => {
    const { agent, user } = await createPlatformAdmin();
    const key = randomUUID();
    const body = {
      subject: 'Re-activate {{tenantDisplayName}}',
      text: 'Use {{invitationUrl}} before {{expiresAt}}.',
      html: '<p><a href="{{invitationUrl}}">Re-activate {{tenantDisplayName}}</a></p><p>{{expiresAt}}</p>',
    };

    const publishedResponse = await agent
      .post(`${TEMPLATE_PATH}/publish`)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    const published = publishedResponse.body as { id: string };
    expect(publishedResponse.body).toMatchObject({
      version: 2,
      status: 'PUBLISHED',
      subject: body.subject,
      createdByUserId: user.id,
      publishedByUserId: user.id,
    });

    await agent
      .post(`${TEMPLATE_PATH}/publish`)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201)
      .expect('Idempotency-Replayed', 'true');

    const detail = await agent.get(TEMPLATE_PATH).expect(200);
    const detailBody = detail.body as {
      draft: unknown;
      published: { version: number; status: string } | null;
      revisions: unknown;
    };
    expect(detailBody.draft).toBeNull();
    expect(detailBody.published).toMatchObject({
      version: 2,
      status: 'PUBLISHED',
    });
    expect(detailBody.revisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ version: 2, status: 'PUBLISHED' }),
        expect.objectContaining({ version: 1, status: 'ARCHIVED' }),
      ]),
    );

    const audit = await auditLogsRepository.findOneByOrFail({
      action: AuditAction.EMAIL_TEMPLATE_PUBLISHED,
      resourceId: published.id,
    });
    expect(audit.actorUserId).toBe(user.id);
    expect(audit.before).toBeNull();
    expect(audit.after).toEqual({
      templateKey: 'tenant-owner-invitation',
      locale: 'en',
      version: 2,
      status: 'PUBLISHED',
      changedFields: ['subject', 'text', 'html'],
    });
    expect(JSON.stringify(audit)).not.toContain('Re-activate');
  });

  it('does not discard an existing draft when direct publish is requested', async () => {
    const { agent } = await createPlatformAdmin();
    await saveDraft(agent).expect(200);

    await agent
      .post(`${TEMPLATE_PATH}/publish`)
      .set('Idempotency-Key', randomUUID())
      .send({
        subject: 'Direct {{tenantDisplayName}}',
        text: 'Use {{invitationUrl}} before {{expiresAt}}.',
        html: '<p>{{invitationUrl}}</p><p>{{expiresAt}}</p>',
      })
      .expect(409);

    const detail = await agent.get(TEMPLATE_PATH).expect(200);
    expect(detail.body).toMatchObject({
      draft: { version: 2, status: 'DRAFT' },
      published: { version: 1, status: 'PUBLISHED' },
    });
  });

  it('enforces template variable constraints and command idempotency', async () => {
    const { agent } = await createPlatformAdmin();
    await saveDraft(agent, {
      text: 'Open {{invitationUrl}}.',
    }).expect(422);
    await saveDraft(agent, {
      html: '<p>{{invitationUrl}} {{expiresAt}} {{patientName}}</p>',
    }).expect(422);

    const key = randomUUID();
    const body = {
      subject: 'Activate {{tenantDisplayName}}',
      text: 'Open {{invitationUrl}} before {{expiresAt}}.',
      html: '<p><a href="{{invitationUrl}}">Activate</a></p><p>{{expiresAt}}</p>',
    };
    await agent
      .put(`${TEMPLATE_PATH}/draft`)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(200);
    await agent
      .put(`${TEMPLATE_PATH}/draft`)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(200)
      .expect('Idempotency-Replayed', 'true');
    await agent
      .put(`${TEMPLATE_PATH}/draft`)
      .set('Idempotency-Key', key)
      .send({ ...body, subject: 'Different {{tenantDisplayName}}' })
      .expect(409);
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return agent;
  }

  async function createPlatformAdmin() {
    const user = await authFixtures.createUser();
    await authFixtures.grantPlatformRole(user, PlatformRoleCode.PLATFORM_ADMIN);
    return { user, agent: await login(user.email) };
  }

  function saveDraft(
    agent: ReturnType<typeof request.agent>,
    overrides: Partial<{ subject: string; text: string; html: string }> = {},
  ) {
    return agent
      .put(`${TEMPLATE_PATH}/draft`)
      .set('Idempotency-Key', randomUUID())
      .send({
        subject: 'Activate {{tenantDisplayName}}',
        text: 'Open {{invitationUrl}} before {{expiresAt}}.',
        html: '<p><a href="{{invitationUrl}}">Activate</a></p><p>{{expiresAt}}</p>',
        ...overrides,
      });
  }
});
