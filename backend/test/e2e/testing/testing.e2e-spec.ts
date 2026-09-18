import { ForbiddenException, INestApplication } from '@nestjs/common';
import { AppConfigService } from 'src/config/app-config.service';
import { AuthSession } from 'src/modules/auth/sessions/entities/auth-session.entity';
import {
  PlatformRoleAssignment,
  PlatformRoleCode,
} from 'src/modules/authorization/entities/platform-role-assignment.entity';
import {
  RoleAssignment,
  TenantRoleCode,
} from 'src/modules/authorization/entities/role-assignment.entity';
import { Branch } from 'src/modules/branches/entities/branch.entity';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { TestingGuard } from 'src/modules/testing/testing.guard';
import { User } from 'src/modules/users/entities/user.entity';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const E2E_USER = {
  email: 'e2e.user@dentflow.test',
  password: '12345',
};

describe('Testing database reset (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let sessionsRepository: Repository<AuthSession>;
  let tenantsRepository: Repository<Tenant>;
  let branchesRepository: Repository<Branch>;
  let platformRoleAssignmentsRepository: Repository<PlatformRoleAssignment>;
  let roleAssignmentsRepository: Repository<RoleAssignment>;

  beforeAll(async () => {
    app = (await initApp()) as INestApplication<App>;
    const dataSource = app.get(DataSource);
    usersRepository = dataSource.getRepository(User);
    sessionsRepository = dataSource.getRepository(AuthSession);
    tenantsRepository = dataSource.getRepository(Tenant);
    branchesRepository = dataSource.getRepository(Branch);
    platformRoleAssignmentsRepository = dataSource.getRepository(
      PlatformRoleAssignment,
    );
    roleAssignmentsRepository = dataSource.getRepository(RoleAssignment);
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await closeApp();
  });

  it('resets data repeatedly and restores the synthetic authorization fixtures', async () => {
    const server = app.getHttpServer();

    await request(server).get('/testing/reset-db').expect(200);
    await expectSeededFixtures();

    await request(server).post('/auth/login').send(E2E_USER).expect(200);
    expect(await sessionsRepository.count()).toBe(1);

    await request(server).get('/testing/reset-db').expect(200);
    await expectSeededFixtures();
    expect(await sessionsRepository.count()).toBe(0);
  });

  async function expectSeededFixtures(): Promise<void> {
    const users = await usersRepository.find();

    expect(users).toHaveLength(5);
    expect(users.find((user) => user.email === E2E_USER.email)).toMatchObject({
      email: E2E_USER.email,
      fullName: 'Synthetic E2E Tenant Admin',
    });
    expect(await tenantsRepository.count()).toBe(2);
    expect(await branchesRepository.count()).toBe(3);
    expect(await platformRoleAssignmentsRepository.count()).toBe(1);
    expect(await roleAssignmentsRepository.count()).toBe(7);

    const platformAssignments = await platformRoleAssignmentsRepository.find();
    const tenantAssignments = await roleAssignmentsRepository.find();

    expect(platformAssignments.map(({ roleCode }) => roleCode)).toEqual([
      PlatformRoleCode.PLATFORM_ADMIN,
    ]);
    expect(tenantAssignments.map(({ roleCode }) => roleCode).sort()).toEqual([
      TenantRoleCode.BRANCH_ADMIN,
      TenantRoleCode.BRANCH_ADMIN,
      TenantRoleCode.DENTIST,
      TenantRoleCode.RECEPTIONIST,
      TenantRoleCode.RECEPTIONIST,
      TenantRoleCode.TENANT_ADMIN,
      TenantRoleCode.TENANT_ADMIN,
    ]);
    expect(
      tenantAssignments.find(
        ({ roleCode }) => roleCode === TenantRoleCode.TENANT_ADMIN,
      ),
    ).toMatchObject({ branchId: null });
  }
});

describe('TestingGuard', () => {
  it('permits the testing endpoint in the test environment', () => {
    const guard = createGuard(true);

    expect(guard.canActivate({})).toBe(true);
  });

  it('rejects the testing endpoint outside the test environment', () => {
    const guard = createGuard(false);

    expect(() => guard.canActivate({})).toThrow(ForbiddenException);
  });

  function createGuard(isTesting: boolean): TestingGuard {
    return new TestingGuard({
      runtimeConfig: { isTesting },
    } as AppConfigService);
  }
});
