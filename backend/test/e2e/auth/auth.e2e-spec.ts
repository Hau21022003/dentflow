import { INestApplication } from '@nestjs/common';
import { compare } from 'src/common/utils/hash.util';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from 'src/modules/auth/auth.constants';
import { AuthSession } from 'src/modules/auth/sessions/entities/auth-session.entity';
import { PlatformRoleCode } from 'src/modules/authorization/entities/platform-role-assignment.entity';
import { TenantRoleCode } from 'src/modules/authorization/entities/role-assignment.entity';
import { BranchStatus } from 'src/modules/branches/entities/branch.entity';
import { TenantStatus } from 'src/modules/tenants/entities/tenant.entity';
import { User, UserStatus } from 'src/modules/users/entities/user.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import {
  cookiePair,
  cookieValue,
  findSetCookie,
} from 'test/helpers/cookie.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-demo-password';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<User>;
  let sessionsRepository: Repository<AuthSession>;
  let auditLogsRepository: Repository<AuditLog>;
  let appConfig: AppConfigService;
  let authFixtures: ReturnType<typeof createAuthFixtures>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    usersRepository = dataSource.getRepository(User);
    sessionsRepository = dataSource.getRepository(AuthSession);
    auditLogsRepository = dataSource.getRepository(AuditLog);
    appConfig = app.get(AppConfigService);
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

  it('logs in a synthetic active user and stores only hashed refresh state', async () => {
    const user = await authFixtures.createUser();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email.toUpperCase(), password: PASSWORD })
      .expect(200);

    expect(response.body).toEqual({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: null,
        authorization: emptyAuthorization(),
      },
    });
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('refreshToken');

    const accessSetCookie = findSetCookie(response, ACCESS_TOKEN_COOKIE);
    const refreshSetCookie = findSetCookie(response, REFRESH_TOKEN_COOKIE);
    expect(accessSetCookie).toContain('HttpOnly');
    expect(accessSetCookie).toContain('SameSite=Lax');
    expect(accessSetCookie).toContain('Path=/');
    expect(refreshSetCookie).toContain('HttpOnly');
    expect(refreshSetCookie).toContain('SameSite=Lax');
    expect(refreshSetCookie).toContain('Path=/auth');

    const session = await sessionsRepository
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .where('session.userId = :userId', { userId: user.id })
      .getOneOrFail();
    const rawRefreshToken = cookieValue(refreshSetCookie, REFRESH_TOKEN_COOKIE);

    expect(session.refreshTokenHash).not.toBe(rawRefreshToken);
    await expect(
      compare(rawRefreshToken, session.refreshTokenHash),
    ).resolves.toBe(true);
  });

  it('returns the active authenticated user from the access-token cookie', async () => {
    const user = await authFixtures.createUser();
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
          avatarUrl: null,
          authorization: emptyAuthorization(),
        },
      });

    await usersRepository.update(user.id, { status: UserStatus.DISABLED });
    await agent.get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('returns the same active, scoped authorization snapshot from login, refresh, and me', async () => {
    const user = await authFixtures.createUser();
    const { tenant, branch } = await authFixtures.createTenantWithBranch({
      tenant: {
        legalName: 'Synthetic Dental Group LLC',
        displayName: 'Synthetic Dental Group',
        slug: 'synthetic-dental-group',
        billingEmail: 'billing@synthetic.test',
        status: TenantStatus.SUSPENDED,
      },
      branch: {
        slug: 'synthetic-district-1',
        name: 'Synthetic District 1',
        address: '1 Synthetic Street',
        phone: '+84900000001',
        status: BranchStatus.INACTIVE,
      },
    });

    await authFixtures.grantPlatformRole(user, PlatformRoleCode.PLATFORM_ADMIN);
    await authFixtures.grantTenantRole(
      user,
      tenant,
      TenantRoleCode.TENANT_ADMIN,
    );
    await authFixtures.grantBranchRole(
      user,
      branch,
      TenantRoleCode.RECEPTIONIST,
    );
    await authFixtures.grantBranchRole(user, branch, TenantRoleCode.DENTIST);
    await authFixtures.grantBranchRole(
      user,
      branch,
      TenantRoleCode.BRANCH_ADMIN,
      {
        assignmentReason: 'Synthetic revoked grant',
        revokedBy: user,
        revokedAt: new Date(),
        revocationReason: 'Synthetic test revocation',
      },
    );

    const expectedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: null,
      authorization: {
        platform: {
          roles: [PlatformRoleCode.PLATFORM_ADMIN],
          permissions: [
            'platform.audit-log.read',
            'platform.email-template.manage',
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
              'file.upload',
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
                  'file.upload',
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
    const user = await authFixtures.createUser();
    const disabledUser = await authFixtures.createUser({
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
      const loginRequest = request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'wrong-password' });
      if (attempt === appConfig.securityConfig.maxLoginAttempts - 1) {
        loginRequest.set(
          'X-Request-Id',
          '00000000-0000-4000-8000-000000000456',
        );
      }
      await loginRequest.expect(401);
    }

    let lockedUser = await usersRepository.findOneByOrFail({ id: user.id });
    expect(lockedUser.failedLoginAttempts).toBe(
      appConfig.securityConfig.maxLoginAttempts,
    );
    expect(lockedUser.lockedUntil).not.toBeNull();
    const accountLockAudit = await auditLogsRepository.findOneByOrFail({
      action: AuditAction.AUTH_ACCOUNT_LOCKED,
      resourceId: user.id,
    });
    expect(accountLockAudit.actorUserId).toBeNull();
    expect(accountLockAudit.requestId).toBe(
      '00000000-0000-4000-8000-000000000456',
    );
    expect(accountLockAudit.metadata).toEqual({
      reasonCode: 'MAX_FAILED_LOGIN_ATTEMPTS',
    });

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
    const user = await authFixtures.createUser();
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const originalRefreshSetCookie = findSetCookie(
      loginResponse,
      REFRESH_TOKEN_COOKIE,
    );
    const originalRefreshCookie = cookiePair(originalRefreshSetCookie);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalRefreshCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalRefreshCookie)
      .expect(401);

    const newRefreshSetCookie = findSetCookie(
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200),
      REFRESH_TOKEN_COOKIE,
    );
    const newRefreshCookie = cookiePair(newRefreshSetCookie);
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
    const user = await authFixtures.createUser();
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
});

function emptyAuthorization() {
  return {
    platform: {
      roles: [],
      permissions: [],
    },
    tenants: [],
  };
}
