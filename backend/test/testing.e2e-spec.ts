import {
  ForbiddenException,
  INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppConfigService } from 'src/config/app-config.service';
import { AuthSession } from 'src/modules/auth/sessions/entities/auth-session.entity';
import { TestingGuard } from 'src/modules/testing/testing.guard';
import { User } from 'src/modules/users/entities/user.entity';
import { closeApp, initApp } from './app.setup';

const E2E_USER = {
  email: 'e2e.user@dentflow.test',
  password: 'synthetic-e2e-password',
};

describe('Testing database reset (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let sessionsRepository: Repository<AuthSession>;

  beforeAll(async () => {
    app = await initApp();
    const dataSource = app.get(DataSource);
    usersRepository = dataSource.getRepository(User);
    sessionsRepository = dataSource.getRepository(AuthSession);
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await closeApp();
  });

  it('resets data repeatedly and restores only the synthetic seed user', async () => {
    const server = app.getHttpServer();

    await request(server).get('/testing/reset-db').expect(200);
    await expectSeededUser();

    await request(server).post('/auth/login').send(E2E_USER).expect(200);
    expect(await sessionsRepository.count()).toBe(1);

    await request(server).get('/testing/reset-db').expect(200);
    await expectSeededUser();
    expect(await sessionsRepository.count()).toBe(0);
  });

  async function expectSeededUser(): Promise<void> {
    const users = await usersRepository.find();

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      email: E2E_USER.email,
      fullName: 'Synthetic E2E User',
    });
  }
});

describe('TestingGuard', () => {
  it('permits the testing endpoint in the test environment', () => {
    const guard = createGuard(true);

    expect(guard.canActivate({} as ExecutionContext)).toBe(true);
  });

  it('rejects the testing endpoint outside the test environment', () => {
    const guard = createGuard(false);

    expect(() => guard.canActivate({} as ExecutionContext)).toThrow(
      ForbiddenException,
    );
  });

  function createGuard(isTesting: boolean): TestingGuard {
    return new TestingGuard({
      runtimeConfig: { isTesting },
    } as AppConfigService);
  }
});
