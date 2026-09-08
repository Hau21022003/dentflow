import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import {
  Subscription,
  SubscriptionStatus,
} from 'src/modules/subscriptions/entities/subscription.entity';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { AppConfigService } from 'src/config/app-config.service';
import { PlatformRoleCode } from 'src/modules/authorization/entities/platform-role-assignment.entity';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-demo-password';

interface SubscriptionPlanResponse {
  id: string;
  isActive: boolean;
}

describe('Subscription plans (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auditLogsRepository: Repository<AuditLog>;
  let authFixtures: ReturnType<typeof createAuthFixtures>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    auditLogsRepository = dataSource.getRepository(AuditLog);
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

  it('requires platform plan permission and lists the empty global catalog', async () => {
    await request(app.getHttpServer()).get('/platform/plans').expect(401);

    const regularUser = await authFixtures.createUser({
      email: 'regular-user@example.test',
    });
    const regularAgent = await login(regularUser.email);
    await regularAgent.get('/platform/plans').expect(403);

    const { agent } = await createPlatformAdmin();
    await agent.get('/platform/plans').expect(200).expect([]);
  });

  it('creates plans, records a platform audit event, and returns inactive plans in the catalog', async () => {
    const { agent, user } = await createPlatformAdmin();
    const response = await postPlan(agent, {
      code: 'growth-monthly',
      name: '  Growth   Monthly ',
      description: '  Plan for growing clinics. ',
      billingInterval: 'MONTHLY',
      amount: 250000,
      currency: 'VND',
      providerPlanId: 'price_growth_monthly',
      trialDays: 14,
      entitlements: { maxBranches: 3, analytics: true },
    }).expect(201);

    expect(response.body).toMatchObject({
      code: 'growth-monthly',
      name: 'Growth Monthly',
      description: 'Plan for growing clinics.',
      billingInterval: 'MONTHLY',
      amount: 250000,
      currency: 'VND',
      providerPlanId: 'price_growth_monthly',
      trialDays: 14,
      entitlements: { maxBranches: 3, analytics: true },
      isActive: true,
    });
    const createdPlan = response.body as SubscriptionPlanResponse;

    const audit = await auditLogsRepository.findOneByOrFail({
      action: AuditAction.PLAN_CREATED,
      resourceId: createdPlan.id,
    });
    expect(audit.actorUserId).toBe(user.id);
    expect(audit.after).toEqual({
      changedFields: [
        'name',
        'description',
        'billingInterval',
        'amount',
        'currency',
        'providerPlanId',
        'trialDays',
        'entitlements',
        'isActive',
      ],
      isActive: true,
      amount: 250000,
      currency: 'VND',
    });

    await agent
      .patch(`/platform/plans/${createdPlan.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ isActive: false, reason: 'ARCHIVED_FOR_REVIEW' })
      .expect(200);

    const catalog = await agent.get('/platform/plans').expect(200);
    const catalogPlans = catalog.body as SubscriptionPlanResponse[];
    expect(catalogPlans).toHaveLength(1);
    expect(catalogPlans[0]).toMatchObject({
      id: createdPlan.id,
      isActive: false,
    });
  });

  it('validates plan inputs and maps unique catalog conflicts', async () => {
    const { agent } = await createPlatformAdmin();

    await postPlan(agent, { code: 'Growth-monthly' }).expect(422);
    await postPlan(agent, { code: 'growth-monthly', currency: 'vnd' }).expect(
      422,
    );
    await postPlan(agent, { code: 'negative-price', amount: -1 }).expect(422);
    await postPlan(agent, { code: 'zero-trial', trialDays: 0 }).expect(422);
    await postPlan(agent, {
      code: 'array-entitlements',
      entitlements: ['not', 'an', 'object'],
    }).expect(422);

    await postPlan(agent, {
      code: 'growth-monthly',
      providerPlanId: 'price_growth_monthly',
    }).expect(201);
    await postPlan(agent, { code: 'growth-monthly' }).expect(409);
    await postPlan(agent, {
      code: 'growth-yearly',
      providerPlanId: 'price_growth_monthly',
    }).expect(409);
  });

  it('updates an unused plan, replaces entitlements, and rejects code changes', async () => {
    const { agent } = await createPlatformAdmin();
    const plan = await createPlan(agent, {
      code: 'starter-monthly',
      description: 'Starter plan description',
    });

    const updated = await agent
      .patch(`/platform/plans/${plan.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'Starter Plus',
        description: null,
        amount: 99000,
        entitlements: { maxBranches: 2 },
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'Starter Plus',
      description: null,
      amount: 99000,
      entitlements: { maxBranches: 2 },
    });

    await agent
      .patch(`/platform/plans/${plan.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ code: 'renamed-plan' })
      .expect(422);

    const audit = await auditLogsRepository.findOneByOrFail({
      action: AuditAction.PLAN_UPDATED,
      resourceId: plan.id,
    });
    expect(audit.after).toEqual({
      changedFields: ['name', 'description', 'amount', 'entitlements'],
      isActive: true,
      amount: 99000,
      currency: 'VND',
    });
  });

  it('locks commercial updates after subscription history but permits audited availability changes', async () => {
    const { agent, user } = await createPlatformAdmin();
    const plan = await createPlan(agent, { code: 'professional-monthly' });
    const tenant = await authFixtures.createTenant({
      slug: 'subscription-history-clinic',
    });
    await dataSource.getRepository(Subscription).save(
      dataSource.getRepository(Subscription).create({
        tenantId: tenant.id,
        planId: plan.id,
        providerCustomerId: 'cus_synthetic',
        providerSubscriptionId: 'sub_synthetic',
        status: SubscriptionStatus.TRIAL,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        canceledAt: null,
      }),
    );

    await agent
      .patch(`/platform/plans/${plan.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: 199000 })
      .expect(409);
    await agent
      .patch(`/platform/plans/${plan.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ isActive: false })
      .expect(422);

    await agent
      .patch(`/platform/plans/${plan.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ isActive: false, reason: 'DISCONTINUED' })
      .expect(200)
      .expect((response) => {
        expect((response.body as SubscriptionPlanResponse).isActive).toBe(
          false,
        );
      });

    const deactivation = await auditLogsRepository.findOneByOrFail({
      action: AuditAction.PLAN_DEACTIVATED,
      resourceId: plan.id,
    });
    expect(deactivation.actorUserId).toBe(user.id);
    expect(deactivation.reason).toBe('DISCONTINUED');

    const auditCountBeforeRetry = await auditLogsRepository.count({
      where: { resourceId: plan.id },
    });
    await agent
      .patch(`/platform/plans/${plan.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ isActive: false })
      .expect(200);
    await expect(
      auditLogsRepository.count({ where: { resourceId: plan.id } }),
    ).resolves.toBe(auditCountBeforeRetry);

    await agent
      .patch(`/platform/plans/${plan.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ isActive: true, reason: 'RESTORED_AFTER_REVIEW' })
      .expect(200)
      .expect((response) => {
        expect((response.body as SubscriptionPlanResponse).isActive).toBe(true);
      });
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.PLAN_ACTIVATED,
        resourceId: plan.id,
      }),
    ).resolves.toMatchObject({ reason: 'RESTORED_AFTER_REVIEW' });
  });

  it('rolls back plan creation when the required audit insert fails', async () => {
    const { agent } = await createPlatformAdmin();
    await dataSource.query(`
      CREATE FUNCTION reject_plan_creation_audit()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.action = 'PLAN_CREATED' THEN
          RAISE EXCEPTION 'forced plan audit failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER trg_reject_plan_creation_audit
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION reject_plan_creation_audit()
    `);

    try {
      await postPlan(agent, { code: 'audit-failure-plan' }).expect(500);
      expect(
        await dataSource.query(
          "SELECT COUNT(*)::int AS count FROM subscription_plans WHERE code = 'audit-failure-plan'",
        ),
      ).toEqual([{ count: 0 }]);
    } finally {
      await dataSource.query(
        'DROP TRIGGER IF EXISTS trg_reject_plan_creation_audit ON audit_logs',
      );
      await dataSource.query(
        'DROP FUNCTION IF EXISTS reject_plan_creation_audit()',
      );
    }
  });

  it('enforces subscription foreign keys, provider uniqueness, and immutable plan history', async () => {
    const { agent } = await createPlatformAdmin();
    const originalPlan = await createPlan(agent, { code: 'history-monthly' });
    const replacementPlan = await createPlan(agent, {
      code: 'history-yearly',
      billingInterval: 'YEARLY',
    });
    const tenant = await authFixtures.createTenant({
      slug: 'subscription-constraint-clinic',
    });
    const subscriptionsRepository = dataSource.getRepository(Subscription);
    const subscription = await subscriptionsRepository.save(
      subscriptionsRepository.create({
        tenantId: tenant.id,
        planId: originalPlan.id,
        providerCustomerId: null,
        providerSubscriptionId: 'sub_unique',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        canceledAt: null,
      }),
    );

    subscription.planId = replacementPlan.id;
    await subscriptionsRepository.save(subscription);
    await expect(
      subscriptionsRepository.findOneByOrFail({ id: subscription.id }),
    ).resolves.toMatchObject({ planId: originalPlan.id });

    await expect(
      subscriptionsRepository.save(
        subscriptionsRepository.create({
          tenantId: tenant.id,
          planId: replacementPlan.id,
          providerCustomerId: null,
          providerSubscriptionId: 'sub_unique',
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          canceledAt: null,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      subscriptionsRepository.save(
        subscriptionsRepository.create({
          tenantId: tenant.id,
          planId: '00000000-0000-4000-8000-000000000111',
          providerCustomerId: null,
          providerSubscriptionId: 'sub_foreign_key_failure',
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          canceledAt: null,
        }),
      ),
    ).rejects.toThrow();
  });

  it('keeps database catalog constraints enforced', async () => {
    await insertPlan({ code: 'growth-monthly' });

    await expect(insertPlan({ code: 'growth-monthly' })).rejects.toThrow();
    await expect(insertPlan({ code: 'Growth-monthly' })).rejects.toThrow();
    await expect(
      insertPlan({ code: 'starter-monthly', currency: 'usd' }),
    ).rejects.toThrow();
    await expect(
      insertPlan({ code: 'negative-price', amount: -1 }),
    ).rejects.toThrow();
    await expect(
      insertPlan({ code: 'zero-trial', trialDays: 0 }),
    ).rejects.toThrow();
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

  function postPlan(agent: ReturnType<typeof request.agent>, overrides = {}) {
    return agent
      .post('/platform/plans')
      .set('Idempotency-Key', randomUUID())
      .send({
        code: 'starter-monthly',
        name: 'Starter',
        billingInterval: 'MONTHLY',
        amount: 49000,
        currency: 'VND',
        entitlements: { maxBranches: 1 },
        ...overrides,
      });
  }

  async function createPlan(
    agent: ReturnType<typeof request.agent>,
    overrides = {},
  ) {
    const response = await postPlan(agent, overrides).expect(201);
    return response.body as { id: string };
  }

  async function insertPlan({
    code,
    currency = 'USD',
    amount = 2500,
    trialDays = 14,
  }: {
    code: string;
    currency?: string;
    amount?: number;
    trialDays?: number | null;
  }): Promise<void> {
    await dataSource.query(
      `
        INSERT INTO subscription_plans (
          code,
          name,
          billing_interval,
          amount,
          currency,
          trial_days,
          entitlements
        ) VALUES ($1, $2, 'MONTHLY', $3, $4, $5, $6::jsonb)
      `,
      [
        code,
        'Growth',
        amount,
        currency,
        trialDays,
        JSON.stringify({ branches: 3 }),
      ],
    );
  }
});
