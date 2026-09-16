import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import { User } from 'src/modules/users/entities/user.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-profile-password';

describe('My profile (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    const config = app.get(AppConfigService);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds: config.securityConfig.bcryptSaltRounds,
    });
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('lets an authenticated user change only their own global profile and writes a safe audit record', async () => {
    const user = await authFixtures.createUser({
      email: 'profile-user@example.test',
      fullName: 'Before Synthetic Name',
    });
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });

    await request(app.getHttpServer() as Server)
      .patch('/users/me')
      .send({ fullName: 'Anonymous' })
      .expect(401);

    await session.agent
      .patch('/users/me')
      .send({ fullName: '  Updated Synthetic Name  ' })
      .expect(200)
      .expect({
        id: user.id,
        email: user.email,
        fullName: 'Updated Synthetic Name',
        avatarUrl: null,
      });

    await expect(
      dataSource.getRepository(User).findOneByOrFail({ id: user.id }),
    ).resolves.toMatchObject({
      fullName: 'Updated Synthetic Name',
      avatarObjectKey: null,
    });
    const audit = await dataSource.getRepository(AuditLog).findOneByOrFail({
      action: AuditAction.USER_PROFILE_UPDATED,
      resourceId: user.id,
    });
    expect(audit.after).toEqual({ changedFields: ['fullName'] });
    expect(JSON.stringify(audit)).not.toMatch(
      /updated synthetic name|avatar_object_key/i,
    );
  });

  it("does not allow a user to attach another user's temporary avatar key", async () => {
    const user = await authFixtures.createUser({
      email: 'profile-owner@example.test',
    });
    const otherUser = await authFixtures.createUser({
      email: 'profile-other@example.test',
    });
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });

    await session.agent
      .patch('/users/me')
      .send({
        fullName: user.fullName,
        avatarObjectKey: `temp/users/${otherUser.id}/avatar/00000000-0000-4000-8000-000000000001.png`,
      })
      .expect(400);
  });

  it('rejects a temporary key outside the avatar prefix', async () => {
    const user = await authFixtures.createUser({
      email: 'profile-invalid-prefix@example.test',
    });
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });

    await session.agent
      .patch('/users/me')
      .send({
        fullName: user.fullName,
        avatarObjectKey: `temp/users/${user.id}/other/00000000-0000-4000-8000-000000000001.png`,
      })
      .expect(400);
  });

  it('removes an existing avatar without exposing its object key', async () => {
    const user = await authFixtures.createUser({
      email: 'profile-remove-avatar@example.test',
    });
    await dataSource.getRepository(User).update(user.id, {
      avatarObjectKey: `avatars/users/${user.id}/00000000-0000-4000-8000-000000000001.png`,
    });
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });

    await session.agent
      .patch('/users/me')
      .send({ fullName: user.fullName, avatarObjectKey: null })
      .expect(200)
      .expect({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: null,
      });

    await expect(
      dataSource.getRepository(User).findOneByOrFail({ id: user.id }),
    ).resolves.toMatchObject({ avatarObjectKey: null });
    const audit = await dataSource.getRepository(AuditLog).findOneByOrFail({
      action: AuditAction.USER_PROFILE_UPDATED,
      resourceId: user.id,
    });
    expect(audit.after).toEqual({ changedFields: ['avatar'] });
    expect(JSON.stringify(audit)).not.toContain('avatars/users');
  });
});
