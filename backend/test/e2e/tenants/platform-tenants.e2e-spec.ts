import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import { PlatformRoleCode } from 'src/modules/authorization/entities/platform-role-assignment.entity';
import { SubscriptionPlan } from 'src/modules/subscription-plans/entities/subscription-plan.entity';
import {
  TenantOwnerInvitation,
  TenantOwnerInvitationStatus,
} from 'src/modules/tenants/entities/tenant-owner-invitation.entity';
import {
  Tenant,
  TenantStatus,
} from 'src/modules/tenants/entities/tenant.entity';
import { TenantInvitationTokenService } from 'src/modules/tenants/tenant-invitation-token.service';
import { Branch } from 'src/modules/branches/entities/branch.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-tenant-plan-password';

describe('Platform tenant management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;
  let invitationTokens: TenantInvitationTokenService;
  let tenantsRepository: Repository<Tenant>;
  let invitationsRepository: Repository<TenantOwnerInvitation>;
  let auditLogsRepository: Repository<AuditLog>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    const appConfig = app.get(AppConfigService);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds: appConfig.securityConfig.bcryptSaltRounds,
    });
    invitationTokens = app.get(TenantInvitationTokenService);
    tenantsRepository = dataSource.getRepository(Tenant);
    invitationsRepository = dataSource.getRepository(TenantOwnerInvitation);
    auditLogsRepository = dataSource.getRepository(AuditLog);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('provisions an isolated trial tenant, records audit, and replays create safely', async () => {
    const plan = await createTrialPlan('tenant-create-monthly');
    const { agent, user } = await createPlatformAdmin();
    const requestKey = randomUUID();
    const payload = tenantPayload(plan.id, {
      slug: 'synthetic-provisioned-clinic',
      ownerEmail: 'new-owner@tenant-management.test',
    });

    const created = await agent
      .post('/platform/tenants')
      .set('Idempotency-Key', requestKey)
      .send(payload)
      .expect(201);
    expect(created.body).toMatchObject({
      slug: payload.slug,
      status: 'TRIAL',
      subscription: {
        status: 'TRIAL',
        plan: { id: plan.id, code: plan.code },
      },
      owner: { state: 'PENDING', email: payload.ownerEmail },
      usage: { branchCount: 0, userCount: 0 },
    });
    expect(JSON.stringify(created.body)).not.toMatch(/tokenHash|token/i);

    const tenant = await tenantsRepository.findOneByOrFail({
      slug: payload.slug,
    });
    const invitation = await invitationsRepository.findOneByOrFail({
      tenantId: tenant.id,
      status: TenantOwnerInvitationStatus.PENDING,
    });
    expect(invitation.tokenHash).toBeUndefined();
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.TENANT_CREATED,
        resourceId: tenant.id,
      }),
    ).resolves.toMatchObject({ actorUserId: user.id, tenantId: tenant.id });

    await agent
      .post('/platform/tenants')
      .set('Idempotency-Key', requestKey)
      .send(payload)
      .expect(201)
      .expect('Idempotency-Replayed', 'true');
    await expect(
      tenantsRepository.count({ where: { slug: payload.slug } }),
    ).resolves.toBe(1);

    await agent
      .get(`/platform/tenants?planId=${plan.id}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: Record<string, unknown>[] };
        expect(body.items).toHaveLength(1);
        expect(body.items[0]).not.toHaveProperty('patient');
        expect(body.items[0]).not.toHaveProperty('payment');
      });

    await agent
      .patch(`/platform/tenants/${tenant.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ displayName: 'Synthetic Dental Updated' })
      .expect(200)
      .expect((response) => {
        const body = response.body as { displayName: string };
        expect(body.displayName).toBe('Synthetic Dental Updated');
      });
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.TENANT_UPDATED,
        resourceId: tenant.id,
      }),
    ).resolves.toBeDefined();

    const resent = await agent
      .post(`/platform/tenants/${tenant.id}/resend-owner-invite`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    const resentBody = resent.body as {
      owner: { invitation: { id: string } };
    };
    expect(resentBody.owner.invitation.id).not.toBe(invitation.id);
    await expect(
      invitationsRepository.findOneByOrFail({ id: invitation.id }),
    ).resolves.toMatchObject({ status: TenantOwnerInvitationStatus.REVOKED });

    await agent
      .post(`/platform/tenants/${tenant.id}/extend-trial`)
      .set('Idempotency-Key', randomUUID())
      .send({ days: 3, reason: 'SYNTHETIC_TRIAL_EXTENSION' })
      .expect(201)
      .expect((response) => {
        const body = response.body as { subscription: { status: string } };
        expect(body.subscription.status).toBe('TRIAL');
      });
  });

  it('returns a stable page contract with server-side search, filters and sort', async () => {
    const alphaPlan = await createTrialPlan(
      'tenant-catalog-alpha-monthly',
      'Alpha Catalog Plan',
    );
    const betaPlan = await createTrialPlan(
      'tenant-catalog-beta-monthly',
      'Beta Catalog Plan',
    );
    const { agent } = await createPlatformAdmin();
    const first = await createTenant(
      agent,
      tenantPayload(alphaPlan.id, {
        displayName: 'Shared Catalog Tenant',
        slug: 'catalog-tenant-first',
        ownerEmail: 'catalog-first@tenant-management.test',
      }),
    );
    const second = await createTenant(
      agent,
      tenantPayload(betaPlan.id, {
        displayName: 'Shared Catalog Tenant',
        slug: 'catalog-tenant-second',
        ownerEmail: 'catalog-second@tenant-management.test',
      }),
    );
    const third = await createTenant(
      agent,
      tenantPayload(betaPlan.id, {
        displayName: 'Zeta Catalog Tenant',
        slug: 'catalog-tenant-third',
        ownerEmail: 'catalog-third@tenant-management.test',
      }),
    );
    await tenantsRepository.update(first.id, {
      status: TenantStatus.ACTIVE,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await tenantsRepository.update(second.id, {
      status: TenantStatus.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await tenantsRepository.update(third.id, {
      status: TenantStatus.PAST_DUE,
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
    });
    await dataSource.getRepository(Branch).save([
      {
        tenantId: first.id,
        slug: 'catalog-first-branch',
        name: 'Catalog First Branch',
        address: 'Synthetic Address 1',
        phone: '1000000001',
        timezone: 'Asia/Ho_Chi_Minh',
        status: 'ACTIVE',
      },
      {
        tenantId: second.id,
        slug: 'catalog-second-branch-one',
        name: 'Catalog Second Branch One',
        address: 'Synthetic Address 2',
        phone: '1000000002',
        timezone: 'Asia/Ho_Chi_Minh',
        status: 'ACTIVE',
      },
      {
        tenantId: second.id,
        slug: 'catalog-second-branch-two',
        name: 'Catalog Second Branch Two',
        address: 'Synthetic Address 3',
        phone: '1000000003',
        timezone: 'Asia/Ho_Chi_Minh',
        status: 'ACTIVE',
      },
    ]);

    await agent
      .get('/platform/tenants?search=Catalog')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
        expect(body.meta).toEqual({
          page: 1,
          limit: 10,
          total: 3,
          totalPages: 1,
        });
      });

    const defaultPage = await agent
      .get('/platform/tenants?search=Catalog&page=1&limit=2')
      .expect(200);
    const defaultBody = defaultPage.body as {
      items: Array<{ id: string }>;
      meta: { page: number; limit: number; total: number; totalPages: number };
    };
    expect(defaultBody.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(defaultBody.items.map((tenant) => tenant.id)).toEqual([
      third.id,
      first.id,
    ]);

    const secondPage = await agent
      .get('/platform/tenants?search=Catalog&page=2&limit=2')
      .expect(200);
    expect(
      (secondPage.body as { items: Array<{ id: string }> }).items.map(
        (tenant) => tenant.id,
      ),
    ).toEqual([second.id]);

    const expectedSharedOrder = [first.id, second.id].sort();
    await expectTenantOrder(
      agent,
      '/platform/tenants?search=Catalog&sortBy=displayName&sortOrder=ASC',
      [...expectedSharedOrder, third.id],
    );
    await expectTenantOrder(
      agent,
      '/platform/tenants?search=Catalog&sortBy=planName&sortOrder=ASC',
      [first.id, ...[second.id, third.id].sort()],
    );
    await expectTenantOrder(
      agent,
      '/platform/tenants?search=Catalog&sortBy=branchCount&sortOrder=DESC',
      [second.id, first.id, third.id],
    );
    await expectTenantOrder(
      agent,
      '/platform/tenants?search=Catalog&sortBy=status&sortOrder=ASC',
      [...expectedSharedOrder, third.id],
    );
    await expectTenantOrder(
      agent,
      '/platform/tenants?search=Catalog&sortBy=createdAt&sortOrder=ASC',
      [second.id, first.id, third.id],
    );

    await agent
      .get('/platform/tenants?search=Beta%20Catalog%20Plan')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          items: Array<{ id: string }>;
          meta: { total: number };
        };
        expect(body.meta.total).toBe(2);
        expect(body.items.map((tenant) => tenant.id).sort()).toEqual(
          [second.id, third.id].sort(),
        );
      });
    await agent
      .get(`/platform/tenants?status=ACTIVE&planId=${betaPlan.id}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: Array<{ id: string }> };
        expect(body.items.map((tenant) => tenant.id)).toEqual([second.id]);
      });
    await agent.get('/platform/tenants?cursor=legacy').expect(422);
    await agent.get('/platform/tenants?sortBy=DROP_TABLE').expect(422);
    await agent.get('/platform/tenants?page=0').expect(422);
    await agent.get('/platform/tenants?limit=101').expect(422);
  });

  it('accepts an invitation into a new owner, then enforces Platform and subscription boundaries', async () => {
    const plan = await createTrialPlan('tenant-accept-monthly');
    const { agent: platformAgent } = await createPlatformAdmin();
    const payload = tenantPayload(plan.id, {
      slug: 'owner-accept-clinic',
      ownerEmail: 'owner-accept@tenant-management.test',
    });
    const tenantResponse = await createTenant(platformAgent, payload);
    const invitation = await invitationsRepository.findOneByOrFail({
      tenantId: tenantResponse.id,
      status: TenantOwnerInvitationStatus.PENDING,
    });
    const token = invitationTokens.createToken(invitation);

    const accepted = await request(app.getHttpServer())
      .post('/auth/tenant-owner-invitations/accept')
      .send({ token, fullName: payload.ownerFullName, password: PASSWORD })
      .expect(200);
    const acceptedBody = accepted.body as {
      tenantId: string;
      ownerUserId: string;
    };
    expect(acceptedBody).toMatchObject({ tenantId: tenantResponse.id });
    await request(app.getHttpServer())
      .post('/auth/tenant-owner-invitations/accept')
      .send({ token })
      .expect(200)
      .expect((response) => {
        const body = response.body as { ownerUserId: string };
        expect(body.ownerUserId).toBe(acceptedBody.ownerUserId);
      });

    const ownerAgent = await login(payload.ownerEmail);
    await ownerAgent.get('/platform/tenants').expect(403);
    await ownerAgent
      .get(`/testing/authorization/tenants/${payload.slug}`)
      .expect(200);

    await platformAgent
      .post(`/platform/tenants/${tenantResponse.id}/suspend`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_POLICY_REVIEW' })
      .expect(201)
      .expect((response) => {
        const body = response.body as { status: string };
        expect(body.status).toBe('SUSPENDED');
      });
    await ownerAgent
      .get(`/testing/authorization/tenants/${payload.slug}`)
      .expect(403);

    await platformAgent
      .post(`/platform/tenants/${tenantResponse.id}/reactivate`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_REVIEW_COMPLETE' })
      .expect(201)
      .expect((response) => {
        const body = response.body as { status: string };
        expect(body.status).toBe('TRIAL');
      });
    await ownerAgent
      .get(`/testing/authorization/tenants/${payload.slug}`)
      .expect(200);
  });

  it('requires an existing owner account to accept while signed in with the invited email', async () => {
    const plan = await createTrialPlan('tenant-existing-owner-monthly');
    const existingOwner = await authFixtures.createUser({
      email: 'existing-owner@tenant-management.test',
    });
    const { agent: platformAgent } = await createPlatformAdmin();
    const payload = tenantPayload(plan.id, {
      slug: 'existing-owner-clinic',
      ownerEmail: existingOwner.email,
    });
    const tenantResponse = await createTenant(platformAgent, payload);
    const invitation = await invitationsRepository.findOneByOrFail({
      tenantId: tenantResponse.id,
      status: TenantOwnerInvitationStatus.PENDING,
    });
    const token = invitationTokens.createToken(invitation);

    await request(app.getHttpServer())
      .post('/auth/tenant-owner-invitations/accept')
      .send({ token, fullName: 'Ignored Name', password: PASSWORD })
      .expect(409);

    const ownerAgent = await login(existingOwner.email);
    await ownerAgent
      .post('/auth/tenant-owner-invitations/accept')
      .send({ token })
      .expect(200)
      .expect((response) => {
        const body = response.body as { ownerUserId: string };
        expect(body.ownerUserId).toBe(existingOwner.id);
      });
  });

  it('rolls back provisioning when the required tenant audit insert fails', async () => {
    const plan = await createTrialPlan('tenant-audit-rollback-monthly');
    const { agent } = await createPlatformAdmin();
    const payload = tenantPayload(plan.id, {
      slug: 'audit-rollback-clinic',
      ownerEmail: 'audit-rollback@tenant-management.test',
    });
    await dataSource.query(`
      CREATE FUNCTION reject_tenant_created_audit()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.action = 'TENANT_CREATED' THEN
          RAISE EXCEPTION 'forced tenant audit failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER trg_reject_tenant_created_audit
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION reject_tenant_created_audit()
    `);

    try {
      await agent
        .post('/platform/tenants')
        .set('Idempotency-Key', randomUUID())
        .send(payload)
        .expect(500);
      await expect(
        tenantsRepository.count({ where: { slug: payload.slug } }),
      ).resolves.toBe(0);
    } finally {
      await dataSource.query(
        'DROP TRIGGER IF EXISTS trg_reject_tenant_created_audit ON audit_logs',
      );
      await dataSource.query(
        'DROP FUNCTION IF EXISTS reject_tenant_created_audit()',
      );
    }
  });

  async function createTrialPlan(
    code: string,
    name = `Synthetic ${code}`,
  ): Promise<SubscriptionPlan> {
    return dataSource.getRepository(SubscriptionPlan).save(
      dataSource.getRepository(SubscriptionPlan).create({
        code,
        name,
        description: null,
        billingInterval: 'MONTHLY',
        amount: 49000,
        currency: 'VND',
        providerPlanId: null,
        trialDays: 14,
        entitlements: {},
        isActive: true,
      }),
    );
  }

  async function createPlatformAdmin() {
    const user = await authFixtures.createUser({
      email: `platform-${randomUUID()}@tenant-management.test`,
    });
    await authFixtures.grantPlatformRole(user, PlatformRoleCode.PLATFORM_ADMIN);
    return { user, agent: await login(user.email) };
  }

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return agent;
  }

  function tenantPayload(planId: string, overrides = {}) {
    return {
      legalName: 'Synthetic Dental LLC',
      displayName: 'Synthetic Dental',
      slug: 'synthetic-dental',
      billingEmail: 'billing@tenant-management.test',
      ownerEmail: 'owner@tenant-management.test',
      ownerFullName: 'Synthetic Owner',
      planId,
      defaultLocale: 'vi',
      defaultTimezone: 'Asia/Ho_Chi_Minh',
      ...overrides,
    };
  }

  async function createTenant(
    agent: ReturnType<typeof request.agent>,
    payload: Record<string, unknown>,
  ) {
    const response = await agent
      .post('/platform/tenants')
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);
    return response.body as { id: string };
  }

  async function expectTenantOrder(
    agent: ReturnType<typeof request.agent>,
    url: string,
    expectedIds: string[],
  ) {
    const response = await agent.get(url).expect(200);
    expect(
      (response.body as { items: Array<{ id: string }> }).items.map(
        (tenant) => tenant.id,
      ),
    ).toEqual(expectedIds);
  }
});
