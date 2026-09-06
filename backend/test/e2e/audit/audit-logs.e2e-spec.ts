import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLogService } from 'src/modules/audit/audit-log.service';
import {
  AuditActorType,
  AuditLog,
} from 'src/modules/audit/entities/audit-log.entity';
import { PlatformRoleCode } from 'src/modules/authorization/entities/platform-role-assignment.entity';
import { TenantRoleCode } from 'src/modules/authorization/entities/role-assignment.entity';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-audit-password';

interface AuditListItem {
  id: string;
}

interface AuditPageBody {
  items: AuditListItem[];
  nextCursor: string | null;
}

interface AuditDetailBody {
  after: Record<string, unknown> | null;
}

describe('Audit logs (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auditLogService: AuditLogService;
  let auditLogsRepository: Repository<AuditLog>;
  let authFixtures: ReturnType<typeof createAuthFixtures>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    auditLogService = app.get(AuditLogService);
    auditLogsRepository = dataSource.getRepository(AuditLog);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds: 12,
    });
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('scopes platform, tenant, and branch audit reads without exposing payload in lists', async () => {
    const platformAdmin = await authFixtures.createUser({
      email: 'platform-audit@example.test',
    });
    await authFixtures.grantPlatformRole(
      platformAdmin,
      PlatformRoleCode.PLATFORM_ADMIN,
    );
    const tenantAdmin = await authFixtures.createUser({
      email: 'tenant-audit@example.test',
    });
    const branchAdmin = await authFixtures.createUser({
      email: 'branch-audit@example.test',
    });
    const tenantBAdmin = await authFixtures.createUser({
      email: 'other-tenant-audit@example.test',
    });
    const { tenant: tenantA, branch: branchA } =
      await authFixtures.createTenantWithBranch({
        tenant: { slug: 'audit-tenant-a' },
        branch: { slug: 'audit-branch-a' },
      });
    const { tenant: tenantB, branch: branchB } =
      await authFixtures.createTenantWithBranch({
        tenant: { slug: 'audit-tenant-b' },
        branch: { slug: 'audit-branch-b' },
      });
    await authFixtures.grantTenantRole(
      tenantAdmin,
      tenantA,
      TenantRoleCode.TENANT_ADMIN,
    );
    await authFixtures.grantBranchRole(
      branchAdmin,
      branchA,
      TenantRoleCode.BRANCH_ADMIN,
    );
    await authFixtures.grantTenantRole(
      tenantBAdmin,
      tenantB,
      TenantRoleCode.TENANT_ADMIN,
    );

    const platformLog = await recordAudit({
      action: AuditAction.TENANT_SUSPENDED,
      actorUserId: platformAdmin.id,
      tenantId: tenantA.id,
      resourceId: tenantA.id,
      reason: 'Synthetic overdue account review',
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED' },
    });
    const branchLog = await recordAudit({
      action: AuditAction.BRANCH_UPDATED,
      actorUserId: tenantAdmin.id,
      tenantId: tenantA.id,
      branchId: branchA.id,
      resourceId: branchA.id,
      after: { status: 'ACTIVE' },
    });
    const clinicalLog = await recordAudit({
      action: AuditAction.PATIENT_ADMINISTRATIVE_UPDATED,
      actorUserId: branchAdmin.id,
      tenantId: tenantA.id,
      branchId: branchA.id,
      resourceId: randomUUID(),
      metadata: { changedFields: ['dateOfBirth'] },
    });
    const otherTenantLog = await recordAudit({
      action: AuditAction.BRANCH_UPDATED,
      actorUserId: tenantBAdmin.id,
      tenantId: tenantB.id,
      branchId: branchB.id,
      resourceId: branchB.id,
      after: { status: 'ACTIVE' },
    });

    const platformSession = await loginAs(app, {
      email: platformAdmin.email,
      password: PASSWORD,
    });
    const tenantSession = await loginAs(app, {
      email: tenantAdmin.email,
      password: PASSWORD,
    });
    const branchSession = await loginAs(app, {
      email: branchAdmin.email,
      password: PASSWORD,
    });

    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/platform/audit-logs')
      .expect(401);

    const platformResponse = await platformSession.agent
      .get('/platform/audit-logs')
      .expect(200);
    const platformPage = auditPage(platformResponse);
    expect(platformPage.items.map((item) => item.id)).toEqual([platformLog.id]);
    expect(platformPage.items[0]).not.toHaveProperty('before');
    expect(platformPage.items[0]).not.toHaveProperty('metadata');

    const platformDetail = await platformSession.agent
      .get(`/platform/audit-logs/${platformLog.id}`)
      .expect(200);
    expect(auditDetail(platformDetail).after).toEqual({ status: 'SUSPENDED' });
    await platformSession.agent
      .get(`/platform/audit-logs/${clinicalLog.id}`)
      .expect(404);

    const tenantResponse = await tenantSession.agent
      .get(`/tenants/${tenantA.slug}/audit-logs`)
      .set('X-Request-Id', '00000000-0000-4000-8000-000000000123')
      .expect(200);
    expect(tenantResponse.headers['x-request-id']).toBe(
      '00000000-0000-4000-8000-000000000123',
    );
    const tenantPage = auditPage(tenantResponse);
    expect(tenantPage.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([platformLog.id, branchLog.id, clinicalLog.id]),
    );
    expect(tenantPage.items.map((item) => item.id)).not.toContain(
      otherTenantLog.id,
    );
    await tenantSession.agent
      .get(`/tenants/${tenantB.slug}/audit-logs`)
      .expect(403);
    await tenantSession.agent
      .get(`/tenants/${tenantA.slug}/audit-logs/${otherTenantLog.id}`)
      .expect(404);

    const branchResponse = await branchSession.agent
      .get(`/tenants/${tenantA.slug}/branches/${branchA.slug}/audit-logs`)
      .expect(200);
    const branchPage = auditPage(branchResponse);
    expect(branchPage.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([branchLog.id, clinicalLog.id]),
    );
    expect(branchPage.items.map((item) => item.id)).not.toContain(
      platformLog.id,
    );
  });

  it('uses a stable cursor and keeps records immutable and transaction-bound', async () => {
    const user = await authFixtures.createUser({
      email: 'cursor-audit@example.test',
    });
    const { tenant, branch } = await authFixtures.createTenantWithBranch({
      tenant: { slug: 'cursor-audit-tenant' },
      branch: { slug: 'cursor-audit-branch' },
    });
    await authFixtures.grantTenantRole(
      user,
      tenant,
      TenantRoleCode.TENANT_ADMIN,
    );
    const older = await recordAudit({
      action: AuditAction.BRANCH_UPDATED,
      actorUserId: user.id,
      tenantId: tenant.id,
      branchId: branch.id,
      resourceId: branch.id,
      after: { status: 'ACTIVE' },
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const newer = await recordAudit({
      action: AuditAction.BRANCH_UPDATED,
      actorUserId: user.id,
      tenantId: tenant.id,
      branchId: branch.id,
      resourceId: branch.id,
      after: { status: 'INACTIVE' },
      occurredAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    const baseUrl = `/tenants/${tenant.slug}/audit-logs`;

    const firstPage = await session.agent.get(`${baseUrl}?limit=1`).expect(200);
    const firstPageBody = auditPage(firstPage);
    expect(firstPageBody.items[0].id).toBe(newer.id);
    expect(firstPageBody.nextCursor).toEqual(expect.any(String));

    const secondPage = await session.agent
      .get(
        `${baseUrl}?limit=1&cursor=${encodeURIComponent(firstPageBody.nextCursor!)}`,
      )
      .expect(200);
    expect(auditPage(secondPage).items[0].id).toBe(older.id);

    await expect(
      dataSource.query('UPDATE audit_logs SET action = $1 WHERE id = $2', [
        'TAMPERED',
        newer.id,
      ]),
    ).rejects.toThrow('append-only');
    await expect(
      dataSource.transaction(async (manager) => {
        await auditLogService.record(manager, {
          action: AuditAction.BRANCH_UPDATED,
          actor: { type: AuditActorType.USER, userId: user.id },
          tenantId: tenant.id,
          branchId: branch.id,
          resourceId: branch.id,
          after: { status: 'ACTIVE' },
        });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');
    expect(
      await auditLogsRepository.countBy({
        tenantId: tenant.id,
      }),
    ).toBe(2);
  });

  it('rejects a branch from another tenant through the composite foreign key', async () => {
    const user = await authFixtures.createUser({
      email: 'cross-tenant-audit@example.test',
    });
    const { tenant: tenantA } = await authFixtures.createTenantWithBranch({
      tenant: { slug: 'cross-audit-a' },
      branch: { slug: 'cross-audit-branch-a' },
    });
    const { branch: branchB } = await authFixtures.createTenantWithBranch({
      tenant: { slug: 'cross-audit-b' },
      branch: { slug: 'cross-audit-branch-b' },
    });

    await expect(
      auditLogService.record(dataSource.manager, {
        action: AuditAction.BRANCH_UPDATED,
        actor: { type: AuditActorType.USER, userId: user.id },
        tenantId: tenantA.id,
        branchId: branchB.id,
        resourceId: branchB.id,
        after: { status: 'ACTIVE' },
      }),
    ).rejects.toThrow();
  });

  async function recordAudit({
    action,
    actorUserId,
    tenantId,
    branchId,
    resourceId,
    reason,
    before,
    after,
    metadata,
    occurredAt,
  }: {
    action: AuditAction;
    actorUserId: string;
    tenantId: string;
    branchId?: string;
    resourceId: string;
    reason?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
  }): Promise<AuditLog> {
    return auditLogService.record(dataSource.manager, {
      action,
      actor: { type: AuditActorType.USER, userId: actorUserId },
      tenantId,
      branchId,
      resourceId,
      reason,
      before,
      after,
      metadata,
      occurredAt,
    });
  }

  function auditPage(response: request.Response): AuditPageBody {
    return response.body as AuditPageBody;
  }

  function auditDetail(response: request.Response): AuditDetailBody {
    return response.body as AuditDetailBody;
  }
});
