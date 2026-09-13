import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import { TenantRoleCode } from 'src/modules/authorization/entities/role-assignment.entity';
import { ServiceGroup } from 'src/modules/service-groups/entities/service-group.entity';
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
  let serviceGroupsRepository: Repository<ServiceGroup>;
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
    serviceGroupsRepository = dataSource.getRepository(ServiceGroup);
    auditLogsRepository = dataSource.getRepository(AuditLog);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('manages service groups with normalized case-insensitive names and lifecycle audit', async () => {
    const { tenant, agent } = await createTenantAdmin('service-groups-a');
    const route = `/tenants/${tenant.slug}/service-groups`;
    const group = await createServiceGroup(
      agent,
      route,
      '  Preventive   Care ',
    );

    expect(group).toMatchObject({ name: 'Preventive Care', isActive: true });
    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'preventive care' })
      .expect(409);
    await agent
      .get(`${route}?search=preventive&isActive=true&sortBy=name&sortOrder=ASC`)
      .expect(200)
      .expect((response) => {
        expect(response.body.items).toEqual([
          expect.objectContaining({ id: group.id, name: 'Preventive Care' }),
        ]);
      });

    const deactivateKey = randomUUID();
    await agent
      .post(`${route}/${group.id}/deactivate`)
      .set('Idempotency-Key', deactivateKey)
      .send({ reason: 'RETIRED' })
      .expect(200);
    await agent
      .post(`${route}/${group.id}/deactivate`)
      .set('Idempotency-Key', deactivateKey)
      .send({ reason: 'RETIRED' })
      .expect(200)
      .expect('Idempotency-Replayed', 'true');
    await agent
      .post(`${route}/${group.id}/deactivate`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'RETIRED' })
      .expect(200);
    await expect(
      auditLogsRepository.count({
        where: {
          action: AuditAction.SERVICE_GROUP_DEACTIVATED,
          resourceId: group.id,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.SERVICE_GROUP_DEACTIVATED,
        resourceId: group.id,
      }),
    ).resolves.toMatchObject({
      reason: 'RETIRED',
      before: { changedFields: ['isActive'], isActive: true },
      after: { changedFields: ['isActive'], isActive: false },
    });

    await agent
      .patch(`${route}/${group.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Preventive Services' })
      .expect(200)
      .expect((response) =>
        expect(response.body.name).toBe('Preventive Services'),
      );
  });

  it('enforces group tenant isolation, permission, subscription state, and no deletion route', async () => {
    const { tenant: tenantA, agent: tenantAdminAgent } =
      await createTenantAdmin('service-groups-security-a');
    const tenantB = await authFixtures.createTenant({
      slug: 'service-groups-security-b',
    });
    const { agent: tenantBAdminAgent } = await createTenantAdminFor(tenantB);
    const otherGroup = await createServiceGroup(
      tenantBAdminAgent,
      `/tenants/${tenantB.slug}/service-groups`,
      'Other tenant group',
    );
    const branchUser = await authFixtures.createUser({
      email: 'branch-only-service-groups@tenant-services.test',
    });
    const branch = await authFixtures.createBranch(tenantA, {
      slug: 'service-groups-branch',
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
    const route = `/tenants/${tenantA.slug}/service-groups`;

    await request(app.getHttpServer() as Server)
      .get(route)
      .expect(401);
    await branchUserSession.agent.get(route).expect(403);
    await tenantBAdminAgent.get(route).expect(403);
    await tenantAdminAgent.get(`${route}/${otherGroup.id}`).expect(404);
    await tenantAdminAgent.delete(`${route}/${otherGroup.id}`).expect(404);
    await dataSource
      .getRepository(Tenant)
      .update(tenantA.id, { status: TenantStatus.SUSPENDED });
    await tenantAdminAgent.get(route).expect(403);
  });

  it('requires an active same-tenant group for Service create or reassignment while preserving existing services', async () => {
    const { tenant, agent } = await createTenantAdmin('service-group-link-a');
    const groupsRoute = `/tenants/${tenant.slug}/service-groups`;
    const servicesRoute = `/tenants/${tenant.slug}/services`;
    const activeGroup = await createServiceGroup(
      agent,
      groupsRoute,
      'Examination',
    );
    const alternativeGroup = await createServiceGroup(
      agent,
      groupsRoute,
      'Hygiene',
    );
    const service = await createService(agent, servicesRoute, {
      code: 'general-exam',
      name: 'General Examination',
      serviceGroupId: activeGroup.id,
      amount: 150000,
      currency: 'VND',
      durationMinutes: 30,
    });

    expect(service).toMatchObject({
      code: 'general-exam',
      serviceGroup: { id: activeGroup.id, name: 'Examination', isActive: true },
    });
    expect(service.groupName).toBeUndefined();
    await agent
      .post(servicesRoute)
      .set('Idempotency-Key', randomUUID())
      .send({
        code: 'legacy-group-name',
        name: 'Legacy payload',
        groupName: 'Examination',
        amount: 1,
        currency: 'VND',
        durationMinutes: 10,
      })
      .expect(422);

    await agent
      .post(`${groupsRoute}/${activeGroup.id}/deactivate`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'PAUSED' })
      .expect(200);
    await agent
      .patch(`${servicesRoute}/${service.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Renamed General Examination' })
      .expect(200)
      .expect((response) => {
        expect(response.body.isActive).toBe(true);
        expect(response.body.serviceGroup).toMatchObject({
          id: activeGroup.id,
          isActive: false,
        });
      });
    await agent
      .post(servicesRoute)
      .set('Idempotency-Key', randomUUID())
      .send({
        code: 'blocked-group',
        name: 'Blocked group service',
        serviceGroupId: activeGroup.id,
        amount: 1,
        currency: 'VND',
        durationMinutes: 10,
      })
      .expect(422);
    await agent
      .patch(`${servicesRoute}/${service.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ serviceGroupId: alternativeGroup.id })
      .expect(200)
      .expect((response) =>
        expect(response.body.serviceGroup).toMatchObject({
          id: alternativeGroup.id,
        }),
      );
    await agent
      .get(
        `${servicesRoute}?search=hygiene&sortBy=serviceGroupName&sortOrder=ASC`,
      )
      .expect(200)
      .expect((response) => expect(response.body.items[0].id).toBe(service.id));
    await expect(
      auditLogsRepository.find({
        where: { action: AuditAction.SERVICE_UPDATED, resourceId: service.id },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          before: expect.objectContaining({
            changedFields: ['serviceGroupId'],
          }),
          after: expect.objectContaining({ changedFields: ['serviceGroupId'] }),
        }),
      ]),
    );
  });

  it('database FK rejects cross-tenant service-to-group links', async () => {
    const tenantA = await authFixtures.createTenant({ slug: 'service-fk-a' });
    const tenantB = await authFixtures.createTenant({ slug: 'service-fk-b' });
    const groupA = await serviceGroupsRepository.save({
      tenantId: tenantA.id,
      name: 'Tenant A group',
      isActive: true,
    });
    const groupB = await serviceGroupsRepository.save({
      tenantId: tenantB.id,
      name: 'Tenant B group',
      isActive: true,
    });

    await expect(
      dataSource.query(
        `INSERT INTO "services" ("tenant_id", "code", "name", "service_group_id", "amount", "currency", "duration_minutes")
         VALUES ($1, 'cross-tenant-group', 'Synthetic service', $2, 1000, 'VND', 30)`,
        [tenantA.id, groupB.id],
      ),
    ).rejects.toThrow();
    await expect(
      servicesRepository.count({ where: { tenantId: tenantA.id } }),
    ).resolves.toBe(0);
    expect(groupA.tenantId).toBe(tenantA.id);
  });

  it('backfills normalized legacy group_name values and refuses blank legacy values', async () => {
    const tenantA = await authFixtures.createTenant({
      slug: 'service-migration-a',
    });
    const tenantB = await authFixtures.createTenant({
      slug: 'service-migration-b',
    });

    await dataSource.undoLastMigration();
    await dataSource.query(
      `INSERT INTO "services" ("tenant_id", "code", "name", "group_name", "amount", "currency", "duration_minutes")
       VALUES
         ($1, 'legacy-imaging-one', 'Legacy Imaging One', '  Imaging  ', 1000, 'VND', 30),
         ($1, 'legacy-imaging-two', 'Legacy Imaging Two', 'imaging', 1000, 'VND', 30),
         ($2, 'legacy-imaging-other-tenant', 'Legacy Imaging Other Tenant', 'Imaging', 1000, 'VND', 30)`,
      [tenantA.id, tenantB.id],
    );
    await dataSource.runMigrations();

    const groups = (await dataSource.query(
      `SELECT "tenant_id", "name"
       FROM "service_groups"
       WHERE "tenant_id" IN ($1, $2)
       ORDER BY "tenant_id", "name"`,
      [tenantA.id, tenantB.id],
    )) as Array<{ tenant_id: string; name: string }>;
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.tenant_id).sort()).toEqual(
      [tenantA.id, tenantB.id].sort(),
    );
    expect(
      groups.every((group) => group.name.toLocaleLowerCase() === 'imaging'),
    ).toBe(true);
    const links = (await dataSource.query(
      `SELECT "tenant_id", "code", "service_group_id"
       FROM "services"
       WHERE "code" LIKE 'legacy-imaging-%'
       ORDER BY "code"`,
    )) as Array<{ tenant_id: string; code: string; service_group_id: string }>;
    expect(links).toHaveLength(3);
    const linksByCode = new Map(links.map((link) => [link.code, link]));
    expect(linksByCode.get('legacy-imaging-one')?.service_group_id).toBe(
      linksByCode.get('legacy-imaging-two')?.service_group_id,
    );
    expect(linksByCode.get('legacy-imaging-one')?.service_group_id).not.toBe(
      linksByCode.get('legacy-imaging-other-tenant')?.service_group_id,
    );

    await dataSource.undoLastMigration();
    await dataSource.query(
      `INSERT INTO "services" ("tenant_id", "code", "name", "group_name", "amount", "currency", "duration_minutes")
       VALUES ($1, 'legacy-blank-group', 'Legacy Blank Group', '   ', 1000, 'VND', 30)`,
      [tenantA.id],
    );
    await expect(dataSource.runMigrations()).rejects.toThrow(
      'Cannot migrate services with a blank group_name',
    );
    const remainingTable = (await dataSource.query(
      `SELECT to_regclass('service_groups') AS "tableName"`,
    )) as Array<{ tableName: string | null }>;
    if (remainingTable[0]?.tableName) {
      await dataSource.query('DROP TABLE "service_groups"');
    }
    await dataSource.query(
      `UPDATE "services" SET "group_name" = 'Remediated' WHERE "code" = 'legacy-blank-group'`,
    );
    await dataSource.runMigrations();
  });

  async function createServiceGroup(
    agent: ReturnType<typeof request.agent>,
    route: string,
    name: string,
  ): Promise<{ id: string; name: string; isActive: boolean }> {
    const response = await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({ name })
      .expect(201);
    return response.body as { id: string; name: string; isActive: boolean };
  }

  async function createService(
    agent: ReturnType<typeof request.agent>,
    route: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown> & { id: string; groupName?: unknown }> {
    const response = await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);
    return response.body as Record<string, unknown> & {
      id: string;
      groupName?: unknown;
    };
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
