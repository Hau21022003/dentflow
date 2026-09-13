import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'node:http';
import { AppConfigService } from 'src/config/app-config.service';
import { ACCESS_TOKEN_COOKIE } from 'src/modules/auth/auth.constants';
import { PlatformRoleCode } from 'src/modules/authorization/entities/platform-role-assignment.entity';
import {
  RoleAssignment,
  TenantRoleCode,
} from 'src/modules/authorization/entities/role-assignment.entity';
import {
  Branch,
  BranchStatus,
} from 'src/modules/branches/entities/branch.entity';
import { User, UserStatus } from 'src/modules/users/entities/user.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-authorization-password';

interface AuthorizationFixtureResponse {
  context: {
    tenant?: { id: string };
    branch?: { id: string };
    access: {
      platformRoles: PlatformRoleCode[];
      tenantRoles: TenantRoleCode[];
    };
  };
}

describe('Authorization guards (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let appConfig: AppConfigService;
  let jwtService: JwtService;
  let usersRepository: Repository<User>;
  let roleAssignmentsRepository: Repository<RoleAssignment>;
  let authFixtures: ReturnType<typeof createAuthFixtures>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    appConfig = app.get(AppConfigService);
    jwtService = app.get(JwtService);
    usersRepository = dataSource.getRepository(User);
    roleAssignmentsRepository = dataSource.getRepository(RoleAssignment);
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

  it('rejects missing, malformed, wrong-type, and expired access tokens', async () => {
    const user = await authFixtures.createUser({
      email: 'token-user@authorization.test',
    });

    await request(app.getHttpServer() as Server)
      .get('/testing/authorization/platform')
      .expect(401);
    await request(app.getHttpServer() as Server)
      .get('/testing/authorization/platform')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=not-a-jwt`)
      .expect(401);

    const wrongTypeToken = await jwtService.signAsync(
      { sub: user.id, sid: 'synthetic-session', typ: 'refresh' },
      {
        secret: appConfig.authConfig.jwtAccess.secret,
        expiresIn: 60,
      },
    );
    await request(app.getHttpServer() as Server)
      .get('/testing/authorization/platform')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${wrongTypeToken}`)
      .expect(401);

    const expiredToken = await jwtService.signAsync(
      { sub: user.id, sid: 'synthetic-session', typ: 'access' },
      {
        secret: appConfig.authConfig.jwtAccess.secret,
        expiresIn: -1,
      },
    );
    await request(app.getHttpServer() as Server)
      .get('/testing/authorization/platform')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${expiredToken}`)
      .expect(401);
  });

  it('enforces platform, tenant, and branch permissions without cross-scope access', async () => {
    const tenantA = await authFixtures.createTenant({
      slug: 'synthetic-tenant-a',
    });
    const tenantB = await authFixtures.createTenant({
      slug: 'synthetic-tenant-b',
    });
    const branchA1 = await authFixtures.createBranch(tenantA, {
      slug: 'district-1',
    });
    const branchA2 = await authFixtures.createBranch(tenantA, {
      slug: 'district-2',
    });
    const branchB1 = await authFixtures.createBranch(tenantB, {
      slug: 'district-b1',
    });
    const platformUser = await authFixtures.createUser({
      email: 'platform@authorization.test',
    });
    const tenantAdmin = await authFixtures.createUser({
      email: 'tenant-admin@authorization.test',
    });
    const branchUser = await authFixtures.createUser({
      email: 'branch-user@authorization.test',
    });
    const partialBranchUser = await authFixtures.createUser({
      email: 'partial-branch-user@authorization.test',
    });
    const noRoleUser = await authFixtures.createUser({
      email: 'no-role@authorization.test',
    });

    await authFixtures.grantPlatformRole(
      platformUser,
      PlatformRoleCode.PLATFORM_ADMIN,
    );
    await authFixtures.grantTenantRole(
      tenantAdmin,
      tenantA,
      TenantRoleCode.TENANT_ADMIN,
    );
    await authFixtures.grantBranchRole(
      branchUser,
      branchA1,
      TenantRoleCode.RECEPTIONIST,
    );
    await authFixtures.grantBranchRole(
      branchUser,
      branchA1,
      TenantRoleCode.DENTIST,
    );
    await authFixtures.grantBranchRole(
      partialBranchUser,
      branchA1,
      TenantRoleCode.RECEPTIONIST,
    );

    const platformSession = await loginAs(app, {
      email: platformUser.email,
      password: PASSWORD,
    });
    const tenantAdminSession = await loginAs(app, {
      email: tenantAdmin.email,
      password: PASSWORD,
    });
    const branchSession = await loginAs(app, {
      email: branchUser.email,
      password: PASSWORD,
    });
    const partialBranchSession = await loginAs(app, {
      email: partialBranchUser.email,
      password: PASSWORD,
    });
    const noRoleSession = await loginAs(app, {
      email: noRoleUser.email,
      password: PASSWORD,
    });

    const platformResponse = await platformSession.agent
      .get('/testing/authorization/platform')
      .expect(200);
    expect(
      authorizationFixture(platformResponse).context.access.platformRoles,
    ).toEqual([PlatformRoleCode.PLATFORM_ADMIN]);
    await platformSession.agent
      .get(`/testing/authorization/tenants/${tenantA.slug}`)
      .expect(403);
    await noRoleSession.agent
      .get('/testing/authorization/platform')
      .expect(403);
    await noRoleSession.agent
      .get('/testing/authorization/jwt-only')
      .expect(200)
      .expect({ userId: noRoleUser.id });

    const tenantResponse = await tenantAdminSession.agent
      .get(`/testing/authorization/tenants/${tenantA.slug}`)
      .expect(200);
    expect(authorizationFixture(tenantResponse).context.tenant?.id).toBe(
      tenantA.id,
    );
    expect(
      authorizationFixture(tenantResponse).context.access.tenantRoles,
    ).toEqual([TenantRoleCode.TENANT_ADMIN]);
    await tenantAdminSession.agent
      .get(`/testing/authorization/tenants/${tenantB.slug}`)
      .expect(403);
    await tenantAdminSession.agent
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchA1.slug}`,
      )
      .expect(403);

    const branchResponse = await branchSession.agent
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchA1.slug}`,
      )
      .expect(200);
    expect(authorizationFixture(branchResponse).context.branch?.id).toBe(
      branchA1.id,
    );
    expect(
      authorizationFixture(branchResponse).context.access.tenantRoles,
    ).toEqual([TenantRoleCode.DENTIST, TenantRoleCode.RECEPTIONIST]);
    await branchSession.agent
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchA2.slug}`,
      )
      .expect(403);
    await partialBranchSession.agent
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchA1.slug}`,
      )
      .expect(403);

    await tenantAdminSession.agent
      .get('/testing/authorization/tenants/unknown-tenant')
      .expect(404);
    await branchSession.agent
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchB1.slug}`,
      )
      .expect(404);
  });

  it('enforces role revocation on the next scoped request', async () => {
    const { tenant, branch } = await authFixtures.createTenantWithBranch({
      tenant: { slug: 'revoke-tenant' },
      branch: { slug: 'revoke-branch' },
    });
    const user = await authFixtures.createUser({
      email: 'revoke-user@authorization.test',
    });
    await authFixtures.grantBranchRole(
      user,
      branch,
      TenantRoleCode.RECEPTIONIST,
    );
    const dentistGrant = await authFixtures.grantBranchRole(
      user,
      branch,
      TenantRoleCode.DENTIST,
    );
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    const route = `/testing/authorization/tenants/${tenant.slug}/branches/${branch.slug}`;

    await session.agent.get(route).expect(200);

    await roleAssignmentsRepository.update(dentistGrant.id, {
      revokedAt: new Date(),
      revokedByUserId: user.id,
      revocationReason: 'Synthetic authorization test',
    });

    await session.agent.get(route).expect(403);
  });

  it('blocks branch-scoped operations while allowing explicit historical audit reads on inactive branches', async () => {
    const tenant = await authFixtures.createTenant({
      slug: 'inactive-branch-tenant',
    });
    const branch = await authFixtures.createBranch(tenant, {
      slug: 'inactive-branch',
      status: BranchStatus.INACTIVE,
    });
    const user = await authFixtures.createUser({
      email: 'inactive-branch-user@authorization.test',
    });
    await authFixtures.grantBranchRole(
      user,
      branch,
      TenantRoleCode.BRANCH_ADMIN,
    );
    await authFixtures.grantBranchRole(user, branch, TenantRoleCode.DENTIST);
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    const operationalRoute = `/testing/authorization/tenants/${tenant.slug}/branches/${branch.slug}`;
    const auditRoute = `/tenants/${tenant.slug}/branches/${branch.slug}/audit-logs`;

    await session.agent.get(operationalRoute).expect(403);
    await session.agent.get(auditRoute).expect(200);

    await dataSource.getRepository(Branch).update(branch.id, {
      status: BranchStatus.ACTIVE,
    });
    await session.agent.get(operationalRoute).expect(200);
  });

  it('keeps a valid access token usable by generic guards after disable or logout', async () => {
    const { tenant, branch } = await authFixtures.createTenantWithBranch({
      tenant: { slug: 'token-lifecycle-tenant' },
      branch: { slug: 'token-lifecycle-branch' },
    });
    const disabledUser = await authFixtures.createUser({
      email: 'disabled@authorization.test',
    });
    const loggedOutUser = await authFixtures.createUser({
      email: 'logout@authorization.test',
    });
    await authFixtures.grantBranchRole(
      disabledUser,
      branch,
      TenantRoleCode.RECEPTIONIST,
    );
    await authFixtures.grantBranchRole(
      disabledUser,
      branch,
      TenantRoleCode.DENTIST,
    );
    await authFixtures.grantBranchRole(
      loggedOutUser,
      branch,
      TenantRoleCode.RECEPTIONIST,
    );
    await authFixtures.grantBranchRole(
      loggedOutUser,
      branch,
      TenantRoleCode.DENTIST,
    );
    const route = `/testing/authorization/tenants/${tenant.slug}/branches/${branch.slug}`;

    const disabledSession = await loginAs(app, {
      email: disabledUser.email,
      password: PASSWORD,
    });
    await usersRepository.update(disabledUser.id, {
      status: UserStatus.DISABLED,
    });
    await disabledSession.agent.get(route).expect(200);

    const loggedOutSession = await loginAs(app, {
      email: loggedOutUser.email,
      password: PASSWORD,
    });
    await loggedOutSession.agent.post('/auth/logout').expect(204);

    await request(app.getHttpServer() as Server)
      .get(route)
      .set('Cookie', loggedOutSession.accessCookie)
      .expect(200);
  });
});

function authorizationFixture(
  response: request.Response,
): AuthorizationFixtureResponse {
  return response.body as AuthorizationFixtureResponse;
}
