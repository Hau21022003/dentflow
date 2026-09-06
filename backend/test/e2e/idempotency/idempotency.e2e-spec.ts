import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import {
  IdempotencyRecord,
  IdempotencyRecordStatus,
} from 'src/modules/idempotency/entities/idempotency-record.entity';
import { IdempotencyRecordRepository } from 'src/modules/idempotency/idempotency-record.repository';
import { IdempotencyService } from 'src/modules/idempotency/idempotency.service';
import { PlatformRoleCode } from 'src/modules/authorization/entities/platform-role-assignment.entity';
import { AppConfigService } from 'src/config/app-config.service';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-demo-password';

describe('Idempotency pilot for subscription plans (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auditLogs: Repository<AuditLog>;
  let records: Repository<IdempotencyRecord>;
  let idempotency: IdempotencyService;
  let idempotencyRecords: IdempotencyRecordRepository;
  let authFixtures: ReturnType<typeof createAuthFixtures>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    auditLogs = dataSource.getRepository(AuditLog);
    records = dataSource.getRepository(IdempotencyRecord);
    idempotency = app.get(IdempotencyService);
    idempotencyRecords = app.get(IdempotencyRecordRepository);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds:
        app.get(AppConfigService).securityConfig.bcryptSaltRounds,
    });
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('validates keys after guards without consuming a key for rejected callers', async () => {
    const { agent } = await createPlatformAdmin();
    await agent
      .post('/platform/plans')
      .send(planInput('missing-key'))
      .expect(422)
      .expect(({ body }) => {
        expectIdempotencyCode(body as unknown, 'idempotency_key_required');
      });
    await agent
      .post('/platform/plans')
      .set('Idempotency-Key', 'not-a-uuid')
      .send(planInput('invalid-key'))
      .expect(422)
      .expect(({ body }) => {
        expectIdempotencyCode(body as unknown, 'idempotency_key_invalid');
      });

    const key = randomUUID();
    await request(app.getHttpServer())
      .post('/platform/plans')
      .set('Idempotency-Key', key)
      .send(planInput('unauthenticated'))
      .expect(401);

    const regularUser = await authFixtures.createUser({
      email: 'idempotency-regular@example.test',
    });
    const regularAgent = await login(regularUser.email);
    await regularAgent
      .post('/platform/plans')
      .set('Idempotency-Key', key)
      .send(planInput('unauthorized'))
      .expect(403);

    await expect(records.count()).resolves.toBe(0);
  });

  it('replays a completed create without a second Plan or AuditLog', async () => {
    const { agent, user } = await createPlatformAdmin();
    const key = randomUUID();
    const requestId = randomUUID();
    const input = planInput('replayed-plan');

    const first = await agent
      .post('/platform/plans')
      .set('Idempotency-Key', key)
      .set('X-Request-Id', requestId)
      .send(input)
      .expect(201);
    const replay = await agent
      .post('/platform/plans')
      .set('Idempotency-Key', key)
      .send(input)
      .expect(201)
      .expect('Idempotency-Replayed', 'true');

    expect(replay.body).toEqual(first.body);
    await expect(
      dataSource.getRepository(IdempotencyRecord).findOneByOrFail({
        actorUserId: user.id,
        idempotencyKeyHash: idempotency.hashKey(key),
      }),
    ).resolves.toMatchObject({
      status: IdempotencyRecordStatus.COMPLETED,
      originalRequestId: requestId,
      responseBody: first.body as unknown,
    });
    await expect(
      auditLogs.count({ where: { action: AuditAction.PLAN_CREATED } }),
    ).resolves.toBe(1);
    await expect(
      dataSource.query('SELECT COUNT(*)::int AS count FROM subscription_plans'),
    ).resolves.toEqual([{ count: 1 }]);
  });

  it('rejects a changed request or operation for an existing key without exposing its outcome', async () => {
    const { agent } = await createPlatformAdmin();
    const key = randomUUID();
    const first = await agent
      .post('/platform/plans')
      .set('Idempotency-Key', key)
      .send(planInput('fingerprint-plan'))
      .expect(201);

    await agent
      .post('/platform/plans')
      .set('Idempotency-Key', key)
      .send(planInput('fingerprint-plan', { name: 'Changed payload' }))
      .expect(409)
      .expect(({ body }) => {
        expectIdempotencyCode(
          body as unknown,
          'idempotency_key_reused_with_different_request',
        );
        expect(body).not.toMatchObject(first.body);
      });
    const firstPlanId = planIdFromResponse(first.body as unknown);
    await agent
      .patch(`/platform/plans/${firstPlanId}`)
      .set('Idempotency-Key', key)
      .send({ name: 'A different operation' })
      .expect(409)
      .expect(({ body }) => {
        expectIdempotencyCode(
          body as unknown,
          'idempotency_key_reused_with_different_request',
        );
      });

    await expect(
      auditLogs.count({ where: { action: AuditAction.PLAN_CREATED } }),
    ).resolves.toBe(1);
  });

  it('allows only one concurrent command and releases a record after a handler error', async () => {
    const { agent } = await createPlatformAdmin();
    const key = randomUUID();
    const input = planInput('concurrent-plan');
    const [first, second] = await Promise.all([
      agent.post('/platform/plans').set('Idempotency-Key', key).send(input),
      agent.post('/platform/plans').set('Idempotency-Key', key).send(input),
    ]);

    expect(
      [first.status, second.status].every(
        (status) => status === 201 || status === 409,
      ),
    ).toBe(true);
    expect([first.status, second.status]).toContain(201);
    await expect(
      auditLogs.count({ where: { action: AuditAction.PLAN_CREATED } }),
    ).resolves.toBe(1);

    const failureKey = randomUUID();
    await agent
      .post('/platform/plans')
      .set('Idempotency-Key', failureKey)
      .send(planInput('concurrent-plan'))
      .expect(409);
    await expect(
      records.countBy({ idempotencyKeyHash: idempotency.hashKey(failureKey) }),
    ).resolves.toBe(0);
  });

  it('preserves a successful command when persisting its replay snapshot fails', async () => {
    const { agent } = await createPlatformAdmin();
    const key = randomUUID();
    const completeSpy = jest
      .spyOn(idempotency, 'complete')
      .mockRejectedValueOnce(new Error('snapshot persistence unavailable'));

    await agent
      .post('/platform/plans')
      .set('Idempotency-Key', key)
      .send(planInput('snapshot-failure-plan'))
      .expect(201);

    completeSpy.mockRestore();
    await expect(
      records.findOneByOrFail({ idempotencyKeyHash: idempotency.hashKey(key) }),
    ).resolves.toMatchObject({ status: IdempotencyRecordStatus.PROCESSING });
  });

  it('returns Retry-After while processing, reclaims expired leases, and purges expired completed records', async () => {
    const { agent, user } = await createPlatformAdmin();
    const key = randomUUID();
    const input = planInput('leased-plan');
    await seedProcessingRecord({
      userId: user.id,
      key,
      input,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    await agent
      .post('/platform/plans')
      .set('Idempotency-Key', key)
      .send(input)
      .expect(409)
      .expect('Retry-After', /\d+/)
      .expect(({ body }) => {
        expectIdempotencyCode(
          body as unknown,
          'idempotency_request_in_progress',
        );
      });

    const expiredKey = randomUUID();
    const expiredInput = planInput('expired-lease-plan');
    await seedProcessingRecord({
      userId: user.id,
      key: expiredKey,
      input: expiredInput,
      leaseExpiresAt: new Date(Date.now() - 1_000),
    });
    await agent
      .post('/platform/plans')
      .set('Idempotency-Key', expiredKey)
      .send(expiredInput)
      .expect(201);

    const completedClaim = await idempotencyRecords.claim({
      actorUserId: user.id,
      idempotencyKeyHash: idempotency.hashKey(randomUUID()),
      requestFingerprintHash: idempotency.fingerprint({
        operation: 'retention-test.v1',
        method: 'POST',
        params: {},
        query: {},
        body: {},
        authorizationContext: {
          actor: { userId: user.id, sessionId: randomUUID() },
          scope: 'platform',
        },
      }),
      processingToken: randomUUID(),
      processingLeaseExpiresAt: new Date(Date.now() + 60_000),
      originalRequestId: randomUUID(),
    });
    expect(completedClaim.kind).toBe('claimed');
    if (completedClaim.kind !== 'claimed')
      throw new Error('Expected record claim.');
    await idempotencyRecords.complete({
      recordId: completedClaim.recordId,
      processingToken: completedClaim.processingToken,
      httpStatus: 201,
      responseHasBody: true,
      responseBody: { id: 'synthetic' },
      responseHeaders: {},
      completedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 1_000),
    });
    await expect(idempotency.purgeExpiredCompleted()).resolves.toBe(1);
  });

  async function createPlatformAdmin() {
    const user = await authFixtures.createUser();
    await authFixtures.grantPlatformRole(user, PlatformRoleCode.PLATFORM_ADMIN);
    return { user, agent: await login(user.email) };
  }

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return agent;
  }

  async function seedProcessingRecord({
    userId,
    key,
    input,
    leaseExpiresAt,
  }: {
    userId: string;
    key: string;
    input: Record<string, unknown>;
    leaseExpiresAt: Date;
  }) {
    return idempotencyRecords.claim({
      actorUserId: userId,
      idempotencyKeyHash: idempotency.hashKey(key),
      requestFingerprintHash: idempotency.fingerprint({
        operation: 'platform.plan.create',
        method: 'POST',
        params: {},
        query: {},
        body: input,
        authorizationContext: {
          actor: { userId, sessionId: randomUUID() },
          scope: 'platform',
        },
      }),
      processingToken: randomUUID(),
      processingLeaseExpiresAt: leaseExpiresAt,
      originalRequestId: randomUUID(),
    });
  }
});

function planInput(
  code: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    code,
    name: 'Synthetic plan',
    billingInterval: 'MONTHLY',
    amount: 49_000,
    currency: 'VND',
    entitlements: { maxBranches: 1 },
    ...overrides,
  };
}

function expectIdempotencyCode(body: unknown, code: string): void {
  expect(body).toMatchObject({ code });
}

function planIdFromResponse(body: unknown): string {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    typeof body.id !== 'string'
  ) {
    throw new Error('Expected a subscription-plan response with an id.');
  }

  return body.id;
}
