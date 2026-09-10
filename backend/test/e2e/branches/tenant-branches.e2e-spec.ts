import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import { PlatformRoleCode } from 'src/modules/authorization/entities/platform-role-assignment.entity';
import {
  RoleAssignment,
  TenantRoleCode,
} from 'src/modules/authorization/entities/role-assignment.entity';
import {
  Branch,
  BranchStatus,
} from 'src/modules/branches/entities/branch.entity';
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

const PASSWORD = 'synthetic-tenant-branch-password';

describe('Tenant Admin branch management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;
  let branchesRepository: Repository<Branch>;
  let auditLogsRepository: Repository<AuditLog>;
  let roleAssignmentsRepository: Repository<RoleAssignment>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    const appConfig = app.get(AppConfigService);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds: appConfig.securityConfig.bcryptSaltRounds,
    });
    branchesRepository = dataSource.getRepository(Branch);
    auditLogsRepository = dataSource.getRepository(AuditLog);
    roleAssignmentsRepository = dataSource.getRepository(RoleAssignment);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('lists only the current tenant branches with paging, search, filter, and safe sorting', async () => {
    const { tenant, agent } = await createTenantAdmin('branch-list-a');
    const otherTenant = await authFixtures.createTenant({
      slug: 'branch-list-b',
    });
    const alpha = await authFixtures.createBranch(tenant, {
      slug: 'alpha',
      name: 'Alpha Catalog',
    });
    const bravo = await authFixtures.createBranch(tenant, {
      slug: 'bravo',
      name: 'Bravo Catalog',
      status: BranchStatus.INACTIVE,
    });
    const zulu = await authFixtures.createBranch(tenant, {
      slug: 'zulu',
      name: 'Zulu Catalog',
    });
    await authFixtures.createBranch(otherTenant, {
      slug: 'other-catalog',
      name: 'Other Catalog',
    });
    await branchesRepository.update(alpha.id, {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await branchesRepository.update(bravo.id, {
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await branchesRepository.update(zulu.id, {
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
    });

    const baseRoute = `/tenants/${tenant.slug}/branches`;
    await agent
      .get(`${baseRoute}?search=Catalog&page=1&limit=2`)
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          items: Array<{ id: string }>;
          meta: Record<string, number>;
        };
        expect(body.items.map((branch) => branch.id)).toEqual([
          alpha.id,
          bravo.id,
        ]);
        expect(body.meta).toEqual({
          page: 1,
          limit: 2,
          total: 3,
          totalPages: 2,
        });
      });
    await agent
      .get(`${baseRoute}?status=INACTIVE`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: Array<{ id: string }> };
        expect(body.items.map((branch) => branch.id)).toEqual([bravo.id]);
      });
    await agent
      .get(`${baseRoute}?sortBy=createdAt&sortOrder=DESC`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: Array<{ id: string }> };
        expect(body.items.map((branch) => branch.id)).toEqual([
          zulu.id,
          bravo.id,
          alpha.id,
        ]);
      });
    await agent.get(`${baseRoute}?sortBy=DROP_TABLE`).expect(422);
  });

  it('creates, updates, and deactivates a branch with idempotency, audit, and retained role assignments', async () => {
    const { tenant, agent, user } = await createTenantAdmin('branch-command-a');
    const otherTenant = await authFixtures.createTenant({
      slug: 'branch-command-b',
    });
    const { agent: otherAgent } = await createTenantAdminFor(otherTenant);
    const route = `/tenants/${tenant.slug}/branches`;
    const payload = {
      slug: 'district-7',
      name: '  Synthetic   District 7 ',
      address: '  7 Synthetic Street ',
      phone: ' +84900000007 ',
      timezone: 'Asia/Ho_Chi_Minh',
    };
    const createKey = randomUUID();

    const created = await agent
      .post(route)
      .set('Idempotency-Key', createKey)
      .send(payload)
      .expect(201);
    const createdBody = created.body as {
      id: string;
      name: string;
      status: string;
    };
    expect(createdBody).toMatchObject({
      slug: payload.slug,
      name: 'Synthetic District 7',
      address: '7 Synthetic Street',
      phone: '+84900000007',
      timezone: payload.timezone,
      status: BranchStatus.ACTIVE,
    });
    expect(createdBody).not.toHaveProperty('tenantId');

    await agent
      .post(route)
      .set('Idempotency-Key', createKey)
      .send(payload)
      .expect(201)
      .expect('Idempotency-Replayed', 'true');
    await expect(
      branchesRepository.count({
        where: { tenantId: tenant.id, slug: payload.slug },
      }),
    ).resolves.toBe(1);
    await expect(
      auditLogsRepository.count({
        where: {
          action: AuditAction.BRANCH_CREATED,
          resourceId: createdBody.id,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.BRANCH_CREATED,
        resourceId: createdBody.id,
      }),
    ).resolves.toMatchObject({
      actorUserId: user.id,
      tenantId: tenant.id,
      branchId: createdBody.id,
      after: {
        status: BranchStatus.ACTIVE,
        changedFields: [
          'slug',
          'name',
          'address',
          'phone',
          'timezone',
          'status',
        ],
      },
    });

    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(409);
    await otherAgent
      .post(`/tenants/${otherTenant.slug}/branches`)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);

    const updateKey = randomUUID();
    await agent
      .patch(`${route}/${payload.slug}`)
      .set('Idempotency-Key', updateKey)
      .send({ name: 'Synthetic District 7 Updated', timezone: null })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: createdBody.id,
          name: 'Synthetic District 7 Updated',
          timezone: null,
        });
      });
    await agent
      .patch(`${route}/${payload.slug}`)
      .set('Idempotency-Key', updateKey)
      .send({ name: 'A different name' })
      .expect(409);
    await agent
      .patch(`${route}/${payload.slug}`)
      .set('Idempotency-Key', randomUUID())
      .send({ slug: 'renamed-branch' })
      .expect(422);
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.BRANCH_UPDATED,
        resourceId: createdBody.id,
      }),
    ).resolves.toMatchObject({
      before: {
        status: BranchStatus.ACTIVE,
        changedFields: ['name', 'timezone'],
      },
      after: {
        status: BranchStatus.ACTIVE,
        changedFields: ['name', 'timezone'],
      },
    });

    const branch = await branchesRepository.findOneByOrFail({
      id: createdBody.id,
    });
    const assignedUser = await authFixtures.createUser({
      email: 'retained-assignment@tenant-branches.test',
    });
    const assignment = await authFixtures.grantBranchRole(
      assignedUser,
      branch,
      TenantRoleCode.RECEPTIONIST,
    );
    await agent
      .post(`${route}/${payload.slug}/deactivate`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_BRANCH_CLOSURE' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: branch.id,
          status: BranchStatus.INACTIVE,
        });
      });
    await expect(
      roleAssignmentsRepository.findOneByOrFail({ id: assignment.id }),
    ).resolves.toMatchObject({ revokedAt: null });
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.BRANCH_DEACTIVATED,
        resourceId: branch.id,
      }),
    ).resolves.toMatchObject({
      reason: 'SYNTHETIC_BRANCH_CLOSURE',
      before: { status: BranchStatus.ACTIVE, changedFields: ['status'] },
      after: { status: BranchStatus.INACTIVE, changedFields: ['status'] },
    });

    const activateKey = randomUUID();
    await agent
      .post(`${route}/${payload.slug}/activate`)
      .set('Idempotency-Key', activateKey)
      .send({ reason: 'SYNTHETIC_BRANCH_REOPENING' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: branch.id,
          status: BranchStatus.ACTIVE,
        });
      });
    await agent
      .post(`${route}/${payload.slug}/activate`)
      .set('Idempotency-Key', activateKey)
      .send({ reason: 'SYNTHETIC_BRANCH_REOPENING' })
      .expect(200)
      .expect('Idempotency-Replayed', 'true');
    await expect(
      roleAssignmentsRepository.findOneByOrFail({ id: assignment.id }),
    ).resolves.toMatchObject({ revokedAt: null });
    await expect(
      auditLogsRepository.findOneByOrFail({
        action: AuditAction.BRANCH_ACTIVATED,
        resourceId: branch.id,
      }),
    ).resolves.toMatchObject({
      reason: 'SYNTHETIC_BRANCH_REOPENING',
      before: { status: BranchStatus.INACTIVE, changedFields: ['status'] },
      after: { status: BranchStatus.ACTIVE, changedFields: ['status'] },
    });
  });

  it('enforces authorization, tenant isolation, subscription state, and validation', async () => {
    const { tenant: tenantA, agent: tenantAdminAgent } =
      await createTenantAdmin('branch-security-a');
    const tenantB = await authFixtures.createTenant({
      slug: 'branch-security-b',
    });
    const branchB = await authFixtures.createBranch(tenantB, {
      slug: 'other-branch',
    });
    const { agent: tenantBAdminAgent } = await createTenantAdminFor(tenantB);
    const branchUser = await authFixtures.createUser({
      email: 'branch-only@tenant-branches.test',
    });
    const tenantABranch = await authFixtures.createBranch(tenantA, {
      slug: 'branch-only-scope',
    });
    await authFixtures.grantBranchRole(
      branchUser,
      tenantABranch,
      TenantRoleCode.BRANCH_ADMIN,
    );
    const branchUserSession = await loginAs(app, {
      email: branchUser.email,
      password: PASSWORD,
    });
    const platformUser = await authFixtures.createUser({
      email: 'platform-only@tenant-branches.test',
    });
    await authFixtures.grantPlatformRole(
      platformUser,
      PlatformRoleCode.PLATFORM_ADMIN,
    );
    const platformSession = await loginAs(app, {
      email: platformUser.email,
      password: PASSWORD,
    });
    const routeA = `/tenants/${tenantA.slug}/branches`;

    await request(app.getHttpServer() as Server)
      .get(routeA)
      .expect(401);
    await branchUserSession.agent.get(routeA).expect(403);
    await platformSession.agent.get(routeA).expect(403);
    await tenantBAdminAgent.get(routeA).expect(403);
    await tenantAdminAgent
      .patch(`${routeA}/${branchB.slug}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Must not update another tenant' })
      .expect(404);
    await tenantAdminAgent
      .post(routeA)
      .send({
        slug: 'missing-idempotency-key',
        name: 'Synthetic Branch',
        address: '1 Synthetic Street',
        phone: '+84900000000',
      })
      .expect(422);
    await tenantAdminAgent
      .post(`${routeA}/${tenantABranch.slug}/deactivate`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(422);

    await dataSource.getRepository(Tenant).update(tenantA.id, {
      status: TenantStatus.SUSPENDED,
    });
    await tenantAdminAgent.get(routeA).expect(403);
    await dataSource.getRepository(Tenant).update(tenantA.id, {
      status: TenantStatus.CANCELED,
    });
    await tenantAdminAgent.get(routeA).expect(403);
  });

  it('rolls back a branch mutation when its required audit insert fails', async () => {
    const { tenant, agent } = await createTenantAdmin('branch-audit-failure');
    const payload = {
      slug: 'audit-failure-branch',
      name: 'Synthetic Audit Failure Branch',
      address: '1 Synthetic Street',
      phone: '+84900000000',
    };
    await dataSource.query(`
      CREATE FUNCTION reject_branch_created_audit()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.action = 'BRANCH_CREATED' THEN
          RAISE EXCEPTION 'forced branch audit failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER trg_reject_branch_created_audit
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION reject_branch_created_audit()
    `);

    try {
      await agent
        .post(`/tenants/${tenant.slug}/branches`)
        .set('Idempotency-Key', randomUUID())
        .send(payload)
        .expect(500);
      await expect(
        branchesRepository.count({
          where: { tenantId: tenant.id, slug: payload.slug },
        }),
      ).resolves.toBe(0);
    } finally {
      await dataSource.query(
        'DROP TRIGGER IF EXISTS trg_reject_branch_created_audit ON audit_logs',
      );
      await dataSource.query(
        'DROP FUNCTION IF EXISTS reject_branch_created_audit()',
      );
    }
  });

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
      email: `tenant-admin-${randomUUID()}@tenant-branches.test`,
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
