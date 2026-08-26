import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { compare, hash } from 'src/common/utils/hash.util';
import { AppConfigService } from 'src/config/app-config.service';
import {
  PlatformRoleAssignment,
  PlatformRoleCode,
} from 'src/modules/authorization/entities/platform-role-assignment.entity';
import {
  RoleAssignment,
  TenantRoleCode,
} from 'src/modules/authorization/entities/role-assignment.entity';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from 'src/modules/auth/auth.constants';
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
import { closeApp, initApp } from './app.setup';

const PASSWORD = 'synthetic-demo-password';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<User>;
  let sessionsRepository: Repository<AuthSession>;
  let tenantsRepository: Repository<Tenant>;
  let branchesRepository: Repository<Branch>;
  let platformRoleAssignmentsRepository: Repository<PlatformRoleAssignment>;
  let roleAssignmentsRepository: Repository<RoleAssignment>;
  let appConfig: AppConfigService;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    usersRepository = dataSource.getRepository(User);
    sessionsRepository = dataSource.getRepository(AuthSession);
    tenantsRepository = dataSource.getRepository(Tenant);
    branchesRepository = dataSource.getRepository(Branch);
    platformRoleAssignmentsRepository = dataSource.getRepository(
      PlatformRoleAssignment,
    );
    roleAssignmentsRepository = dataSource.getRepository(RoleAssignment);
    appConfig = app.get(AppConfigService);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await sessionsRepository.createQueryBuilder().delete().execute();
    await roleAssignmentsRepository.createQueryBuilder().delete().execute();
    await platformRoleAssignmentsRepository
      .createQueryBuilder()
      .delete()
      .execute();
    await branchesRepository.createQueryBuilder().delete().execute();
    await tenantsRepository.createQueryBuilder().delete().execute();
    await usersRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    await closeApp();
  });

  it('logs in a synthetic active user and stores only hashed refresh state', async () => {
    const user = await createUser();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email.toUpperCase(), password: PASSWORD })
      .expect(200);

    expect(response.body).toEqual({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        authorization: emptyAuthorization(),
      },
    });
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('refreshToken');

    const accessCookie = findSetCookie(response, ACCESS_TOKEN_COOKIE);
    const refreshCookie = findSetCookie(response, REFRESH_TOKEN_COOKIE);
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('SameSite=Lax');
    expect(accessCookie).toContain('Path=/');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Lax');
    expect(refreshCookie).toContain('Path=/auth');

    const session = await sessionsRepository
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .where('session.userId = :userId', { userId: user.id })
      .getOneOrFail();
    const rawRefreshToken = cookieValue(refreshCookie, REFRESH_TOKEN_COOKIE);

    expect(session.refreshTokenHash).not.toBe(rawRefreshToken);
    await expect(
      compare(rawRefreshToken, session.refreshTokenHash),
    ).resolves.toBe(true);
  });

  it('returns the active authenticated user from the access-token cookie', async () => {
    const user = await createUser();
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    await agent
      .get('/auth/me')
      .expect(200)
      .expect({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          authorization: emptyAuthorization(),
        },
      });

    await usersRepository.update(user.id, { status: UserStatus.DISABLED });
    await agent.get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('returns the same active, scoped authorization snapshot from login, refresh, and me', async () => {
    const user = await createUser();
    const tenant = await tenantsRepository.save(
      tenantsRepository.create({
        legalName: 'Synthetic Dental Group LLC',
        displayName: 'Synthetic Dental Group',
        slug: 'synthetic-dental-group',
        billingEmail: 'billing@synthetic.test',
        contactEmail: null,
        contactPhone: null,
        logoUrl: null,
        defaultLocale: 'vi',
        defaultTimezone: 'Asia/Ho_Chi_Minh',
        status: TenantStatus.SUSPENDED,
      }),
    );
    const branch = await branchesRepository.save(
      branchesRepository.create({
        tenantId: tenant.id,
        slug: 'synthetic-district-1',
        name: 'Synthetic District 1',
        address: '1 Synthetic Street',
        phone: '+84900000001',
        timezone: null,
        status: BranchStatus.INACTIVE,
      }),
    );

    await platformRoleAssignmentsRepository.save(
      platformRoleAssignmentsRepository.create({
        userId: user.id,
        roleCode: PlatformRoleCode.PLATFORM_ADMIN,
        assignedByUserId: null,
        assignmentReason: null,
        revokedByUserId: null,
        revokedAt: null,
        revocationReason: null,
      }),
    );
    await roleAssignmentsRepository.save([
      roleAssignmentsRepository.create({
        userId: user.id,
        tenantId: tenant.id,
        branchId: null,
        roleCode: TenantRoleCode.TENANT_ADMIN,
        assignedByUserId: null,
        assignmentReason: null,
        revokedByUserId: null,
        revokedAt: null,
        revocationReason: null,
      }),
      roleAssignmentsRepository.create({
        userId: user.id,
        tenantId: tenant.id,
        branchId: branch.id,
        roleCode: TenantRoleCode.RECEPTIONIST,
        assignedByUserId: null,
        assignmentReason: null,
        revokedByUserId: null,
        revokedAt: null,
        revocationReason: null,
      }),
      roleAssignmentsRepository.create({
        userId: user.id,
        tenantId: tenant.id,
        branchId: branch.id,
        roleCode: TenantRoleCode.DENTIST,
        assignedByUserId: null,
        assignmentReason: null,
        revokedByUserId: null,
        revokedAt: null,
        revocationReason: null,
      }),
      roleAssignmentsRepository.create({
        userId: user.id,
        tenantId: tenant.id,
        branchId: branch.id,
        roleCode: TenantRoleCode.BRANCH_ADMIN,
        assignedByUserId: null,
        assignmentReason: 'Synthetic revoked grant',
        revokedByUserId: user.id,
        revokedAt: new Date(),
        revocationReason: 'Synthetic test revocation',
      }),
    ]);

    const expectedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      authorization: {
        platform: {
          roles: [PlatformRoleCode.PLATFORM_ADMIN],
          permissions: [
            'platform.audit-log.read',
            'platform.plan.manage',
            'platform.saas-billing.read',
            'platform.support.manage',
            'platform.system.read',
            'platform.tenant.manage',
          ],
        },
        tenants: [
          {
            tenant: {
              id: tenant.id,
              slug: tenant.slug,
              displayName: tenant.displayName,
              status: TenantStatus.SUSPENDED,
            },
            roles: [TenantRoleCode.TENANT_ADMIN],
            permissions: [
              'audit-log.read',
              'branch.manage',
              'notification-settings.manage',
              'report.read',
              'saas-billing.manage',
              'service-catalog.manage',
              'staff.manage',
              'tenant.settings.manage',
            ],
            branches: [
              {
                branch: {
                  id: branch.id,
                  slug: branch.slug,
                  name: branch.name,
                  status: BranchStatus.INACTIVE,
                },
                roles: [TenantRoleCode.DENTIST, TenantRoleCode.RECEPTIONIST],
                permissions: [
                  'appointment.assigned.read',
                  'appointment.manage',
                  'clinical.visit.write',
                  'follow-up.recommend',
                  'patient-invoice.create',
                  'patient-payment.record',
                  'patient.administrative.manage',
                  'treatment-item.complete',
                  'treatment-plan.write',
                ],
              },
            ],
          },
        ],
      },
    };
    const agent = request.agent(app.getHttpServer());

    const loginResponse = await agent
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    expect(loginResponse.body).toEqual({ user: expectedUser });

    await agent.get('/auth/me').expect(200).expect({ user: expectedUser });
    await agent
      .post('/auth/refresh')
      .expect(200)
      .expect({ user: expectedUser });
    expect(JSON.stringify(loginResponse.body)).not.toMatch(
      /assignedBy|assignedAt|assignmentReason|revoked|reason/i,
    );
  });

  it('rejects invalid and disabled logins, locks repeated failures, and resets a recovered account', async () => {
    const user = await createUser();
    const disabledUser = await createUser({
      email: 'disabled-user@example.test',
      status: UserStatus.DISABLED,
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'wrong-password' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: disabledUser.email, password: PASSWORD })
      .expect(401);

    for (
      let attempt = 1;
      attempt < appConfig.securityConfig.maxLoginAttempts;
      attempt += 1
    ) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'wrong-password' })
        .expect(401);
    }

    let lockedUser = await usersRepository.findOneByOrFail({ id: user.id });
    expect(lockedUser.failedLoginAttempts).toBe(
      appConfig.securityConfig.maxLoginAttempts,
    );
    expect(lockedUser.lockedUntil).not.toBeNull();

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(401);

    lockedUser.lockedUntil = new Date(Date.now() - 1_000);
    await usersRepository.save(lockedUser);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    lockedUser = await usersRepository.findOneByOrFail({ id: user.id });
    expect(lockedUser.failedLoginAttempts).toBe(0);
    expect(lockedUser.lockedUntil).toBeNull();
    expect(lockedUser.lastLoginAt).not.toBeNull();
  });

  it('rotates refresh tokens and rejects tampered, stale, expired, and missing cookies', async () => {
    const user = await createUser();
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const originalRefreshCookie = findSetCookie(
      loginResponse,
      REFRESH_TOKEN_COOKIE,
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalRefreshCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalRefreshCookie)
      .expect(401);

    const newRefreshCookie = findSetCookie(
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200),
      REFRESH_TOKEN_COOKIE,
    );
    const tamperedRefreshCookie = `${REFRESH_TOKEN_COOKIE}=${cookieValue(
      newRefreshCookie,
      REFRESH_TOKEN_COOKIE,
    )}x`;
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', tamperedRefreshCookie)
      .expect(401);
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);

    const expiredAt = new Date(Date.now() - 1_000);
    await sessionsRepository
      .createQueryBuilder()
      .update(AuthSession)
      .set({ expiresAt: expiredAt })
      .where('userId = :userId', { userId: user.id })
      .execute();
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set(
        'Cookie',
        `${REFRESH_TOKEN_COOKIE}=${cookieValue(
          newRefreshCookie,
          REFRESH_TOKEN_COOKIE,
        )}`,
      )
      .expect(401);
  });

  it('logs out only the current device session and clears both cookies', async () => {
    const user = await createUser();
    const deviceOne = request.agent(app.getHttpServer());
    const deviceTwo = request.agent(app.getHttpServer());

    await deviceOne
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    await deviceTwo
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    const logoutResponse = await deviceOne.post('/auth/logout').expect(204);
    expect(findSetCookie(logoutResponse, ACCESS_TOKEN_COOKIE)).toContain(
      'Path=/',
    );
    expect(findSetCookie(logoutResponse, REFRESH_TOKEN_COOKIE)).toContain(
      'Path=/auth',
    );

    await deviceOne.post('/auth/refresh').expect(401);
    await deviceTwo.post('/auth/refresh').expect(200);
  });

  it('allows credentialed CORS only from the configured frontend origin', async () => {
    const origin = appConfig.corsConfig.frontendOrigin;
    const allowedResponse = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(allowedResponse.headers['access-control-allow-origin']).toBe(origin);
    expect(allowedResponse.headers['access-control-allow-credentials']).toBe(
      'true',
    );

    const deniedResponse = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'https://untrusted.example.test')
      .set('Access-Control-Request-Method', 'POST');
    expect(
      deniedResponse.headers['access-control-allow-origin'],
    ).toBeUndefined();
  });

  async function createUser(
    overrides: Partial<Pick<User, 'email' | 'fullName' | 'status'>> = {},
  ): Promise<User> {
    const email = overrides.email ?? 'active-user@example.test';

    return usersRepository.save(
      usersRepository.create({
        email,
        emailNormalized: email.toLowerCase(),
        fullName: overrides.fullName ?? 'Synthetic User',
        status: overrides.status ?? UserStatus.ACTIVE,
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
});

function findSetCookie(response: request.Response, name: string): string {
  const setCookies: unknown = response.headers['set-cookie'];
  if (!Array.isArray(setCookies)) {
    throw new Error(`Missing ${name} cookie.`);
  }

  const cookie = setCookies.find(
    (value): value is string =>
      typeof value === 'string' && value.startsWith(`${name}=`),
  );

  if (!cookie) {
    throw new Error(`Missing ${name} cookie.`);
  }

  return cookie;
}

function cookieValue(cookie: string, name: string): string {
  return cookie.slice(`${name}=`.length).split(';', 1)[0];
}

function emptyAuthorization() {
  return {
    platform: {
      roles: [],
      permissions: [],
    },
    tenants: [],
  };
}
