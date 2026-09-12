import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import { TenantRoleCode } from 'src/modules/authorization/entities/role-assignment.entity';
import { Service } from 'src/modules/services/entities/service.entity';
import {
  Tenant,
  TenantStatus,
} from 'src/modules/tenants/entities/tenant.entity';
import { User } from 'src/modules/users/entities/user.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-tenant-service-password';

describe('Tenant Admin service catalog management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;
  let servicesRepository: Repository<Service>;
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
    servicesRepository = dataSource.getRepository(Service);
    auditLogsRepository = dataSource.getRepository(AuditLog);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('creates, lists, reads, and updates only the current tenant catalog', async () => {
    const { tenant, agent, user } =
      await createTenantAdmin('service-catalog-a');
    const route = `/tenants/${tenant.slug}/services`;
    const alpha = await createService(agent, route, {
      code: 'exam-general',
      name: '  General   Examination ',
      groupName: '  Examination ',
      amount: 150000,
      currency: 'VND',
      durationMinutes: 30,
    });
    const bravo = await createService(agent, route, {
      code: 'cleaning-basic',
      name: 'Basic Cleaning',
      groupName: 'Hygiene',
      amount: 4500,
      currency: 'USD',
      durationMinutes: 45,
    });
    const zulu = await createService(agent, route, {
      code: 'xray-panoramic',
      name: 'Panoramic X-Ray',
      groupName: 'Imaging',
      amount: 200000,
      currency: 'VND',
      durationMinutes: 15,
    });
    await servicesRepository.update(alpha.id, {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await servicesRepository.update(bravo.id, {
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await servicesRepository.update(zulu.id, {
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
    });

    expect(alpha).toMatchObject({
      code: 'exam-general',
      name: 'General Examination',
      groupName: 'Examination',
      amount: 150000,
      currency: 'VND',
      durationMinutes: 30,
      isActive: true,
    });
    expect(alpha).not.toHaveProperty('tenantId');

    await agent
      .get(`${route}?search=ing&page=1&limit=2`)
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          items: Array<{ id: string }>;
          meta: Record<string, number>;
        };
        expect(body.items.map((service) => service.id)).toEqual([
          bravo.id,
          zulu.id,
        ]);
        expect(body.meta).toEqual({
          page: 1,
          limit: 2,
          total: 2,
          totalPages: 1,
        });
      });
    await agent
      .get(`${route}?sortBy=createdAt&sortOrder=DESC`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: Array<{ id: string }> };
        expect(body.items.map((service) => service.id)).toEqual([
          zulu.id,
          bravo.id,
          alpha.id,
        ]);
      });
    await agent.get(`${route}?sortBy=DROP_TABLE`).expect(422);
    await agent
      .get(`${route}/${alpha.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: alpha.id,
          code: alpha.code,
          name: alpha.name,
          groupName: alpha.groupName,
          amount: alpha.amount,
          currency: alpha.currency,
          durationMinutes: alpha.durationMinutes,
          isActive: alpha.isActive,
        });
      });

    const updateKey = randomUUID();
    await agent
      .patch(`${route}/${alpha.id}`)
      .set('Idempotency-Key', updateKey)
      .send({
        groupName: 'Preventive Care',
        amount: 175000,
        currency: 'VND',
        durationMinutes: 35,
        reason: 'ANNUAL_CATALOG_REVIEW',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: alpha.id,
          groupName: 'Preventive Care',
          amount: 175000,
          durationMinutes: 35,
        });
      });
    await agent
      .patch(`${route}/${alpha.id}`)
      .set('Idempotency-Key', updateKey)
      .send({
        groupName: 'Preventive Care',
        amount: 175000,
        currency: 'VND',
        durationMinutes: 35,
        reason: 'ANNUAL_CATALOG_REVIEW',
      })
      .expect(200)
      .expect('Idempotency-Replayed', 'true');
    await agent
      .patch(`${route}/${alpha.id}`)
      .set('Idempotency-Key', updateKey)
      .send({ name: 'Different intent' })
      .expect(409);
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.SERVICE_UPDATED,
        resourceId: alpha.id,
      }),
    ).resolves.toMatchObject({
      actorUserId: user.id,
      tenantId: tenant.id,
      reason: 'ANNUAL_CATALOG_REVIEW',
      before: {
        changedFields: ['groupName', 'amount', 'durationMinutes'],
        isActive: true,
        amount: 150000,
        currency: 'VND',
        durationMinutes: 30,
      },
      after: {
        changedFields: ['groupName', 'amount', 'durationMinutes'],
        isActive: true,
        amount: 175000,
        currency: 'VND',
        durationMinutes: 35,
      },
    });

    await agent
      .patch(`${route}/${alpha.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: 180000 })
      .expect(422);
    await agent
      .patch(`${route}/${alpha.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ code: 'renamed-service' })
      .expect(422);
    await agent
      .patch(`${route}/${alpha.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ isActive: false })
      .expect(422);
  });

  it('validates catalog data, database constraints, and tenant-local code uniqueness', async () => {
    const { tenant, agent } = await createTenantAdmin('service-validation-a');
    const otherTenant = await authFixtures.createTenant({
      slug: 'service-validation-b',
    });
    const { agent: otherAgent } = await createTenantAdminFor(otherTenant);
    const route = `/tenants/${tenant.slug}/services`;
    const payload = {
      code: 'consultation-new',
      name: 'New Consultation',
      groupName: 'Consultation',
      amount: 0,
      currency: 'VND',
      durationMinutes: 20,
    };

    await createService(agent, route, payload);
    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(409);
    await createService(
      otherAgent,
      `/tenants/${otherTenant.slug}/services`,
      payload,
    );
    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, code: 'Invalid Code' })
      .expect(422);
    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, code: 'invalid-currency', currency: 'vnd' })
      .expect(422);
    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, code: 'invalid-amount', amount: -1 })
      .expect(422);
    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, code: 'invalid-duration', durationMinutes: 0 })
      .expect(422);

    await expect(
      dataSource.query(
        `INSERT INTO "services" ("tenant_id", "code", "name", "group_name", "amount", "currency", "duration_minutes")
         VALUES ($1, 'Invalid Code', 'Synthetic Invalid', 'Synthetic', 1000, 'VND', 30)`,
        [tenant.id],
      ),
    ).rejects.toThrow();
  });

  it('deactivates and reactivates services with idempotency and a single audit per effective transition', async () => {
    const { tenant, agent } = await createTenantAdmin('service-lifecycle-a');
    const route = `/tenants/${tenant.slug}/services`;
    const service = await createService(agent, route, {
      code: 'orthodontic-consultation',
      name: 'Orthodontic Consultation',
      groupName: 'Orthodontics',
      amount: 300000,
      currency: 'VND',
      durationMinutes: 45,
    });

    await agent
      .post(`${route}/${service.id}/deactivate`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(422);
    const deactivateKey = randomUUID();
    await agent
      .post(`${route}/${service.id}/deactivate`)
      .set('Idempotency-Key', deactivateKey)
      .send({ reason: 'NO_LONGER_OFFERED' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: service.id,
          isActive: false,
        });
      });
    await agent
      .post(`${route}/${service.id}/deactivate`)
      .set('Idempotency-Key', deactivateKey)
      .send({ reason: 'NO_LONGER_OFFERED' })
      .expect(200)
      .expect('Idempotency-Replayed', 'true');
    await agent
      .post(`${route}/${service.id}/deactivate`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'NO_LONGER_OFFERED' })
      .expect(200);
    await expect(
      auditLogsRepository.count({
        where: {
          action: AuditAction.SERVICE_DEACTIVATED,
          resourceId: service.id,
        },
      }),
    ).resolves.toBe(1);

    const activateKey = randomUUID();
    await agent
      .post(`${route}/${service.id}/activate`)
      .set('Idempotency-Key', activateKey)
      .send({ reason: 'SERVICE_REINTRODUCED' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ id: service.id, isActive: true });
      });
    await agent
      .post(`${route}/${service.id}/activate`)
      .set('Idempotency-Key', activateKey)
      .send({ reason: 'SERVICE_REINTRODUCED' })
      .expect(200)
      .expect('Idempotency-Replayed', 'true');
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.SERVICE_ACTIVATED,
        resourceId: service.id,
      }),
    ).resolves.toMatchObject({
      reason: 'SERVICE_REINTRODUCED',
      before: { isActive: false, changedFields: ['isActive'] },
      after: { isActive: true, changedFields: ['isActive'] },
    });
    await agent
      .get(`${route}?isActive=true`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: Array<{ id: string }> };
        expect(body.items.map(({ id }) => id)).toEqual([service.id]);
      });
  });

  it('enforces authentication, permission, tenant isolation, subscription state, and no deletion route', async () => {
    const { tenant: tenantA, agent: tenantAdminAgent } =
      await createTenantAdmin('service-security-a');
    const tenantB = await authFixtures.createTenant({
      slug: 'service-security-b',
    });
    const { agent: tenantBAdminAgent } = await createTenantAdminFor(tenantB);
    const otherService = await createService(
      tenantBAdminAgent,
      `/tenants/${tenantB.slug}/services`,
      {
        code: 'other-tenant-service',
        name: 'Other Tenant Service',
        groupName: 'Synthetic',
        amount: 1000,
        currency: 'VND',
        durationMinutes: 10,
      },
    );
    const branchUser = await authFixtures.createUser({
      email: 'branch-only@tenant-services.test',
    });
    const branch = await authFixtures.createBranch(tenantA, {
      slug: 'service-security-branch',
    });
    await authFixtures.grantBranchRole(
      branchUser,
      branch,
      TenantRoleCode.BRANCH_ADMIN,
    );
    const branchUserSession = await loginAs(app, {
      email: branchUser.email,
      password: PASSWORD,
    });
    const routeA = `/tenants/${tenantA.slug}/services`;

    await request(app.getHttpServer() as Server)
      .get(routeA)
      .expect(401);
    await branchUserSession.agent.get(routeA).expect(403);
    await tenantBAdminAgent.get(routeA).expect(403);
    await tenantAdminAgent.get(`${routeA}/${otherService.id}`).expect(404);
    await tenantAdminAgent
      .patch(`${routeA}/${otherService.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Must not update another tenant' })
      .expect(404);
    await tenantAdminAgent
      .post(routeA)
      .send({
        code: 'missing-idempotency-key',
        name: 'Synthetic Service',
        groupName: 'Synthetic',
        amount: 1000,
        currency: 'VND',
        durationMinutes: 10,
      })
      .expect(422);
    await tenantAdminAgent.delete(`${routeA}/${otherService.id}`).expect(404);

    await dataSource.getRepository(Tenant).update(tenantA.id, {
      status: TenantStatus.SUSPENDED,
    });
    await tenantAdminAgent.get(routeA).expect(403);
  });

  it('rolls back service creation when its required audit insert fails', async () => {
    const { tenant, agent } = await createTenantAdmin('service-audit-failure');
    const payload = {
      code: 'audit-failure-service',
      name: 'Synthetic Audit Failure Service',
      groupName: 'Synthetic',
      amount: 1000,
      currency: 'VND',
      durationMinutes: 10,
    };
    await dataSource.query(`
      CREATE FUNCTION reject_service_created_audit()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.action = 'SERVICE_CREATED' THEN
          RAISE EXCEPTION 'forced service audit failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER trg_reject_service_created_audit
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION reject_service_created_audit()
    `);

    try {
      await agent
        .post(`/tenants/${tenant.slug}/services`)
        .set('Idempotency-Key', randomUUID())
        .send(payload)
        .expect(500);
      await expect(
        servicesRepository.count({
          where: { tenantId: tenant.id, code: payload.code },
        }),
      ).resolves.toBe(0);
    } finally {
      await dataSource.query(
        'DROP TRIGGER IF EXISTS trg_reject_service_created_audit ON audit_logs',
      );
      await dataSource.query(
        'DROP FUNCTION IF EXISTS reject_service_created_audit()',
      );
    }
  });

  async function createService(
    agent: ReturnType<typeof request.agent>,
    route: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown> & { id: string }> {
    const response = await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);
    return response.body as Record<string, unknown> & { id: string };
  }

  async function createTenantAdmin(slug: string): Promise<{
    tenant: Tenant;
    user: User;
    agent: ReturnType<typeof request.agent>;
  }> {
    const tenant = await authFixtures.createTenant({ slug });
    return createTenantAdminFor(tenant);
  }

  async function createTenantAdminFor(tenant: Tenant): Promise<{
    tenant: Tenant;
    user: User;
    agent: ReturnType<typeof request.agent>;
  }> {
    const user = await authFixtures.createUser({
      email: `tenant-admin-${randomUUID()}@tenant-services.test`,
    });
    await authFixtures.grantTenantRole(
      user,
      tenant,
      TenantRoleCode.TENANT_ADMIN,
    );
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    return { tenant, user, agent: session.agent };
  }
});
