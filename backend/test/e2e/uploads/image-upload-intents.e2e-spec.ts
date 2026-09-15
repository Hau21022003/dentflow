import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { AppConfigService } from 'src/config/app-config.service';
import { TenantRoleCode } from 'src/modules/authorization/entities/role-assignment.entity';
import { Branch } from 'src/modules/branches/entities/branch.entity';
import {
  Tenant,
  TenantStatus,
} from 'src/modules/tenants/entities/tenant.entity';
import { User } from 'src/modules/users/entities/user.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-image-upload-password';

describe('Image upload intents (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
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

  it('requires authentication and validates the image intent body', async () => {
    const { tenant, branch, agent } = await createBranchUser(
      TenantRoleCode.RECEPTIONIST,
    );
    const route = uploadRoute(tenant, branch.slug);

    await request(app.getHttpServer() as Server)
      .post(route)
      .send({ contentType: 'image/jpeg', sizeBytes: 1 })
      .expect(401);
    await agent
      .post(route)
      .send({ contentType: 'image/svg+xml', sizeBytes: 1 })
      .expect(422);
    await agent
      .post(route)
      .send({ contentType: 'image/jpeg', sizeBytes: 2 * 1024 * 1024 + 1 })
      .expect(413);
  });

  it('issues user-owned avatar intents only to authenticated users', async () => {
    const user = await authFixtures.createUser({
      email: 'avatar-intent@example.test',
    });
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });

    await request(app.getHttpServer() as Server)
      .post('/uploads/image-intents')
      .send({ folder: 'AVATAR', contentType: 'image/png', sizeBytes: 1 })
      .expect(401);
    await session.agent
      .post('/uploads/image-intents')
      .send({
        folder: 'ARBITRARY_PATH',
        contentType: 'image/png',
        sizeBytes: 1,
      })
      .expect(422);
    await session.agent
      .post('/uploads/image-intents')
      .send({ folder: 'AVATAR', contentType: 'image/png', sizeBytes: 1 })
      // Storage is intentionally disabled in API e2e. Reaching 503 proves
      // JWT authentication and the AVATAR policy were accepted.
      .expect(503);
  });

  it('allows every operational role only in its verified branch scope', async () => {
    const tenant = await authFixtures.createTenant({
      slug: 'image-upload-tenant',
    });
    const allowedBranch = await authFixtures.createBranch(tenant, {
      slug: 'allowed',
    });
    const otherBranch = await authFixtures.createBranch(tenant, {
      slug: 'other',
    });

    const tenantAdmin = await createUserWithRole(
      tenant,
      allowedBranch.slug,
      TenantRoleCode.TENANT_ADMIN,
    );
    const branchAdmin = await createUserWithRole(
      tenant,
      allowedBranch.slug,
      TenantRoleCode.BRANCH_ADMIN,
    );
    const receptionist = await createUserWithRole(
      tenant,
      allowedBranch.slug,
      TenantRoleCode.RECEPTIONIST,
    );
    const dentist = await createUserWithRole(
      tenant,
      allowedBranch.slug,
      TenantRoleCode.DENTIST,
    );

    const allowedRoute = uploadRoute(tenant, allowedBranch.slug);
    for (const user of [tenantAdmin, branchAdmin, receptionist, dentist]) {
      await user.agent
        .post(allowedRoute)
        .send({ contentType: 'image/png', sizeBytes: 1 })
        // S3 is intentionally disabled in automated API tests. Reaching 503
        // proves all authentication, lifecycle, and permission guards passed.
        .expect(503);
    }

    for (const user of [branchAdmin, receptionist, dentist]) {
      await user.agent
        .post(uploadRoute(tenant, otherBranch.slug))
        .send({ contentType: 'image/png', sizeBytes: 1 })
        .expect(403);
    }
    await tenantAdmin.agent
      .post(uploadRoute(tenant, otherBranch.slug))
      .send({ contentType: 'image/png', sizeBytes: 1 })
      .expect(503);
  });

  it('denies a different tenant and a suspended tenant before storage is used', async () => {
    const tenantA = await authFixtures.createTenant({ slug: 'image-upload-a' });
    const branchA = await authFixtures.createBranch(tenantA, {
      slug: 'central',
    });
    const tenantB = await authFixtures.createTenant({ slug: 'image-upload-b' });
    const branchB = await authFixtures.createBranch(tenantB, {
      slug: 'central',
    });
    const user = await createUserWithRole(
      tenantA,
      branchA.slug,
      TenantRoleCode.RECEPTIONIST,
    );

    await user.agent
      .post(uploadRoute(tenantB, branchB.slug))
      .send({ contentType: 'image/webp', sizeBytes: 1 })
      .expect(403);
    await dataSource
      .getRepository(Tenant)
      .update(tenantA.id, { status: TenantStatus.SUSPENDED });
    await user.agent
      .post(uploadRoute(tenantA, branchA.slug))
      .send({ contentType: 'image/webp', sizeBytes: 1 })
      .expect(403);
  });

  async function createBranchUser(roleCode: TenantRoleCode): Promise<{
    tenant: Tenant;
    branch: Branch;
    agent: ReturnType<typeof request.agent>;
  }> {
    const tenant = await authFixtures.createTenant({
      slug: `image-upload-${roleCode.toLowerCase()}`,
    });
    const branch = await authFixtures.createBranch(tenant, { slug: 'central' });
    const user = await createUserWithRole(tenant, branch.slug, roleCode);
    return { tenant, branch, agent: user.agent };
  }

  async function createUserWithRole(
    tenant: Tenant,
    branchSlug: string,
    roleCode: TenantRoleCode,
  ): Promise<{ user: User; agent: ReturnType<typeof request.agent> }> {
    const branch = await dataSource.getRepository(Branch).findOneByOrFail({
      tenantId: tenant.id,
      slug: branchSlug,
    });
    const user = await authFixtures.createUser({
      email: `${roleCode.toLowerCase()}-${Math.random()}@image-upload.test`,
    });
    if (roleCode === TenantRoleCode.TENANT_ADMIN) {
      await authFixtures.grantTenantRole(user, tenant, roleCode);
    } else {
      await authFixtures.grantBranchRole(user, branch, roleCode);
    }
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    return { user, agent: session.agent };
  }
});

function uploadRoute(tenant: Tenant, branchSlug: string): string {
  return `/tenants/${tenant.slug}/branches/${branchSlug}/uploads/image-intents`;
}
