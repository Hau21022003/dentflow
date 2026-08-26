import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { AppConfigService } from 'src/config/app-config.service';
import {
  PlatformRoleAssignment,
  PlatformRoleCode,
} from 'src/modules/authorization/entities/platform-role-assignment.entity';
import {
  RoleAssignment,
  TenantRoleCode,
} from 'src/modules/authorization/entities/role-assignment.entity';
import { ACCESS_TOKEN_COOKIE } from 'src/modules/auth/auth.constants';
import { AuthSession } from 'src/modules/auth/sessions/entities/auth-session.entity';
import {
  Branch,
  BranchStatus,
} from 'src/modules/branches/entities/branch.entity';
import {
  Tenant,
  TenantStatus,
} from 'src/modules/tenants/entities/tenant.entity';
import { User, UserStatus } from 'src/modules/users/entities/user.entity';
import { hash } from 'src/common/utils/hash.util';
import { closeApp, initApp } from './app.setup';

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
  let sessionsRepository: Repository<AuthSession>;
  let tenantsRepository: Repository<Tenant>;
  let branchesRepository: Repository<Branch>;
  let platformAssignmentsRepository: Repository<PlatformRoleAssignment>;
  let roleAssignmentsRepository: Repository<RoleAssignment>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    appConfig = app.get(AppConfigService);
    jwtService = app.get(JwtService);
    usersRepository = dataSource.getRepository(User);
    sessionsRepository = dataSource.getRepository(AuthSession);
    tenantsRepository = dataSource.getRepository(Tenant);
    branchesRepository = dataSource.getRepository(Branch);
    platformAssignmentsRepository = dataSource.getRepository(
      PlatformRoleAssignment,
    );
    roleAssignmentsRepository = dataSource.getRepository(RoleAssignment);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await sessionsRepository.createQueryBuilder().delete().execute();
    await roleAssignmentsRepository.createQueryBuilder().delete().execute();
    await platformAssignmentsRepository.createQueryBuilder().delete().execute();
    await branchesRepository.createQueryBuilder().delete().execute();
    await tenantsRepository.createQueryBuilder().delete().execute();
    await usersRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    await closeApp();
  });

  it('rejects missing, malformed, wrong-type, and expired access tokens', async () => {
    const user = await createUser('token-user@authorization.test');

    await request(app.getHttpServer())
      .get('/testing/authorization/platform')
      .expect(401);
    await request(app.getHttpServer())
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
    await request(app.getHttpServer())
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
    await request(app.getHttpServer())
      .get('/testing/authorization/platform')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${expiredToken}`)
      .expect(401);
  });

  it('enforces platform, tenant, and branch permissions without cross-scope access', async () => {
    const tenantA = await createTenant('synthetic-tenant-a');
    const tenantB = await createTenant('synthetic-tenant-b');
    const branchA1 = await createBranch(tenantA, 'district-1');
    const branchA2 = await createBranch(tenantA, 'district-2');
    const branchB1 = await createBranch(tenantB, 'district-b1');
    const platformUser = await createUser('platform@authorization.test');
    const tenantAdmin = await createUser('tenant-admin@authorization.test');
    const branchUser = await createUser('branch-user@authorization.test');
    const partialBranchUser = await createUser(
      'partial-branch-user@authorization.test',
    );
    const noRoleUser = await createUser('no-role@authorization.test');

    await grantPlatform(platformUser, PlatformRoleCode.PLATFORM_ADMIN);
    await grantTenant(tenantAdmin, tenantA, TenantRoleCode.TENANT_ADMIN);
    await grantBranch(
      branchUser,
      tenantA,
      branchA1,
      TenantRoleCode.RECEPTIONIST,
    );
    await grantBranch(branchUser, tenantA, branchA1, TenantRoleCode.DENTIST);
    await grantBranch(
      partialBranchUser,
      tenantA,
      branchA1,
      TenantRoleCode.RECEPTIONIST,
    );

    const platformCookie = await login(platformUser);
    const tenantAdminCookie = await login(tenantAdmin);
    const branchCookie = await login(branchUser);
    const partialBranchCookie = await login(partialBranchUser);
    const noRoleCookie = await login(noRoleUser);

    const platformResponse = await request(app.getHttpServer())
      .get('/testing/authorization/platform')
      .set('Cookie', platformCookie)
      .expect(200);
    expect(
      authorizationFixture(platformResponse).context.access.platformRoles,
    ).toEqual([PlatformRoleCode.PLATFORM_ADMIN]);
    await request(app.getHttpServer())
      .get(`/testing/authorization/tenants/${tenantA.slug}`)
      .set('Cookie', platformCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get('/testing/authorization/platform')
      .set('Cookie', noRoleCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get('/testing/authorization/jwt-only')
      .set('Cookie', noRoleCookie)
      .expect(200)
      .expect({ userId: noRoleUser.id });

    const tenantResponse = await request(app.getHttpServer())
      .get(`/testing/authorization/tenants/${tenantA.slug}`)
      .set('Cookie', tenantAdminCookie)
      .expect(200);
    expect(authorizationFixture(tenantResponse).context.tenant?.id).toBe(
      tenantA.id,
    );
    expect(
      authorizationFixture(tenantResponse).context.access.tenantRoles,
    ).toEqual([TenantRoleCode.TENANT_ADMIN]);
    await request(app.getHttpServer())
      .get(`/testing/authorization/tenants/${tenantB.slug}`)
      .set('Cookie', tenantAdminCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchA1.slug}`,
      )
      .set('Cookie', tenantAdminCookie)
      .expect(403);

    const branchResponse = await request(app.getHttpServer())
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchA1.slug}`,
      )
      .set('Cookie', branchCookie)
      .expect(200);
    expect(authorizationFixture(branchResponse).context.branch?.id).toBe(
      branchA1.id,
    );
    expect(
      authorizationFixture(branchResponse).context.access.tenantRoles,
    ).toEqual([TenantRoleCode.DENTIST, TenantRoleCode.RECEPTIONIST]);
    await request(app.getHttpServer())
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchA2.slug}`,
      )
      .set('Cookie', branchCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchA1.slug}`,
      )
      .set('Cookie', partialBranchCookie)
      .expect(403);

    await request(app.getHttpServer())
      .get('/testing/authorization/tenants/unknown-tenant')
      .set('Cookie', tenantAdminCookie)
      .expect(404);
    await request(app.getHttpServer())
      .get(
        `/testing/authorization/tenants/${tenantA.slug}/branches/${branchB1.slug}`,
      )
      .set('Cookie', branchCookie)
      .expect(404);
  });

  it('enforces role revocation on the next scoped request', async () => {
    const tenant = await createTenant('revoke-tenant');
    const branch = await createBranch(tenant, 'revoke-branch');
    const user = await createUser('revoke-user@authorization.test');
    await grantBranch(user, tenant, branch, TenantRoleCode.RECEPTIONIST);
    const dentistGrant = await grantBranch(
      user,
      tenant,
      branch,
      TenantRoleCode.DENTIST,
    );
    const cookie = await login(user);
    const route = `/testing/authorization/tenants/${tenant.slug}/branches/${branch.slug}`;

    await request(app.getHttpServer())
      .get(route)
      .set('Cookie', cookie)
      .expect(200);

    await roleAssignmentsRepository.update(dentistGrant.id, {
      revokedAt: new Date(),
      revokedByUserId: user.id,
      revocationReason: 'Synthetic authorization test',
    });

    await request(app.getHttpServer())
      .get(route)
      .set('Cookie', cookie)
      .expect(403);
  });

  it('keeps a valid access token usable by generic guards after disable or logout', async () => {
    const tenant = await createTenant('token-lifecycle-tenant');
    const branch = await createBranch(tenant, 'token-lifecycle-branch');
    const disabledUser = await createUser('disabled@authorization.test');
    const loggedOutUser = await createUser('logout@authorization.test');
    await grantBranch(
      disabledUser,
      tenant,
      branch,
      TenantRoleCode.RECEPTIONIST,
    );
    await grantBranch(disabledUser, tenant, branch, TenantRoleCode.DENTIST);
    await grantBranch(
      loggedOutUser,
      tenant,
      branch,
      TenantRoleCode.RECEPTIONIST,
    );
    await grantBranch(loggedOutUser, tenant, branch, TenantRoleCode.DENTIST);
    const route = `/testing/authorization/tenants/${tenant.slug}/branches/${branch.slug}`;

    const disabledCookie = await login(disabledUser);
    await usersRepository.update(disabledUser.id, {
      status: UserStatus.DISABLED,
    });
    await request(app.getHttpServer())
      .get(route)
      .set('Cookie', disabledCookie)
      .expect(200);

    const logoutAgent = request.agent(app.getHttpServer());
    const loginResponse = await logoutAgent
      .post('/auth/login')
      .send({ email: loggedOutUser.email, password: PASSWORD })
      .expect(200);
    const activeCookie = accessCookie(loginResponse);
    await logoutAgent.post('/auth/logout').expect(204);

    await request(app.getHttpServer())
      .get(route)
      .set('Cookie', activeCookie)
      .expect(200);
  });

  async function createUser(email: string): Promise<User> {
    return usersRepository.save(
      usersRepository.create({
        email,
        emailNormalized: email.toLowerCase(),
        fullName: 'Synthetic Authorization User',
        status: UserStatus.ACTIVE,
        passwordHash: await hash(
          PASSWORD,
          appConfig.securityConfig.bcryptSaltRounds,
        ),
        passwordChangedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        emailVerifiedAt: null,
      }),
    );
  }

  async function createTenant(slug: string): Promise<Tenant> {
    return tenantsRepository.save(
      tenantsRepository.create({
        legalName: `Synthetic ${slug} LLC`,
        displayName: `Synthetic ${slug}`,
        slug,
        billingEmail: `${slug}@billing.test`,
        contactEmail: null,
        contactPhone: null,
        logoUrl: null,
        defaultLocale: 'vi',
        defaultTimezone: 'Asia/Ho_Chi_Minh',
        status: TenantStatus.ACTIVE,
      }),
    );
  }

  async function createBranch(tenant: Tenant, slug: string): Promise<Branch> {
    return branchesRepository.save(
      branchesRepository.create({
        tenantId: tenant.id,
        slug,
        name: `Synthetic ${tenant.slug} ${slug}`,
        address: '1 Synthetic Street',
        phone: '+84900000000',
        timezone: null,
        status: BranchStatus.ACTIVE,
      }),
    );
  }

  async function grantPlatform(
    user: User,
    roleCode: PlatformRoleCode,
  ): Promise<PlatformRoleAssignment> {
    return platformAssignmentsRepository.save(
      platformAssignmentsRepository.create({
        userId: user.id,
        roleCode,
        assignedByUserId: null,
        assignmentReason: null,
        revokedByUserId: null,
        revokedAt: null,
        revocationReason: null,
      }),
    );
  }

  async function grantTenant(
    user: User,
    tenant: Tenant,
    roleCode: TenantRoleCode.TENANT_ADMIN,
  ): Promise<RoleAssignment> {
    return roleAssignmentsRepository.save(
      roleAssignmentsRepository.create({
        userId: user.id,
        tenantId: tenant.id,
        branchId: null,
        roleCode,
        assignedByUserId: null,
        assignmentReason: null,
        revokedByUserId: null,
        revokedAt: null,
        revocationReason: null,
      }),
    );
  }

  async function grantBranch(
    user: User,
    tenant: Tenant,
    branch: Branch,
    roleCode: Exclude<TenantRoleCode, TenantRoleCode.TENANT_ADMIN>,
  ): Promise<RoleAssignment> {
    return roleAssignmentsRepository.save(
      roleAssignmentsRepository.create({
        userId: user.id,
        tenantId: tenant.id,
        branchId: branch.id,
        roleCode,
        assignedByUserId: null,
        assignmentReason: null,
        revokedByUserId: null,
        revokedAt: null,
        revocationReason: null,
      }),
    );
  }

  async function login(user: User): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    return accessCookie(response);
  }
});

function accessCookie(response: request.Response): string {
  const setCookies: unknown = response.headers['set-cookie'];
  if (!Array.isArray(setCookies)) {
    throw new Error('Access token cookie is missing.');
  }

  const cookie = setCookies.find(
    (value): value is string =>
      typeof value === 'string' && value.startsWith(`${ACCESS_TOKEN_COOKIE}=`),
  );
  if (!cookie) {
    throw new Error('Access token cookie is missing.');
  }

  return cookie.split(';', 1)[0];
}

function authorizationFixture(
  response: request.Response,
): AuthorizationFixtureResponse {
  return response.body as AuthorizationFixtureResponse;
}
