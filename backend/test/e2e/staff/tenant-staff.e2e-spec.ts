import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import {
  RoleAssignment,
  TenantRoleCode,
} from 'src/modules/authorization/entities/role-assignment.entity';
import {
  Branch,
  BranchStatus,
} from 'src/modules/branches/entities/branch.entity';
import {
  StaffInvitation,
  StaffInvitationStatus,
} from 'src/modules/staff/entities/staff-invitation.entity';
import {
  TenantUserMembership,
  TenantUserMembershipStatus,
} from 'src/modules/staff/entities/tenant-user-membership.entity';
import { StaffInvitationTokenService } from 'src/modules/staff/staff-invitation-token.service';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { DataSource, IsNull, Repository } from 'typeorm';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-tenant-staff-password';

describe('Tenant staff management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;
  let memberships: Repository<TenantUserMembership>;
  let invitations: Repository<StaffInvitation>;
  let roleAssignments: Repository<RoleAssignment>;
  let tokenService: StaffInvitationTokenService;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    const appConfig = app.get(AppConfigService);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds: appConfig.securityConfig.bcryptSaltRounds,
    });
    memberships = dataSource.getRepository(TenantUserMembership);
    invitations = dataSource.getRepository(StaffInvitation);
    roleAssignments = dataSource.getRepository(RoleAssignment);
    tokenService = app.get(StaffInvitationTokenService);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('keeps an existing global User outside the tenant until they accept the invitation', async () => {
    const { tenant, agent } = await createTenantAdmin('staff-invite-a');
    const branch = await authFixtures.createBranch(tenant, {
      slug: 'staff-q1',
    });
    const invitedUser = await authFixtures.createUser({
      email: 'existing-staff@tenant-staff.test',
      fullName: 'Existing Synthetic Staff',
    });
    const invitedSession = await loginAs(app, {
      email: invitedUser.email,
      password: PASSWORD,
    });
    const route = `/tenants/${tenant.slug}/staff/invitations`;

    const createResponse = await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({
        email: invitedUser.email,
        fullName: invitedUser.fullName,
        assignments: [
          {
            roleCode: TenantRoleCode.RECEPTIONIST,
            branchSlugs: [branch.slug],
          },
        ],
      })
      .expect(201);
    const invitationId = (createResponse.body as { id: string }).id;

    await expect(
      memberships.count({
        where: { tenantId: tenant.id, userId: invitedUser.id },
      }),
    ).resolves.toBe(0);
    await expect(
      roleAssignments.count({
        where: { tenantId: tenant.id, userId: invitedUser.id },
      }),
    ).resolves.toBe(0);
    await invitedSession.agent
      .get('/auth/me')
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as {
          user: { authorization: { tenants: unknown[] } };
        };
        const authorization = body.user.authorization;
        expect(authorization.tenants).toEqual([]);
      });

    const invitation = await invitations.findOneByOrFail({ id: invitationId });
    await invitedSession.agent
      .post('/auth/staff-invitations/accept')
      .send({ token: tokenService.createToken(invitation) })
      .expect(200);

    await expect(
      memberships.findOneByOrFail({
        tenantId: tenant.id,
        userId: invitedUser.id,
      }),
    ).resolves.toMatchObject({ status: TenantUserMembershipStatus.ACTIVE });
    await expect(
      roleAssignments.findOneByOrFail({
        tenantId: tenant.id,
        userId: invitedUser.id,
        branchId: branch.id,
        roleCode: TenantRoleCode.RECEPTIONIST,
      }),
    ).resolves.toBeDefined();
    await invitedSession.agent
      .get('/auth/me')
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as {
          user: {
            authorization: { tenants: Array<{ tenant: { id: string } }> };
          };
        };
        const authorization = body.user.authorization;
        expect(
          authorization.tenants.map((access) => access.tenant.id),
        ).toContain(tenant.id);
      });
    await expect(
      invitations.findOneByOrFail({ id: invitationId }),
    ).resolves.toMatchObject({
      status: StaffInvitationStatus.ACCEPTED,
      acceptedByUserId: invitedUser.id,
    });
  });

  it('rejects cross-tenant branches and disables only the target tenant membership', async () => {
    const { tenant: tenantA, agent: tenantAdminAgent } =
      await createTenantAdmin('staff-isolation-a');
    const tenantB = await authFixtures.createTenant({
      slug: 'staff-isolation-b',
    });
    const branchA = await authFixtures.createBranch(tenantA, {
      slug: 'branch-a',
    });
    const branchB = await authFixtures.createBranch(tenantB, {
      slug: 'branch-b',
    });
    const member = await authFixtures.createUser({
      email: 'tenant-member@tenant-staff.test',
    });
    const branchAdmin = await authFixtures.createUser({
      email: 'branch-admin@tenant-staff.test',
    });
    await authFixtures.grantBranchRole(
      branchAdmin,
      branchA,
      TenantRoleCode.BRANCH_ADMIN,
    );
    await authFixtures.grantBranchRole(
      member,
      branchA,
      TenantRoleCode.RECEPTIONIST,
    );
    await authFixtures.grantTenantRole(
      member,
      tenantA,
      TenantRoleCode.TENANT_ADMIN,
    );
    await authFixtures.grantBranchRole(
      member,
      branchB,
      TenantRoleCode.RECEPTIONIST,
    );
    const memberSession = await loginAs(app, {
      email: member.email,
      password: PASSWORD,
    });
    const staffRoute = `/tenants/${tenantA.slug}/staff`;

    const branchAdminSession = await loginAs(app, {
      email: branchAdmin.email,
      password: PASSWORD,
    });
    await branchAdminSession.agent.get(staffRoute).expect(403);

    await tenantAdminAgent
      .post(`${staffRoute}/invitations`)
      .set('Idempotency-Key', randomUUID())
      .send({
        email: 'cross-tenant@tenant-staff.test',
        fullName: 'Cross Tenant Synthetic',
        assignments: [
          {
            roleCode: TenantRoleCode.RECEPTIONIST,
            branchSlugs: [branchB.slug],
          },
        ],
      })
      .expect(422);
    await expect(
      invitations.count({ where: { tenantId: tenantA.id } }),
    ).resolves.toBe(0);

    await tenantAdminAgent
      .post(`${staffRoute}/${member.id}/disable`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_LEAVE' })
      .expect(201);
    await expect(
      memberships.findOneByOrFail({ tenantId: tenantA.id, userId: member.id }),
    ).resolves.toMatchObject({ status: TenantUserMembershipStatus.DISABLED });
    await expect(
      memberships.findOneByOrFail({ tenantId: tenantB.id, userId: member.id }),
    ).resolves.toMatchObject({ status: TenantUserMembershipStatus.ACTIVE });
    await memberSession.agent
      .get('/auth/me')
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as {
          user: {
            authorization: { tenants: Array<{ tenant: { id: string } }> };
          };
        };
        const tenantIds = body.user.authorization.tenants.map(
          (access) => access.tenant.id,
        );
        expect(tenantIds).not.toContain(tenantA.id);
        expect(tenantIds).toContain(tenantB.id);
      });
    await memberSession.agent.get(staffRoute).expect(403);
  });

  it('creates a new identity and grant only at acceptance, then accepts an idempotent replay by the same User', async () => {
    const { tenant, agent } = await createTenantAdmin('staff-new-user');
    const branch = await authFixtures.createBranch(tenant, {
      slug: 'staff-new-user-branch',
    });
    const email = 'new-staff@tenant-staff.test';
    const createResponse = await agent
      .post(`/tenants/${tenant.slug}/staff/invitations`)
      .set('Idempotency-Key', randomUUID())
      .send({
        email,
        fullName: 'New Synthetic Staff',
        assignments: [
          {
            roleCode: TenantRoleCode.RECEPTIONIST,
            branchSlugs: [branch.slug],
          },
        ],
      })
      .expect(201);
    const invitationId = (createResponse.body as { id: string }).id;
    const invitation = await invitations.findOneByOrFail({ id: invitationId });
    const token = tokenService.createToken(invitation);

    await expect(
      dataSource.getRepository(User).count({ where: { email } }),
    ).resolves.toBe(0);
    await request(httpServer())
      .post('/auth/staff-invitations/accept')
      .send({ token })
      .expect(422);

    const accepted = await request(httpServer())
      .post('/auth/staff-invitations/accept')
      .send({ token, password: PASSWORD })
      .expect(200);
    const acceptedBody = accepted.body as {
      tenantId: string;
      userId: string;
      membershipId: string;
    };
    expect(acceptedBody.tenantId).toBe(tenant.id);
    const createdUser = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: acceptedBody.userId });
    await expect(
      memberships.findOneByOrFail({
        tenantId: tenant.id,
        userId: createdUser.id,
      }),
    ).resolves.toMatchObject({ status: TenantUserMembershipStatus.ACTIVE });
    await expect(
      roleAssignments.count({
        where: { tenantId: tenant.id, userId: createdUser.id },
      }),
    ).resolves.toBe(1);

    const session = await loginAs(app, { email, password: PASSWORD });
    await session.agent
      .post('/auth/staff-invitations/accept')
      .send({ token })
      .expect(200)
      .expect(({ body }: { body: unknown }) => {
        expect(body).toEqual(acceptedBody);
      });
    await expect(
      roleAssignments.count({
        where: { tenantId: tenant.id, userId: createdUser.id },
      }),
    ).resolves.toBe(1);
  });

  it('invalidates the old token on resend and rejects a mismatched signed-in User', async () => {
    const { tenant, agent } = await createTenantAdmin('staff-resend');
    const branch = await authFixtures.createBranch(tenant, {
      slug: 'staff-resend-branch',
    });
    const invitedUser = await authFixtures.createUser({
      email: 'resend-target@tenant-staff.test',
    });
    const differentUser = await authFixtures.createUser({
      email: 'resend-other@tenant-staff.test',
    });
    const route = `/tenants/${tenant.slug}/staff/invitations`;
    const created = await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({
        email: invitedUser.email,
        fullName: invitedUser.fullName,
        assignments: [
          {
            roleCode: TenantRoleCode.RECEPTIONIST,
            branchSlugs: [branch.slug],
          },
        ],
      })
      .expect(201);
    const invitationId = (created.body as { id: string }).id;
    const oldInvitation = await invitations.findOneByOrFail({
      id: invitationId,
    });
    const oldToken = tokenService.createToken(oldInvitation);
    const resent = await agent
      .post(`${route}/${invitationId}/resend`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    const replacementId = (resent.body as { id: string }).id;
    const replacement = await invitations.findOneByOrFail({
      id: replacementId,
    });
    const replacementToken = tokenService.createToken(replacement);

    const invitedSession = await loginAs(app, {
      email: invitedUser.email,
      password: PASSWORD,
    });
    await invitedSession.agent
      .post('/auth/staff-invitations/accept')
      .send({ token: oldToken })
      .expect(404);
    const differentSession = await loginAs(app, {
      email: differentUser.email,
      password: PASSWORD,
    });
    await differentSession.agent
      .post('/auth/staff-invitations/accept')
      .send({ token: replacementToken })
      .expect(409);
    await invitedSession.agent
      .post('/auth/staff-invitations/accept')
      .send({ token: replacementToken })
      .expect(200);
  });

  it('rejects expired, revoked, or newly inactive proposed branch grants without materializing access', async () => {
    const { tenant, agent } = await createTenantAdmin('staff-invitation-state');
    const branch = await authFixtures.createBranch(tenant, {
      slug: 'staff-invitation-state-branch',
    });
    const create = async (email: string) => {
      const response = await agent
        .post(`/tenants/${tenant.slug}/staff/invitations`)
        .set('Idempotency-Key', randomUUID())
        .send({
          email,
          fullName: 'Invitation State Synthetic',
          assignments: [
            {
              roleCode: TenantRoleCode.RECEPTIONIST,
              branchSlugs: [branch.slug],
            },
          ],
        })
        .expect(201);
      return invitations.findOneByOrFail({
        id: (response.body as { id: string }).id,
      });
    };

    const revoked = await create('revoked@tenant-staff.test');
    const revokedToken = tokenService.createToken(revoked);
    await agent
      .post(`/tenants/${tenant.slug}/staff/invitations/${revoked.id}/revoke`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_REVOKE' })
      .expect(201);
    await request(httpServer())
      .post('/auth/staff-invitations/accept')
      .send({ token: revokedToken, password: PASSWORD })
      .expect(404);

    const expired = await create('expired@tenant-staff.test');
    expired.expiresAt = new Date(Date.now() - 1_000);
    expired.tokenHash = tokenService.hashToken(
      tokenService.createToken(expired),
    );
    await invitations.save(expired);
    await request(httpServer())
      .post('/auth/staff-invitations/accept')
      .send({ token: tokenService.createToken(expired), password: PASSWORD })
      .expect(404);
    await expect(
      invitations.findOneByOrFail({ id: expired.id }),
    ).resolves.toMatchObject({
      status: StaffInvitationStatus.EXPIRED,
    });

    const inactiveBranch = await create('inactive-branch@tenant-staff.test');
    await dataSource.getRepository(Branch).update(branch.id, {
      status: BranchStatus.INACTIVE,
    });
    await request(httpServer())
      .post('/auth/staff-invitations/accept')
      .send({
        token: tokenService.createToken(inactiveBranch),
        password: PASSWORD,
      })
      .expect(422);
    await expect(
      dataSource.getRepository(User).count({
        where: { email: inactiveBranch.email },
      }),
    ).resolves.toBe(0);
  });

  it('protects the last active Tenant Admin from disable and role revocation', async () => {
    const { tenant, user, agent } = await createTenantAdmin('staff-last-admin');
    const assignment = await roleAssignments.findOneByOrFail({
      tenantId: tenant.id,
      userId: user.id,
      roleCode: TenantRoleCode.TENANT_ADMIN,
    });
    const route = `/tenants/${tenant.slug}/staff/${user.id}`;

    await agent
      .post(`${route}/disable`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_LAST_ADMIN' })
      .expect(409);
    await agent
      .delete(`${route}/role-assignments/${assignment.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_LAST_ADMIN' })
      .expect(409);
  });

  it('limits Branch Admin staff management to its active branch and permitted roles', async () => {
    const { tenant, user: tenantAdmin, agent: tenantAdminAgent } =
      await createTenantAdmin('branch-staff-scope');
    const branchA = await authFixtures.createBranch(tenant, {
      slug: 'branch-staff-a',
    });
    const branchB = await authFixtures.createBranch(tenant, {
      slug: 'branch-staff-b',
    });
    const branchAdmin = await authFixtures.createUser({
      email: 'branch-staff-admin@tenant-staff.test',
    });
    const staffA = await authFixtures.createUser({
      email: 'branch-staff-a@tenant-staff.test',
    });
    const staffB = await authFixtures.createUser({
      email: 'branch-staff-b@tenant-staff.test',
    });
    await authFixtures.grantBranchRole(
      branchAdmin,
      branchA,
      TenantRoleCode.BRANCH_ADMIN,
    );
    const receptionistAssignment = await authFixtures.grantBranchRole(
      staffA,
      branchA,
      TenantRoleCode.RECEPTIONIST,
    );
    await authFixtures.grantBranchRole(
      staffB,
      branchB,
      TenantRoleCode.RECEPTIONIST,
    );
    const branchAdminSession = await loginAs(app, {
      email: branchAdmin.email,
      password: PASSWORD,
    });
    const branchRoute = (branch: Branch) =>
      `/tenants/${tenant.slug}/branches/${branch.slug}/staff`;

    await branchAdminSession.agent
      .get(branchRoute(branchA))
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          items: Array<{ email: string; assignments: Array<{ branchId: string }> }>;
        };
        expect(body.items.map((item) => item.email)).toContain(staffA.email);
        expect(body.items.map((item) => item.email)).not.toContain(staffB.email);
        expect(
          body.items.flatMap((item) => item.assignments).every(
            (assignment) => assignment.branchId === branchA.id,
          ),
        ).toBe(true);
      });
    await branchAdminSession.agent.get(branchRoute(branchB)).expect(403);

    await branchAdminSession.agent
      .post(`${branchRoute(branchA)}/${staffA.id}/role-assignments`)
      .set('Idempotency-Key', randomUUID())
      .send({ roleCodes: [TenantRoleCode.DENTIST], reason: 'SYNTHETIC_COVER' })
      .expect(201);
    await expect(
      roleAssignments.findOneByOrFail({
        tenantId: tenant.id,
        branchId: branchA.id,
        userId: staffA.id,
        roleCode: TenantRoleCode.DENTIST,
      }),
    ).resolves.toBeDefined();

    await branchAdminSession.agent
      .delete(
        `${branchRoute(branchA)}/${staffA.id}/role-assignments/${receptionistAssignment.id}`,
      )
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_ROLE_CHANGE' })
      .expect(200);
    await branchAdminSession.agent
      .post(`${branchRoute(branchA)}/${staffA.id}/remove`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_TRANSFER' })
      .expect(201);
    await expect(
      roleAssignments.count({
        where: {
          tenantId: tenant.id,
          branchId: branchA.id,
          userId: staffA.id,
          revokedAt: IsNull(),
        },
      }),
    ).resolves.toBe(0);
    await expect(
      memberships.findOneByOrFail({ tenantId: tenant.id, userId: staffA.id }),
    ).resolves.toMatchObject({ status: TenantUserMembershipStatus.ACTIVE });

    await branchAdminSession.agent
      .post(`${branchRoute(branchA)}/${staffA.id}/role-assignments`)
      .set('Idempotency-Key', randomUUID())
      .send({ roleCodes: [TenantRoleCode.BRANCH_ADMIN] })
      .expect(422);
    await branchAdminSession.agent
      .post(`${branchRoute(branchA)}/invitations`)
      .set('Idempotency-Key', randomUUID())
      .send({
        email: tenantAdmin.email,
        fullName: tenantAdmin.fullName,
        roleCodes: [TenantRoleCode.RECEPTIONIST],
      })
      .expect(403);

    const multiBranchInvitation = await tenantAdminAgent
      .post(`/tenants/${tenant.slug}/staff/invitations`)
      .set('Idempotency-Key', randomUUID())
      .send({
        email: 'multi-branch-hidden@tenant-staff.test',
        fullName: 'Multi Branch Hidden',
        assignments: [
          {
            roleCode: TenantRoleCode.RECEPTIONIST,
            branchSlugs: [branchA.slug, branchB.slug],
          },
        ],
      })
      .expect(201);
    expect((multiBranchInvitation.body as { id: string }).id).toBeTruthy();
    await branchAdminSession.agent
      .get(branchRoute(branchA))
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: Array<{ email: string }> };
        expect(body.items.map((item) => item.email)).not.toContain(
          'multi-branch-hidden@tenant-staff.test',
        );
      });
  });

  it('creates, resends, revokes, and accepts a branch-local staff invitation', async () => {
    const { tenant } = await createTenantAdmin('branch-staff-invitation');
    const branch = await authFixtures.createBranch(tenant, {
      slug: 'branch-staff-invitation-a',
    });
    const branchAdmin = await authFixtures.createUser({
      email: 'branch-invitation-admin@tenant-staff.test',
    });
    await authFixtures.grantBranchRole(
      branchAdmin,
      branch,
      TenantRoleCode.BRANCH_ADMIN,
    );
    const branchAdminSession = await loginAs(app, {
      email: branchAdmin.email,
      password: PASSWORD,
    });
    const route = `/tenants/${tenant.slug}/branches/${branch.slug}/staff`;

    const createKey = randomUUID();
    const invitationInput = {
      email: 'branch-invitation-target@tenant-staff.test',
      fullName: 'Branch Invitation Target',
      roleCodes: [TenantRoleCode.RECEPTIONIST, TenantRoleCode.DENTIST],
    };
    const created = await branchAdminSession.agent
      .post(`${route}/invitations`)
      .set('Idempotency-Key', createKey)
      .send(invitationInput)
      .expect(201);
    const invitationId = (created.body as { id: string }).id;
    await branchAdminSession.agent
      .post(`${route}/invitations`)
      .set('Idempotency-Key', createKey)
      .send(invitationInput)
      .expect(201)
      .expect(created.body);
    await expect(
      dataSource.getRepository(AuditLog).findOneByOrFail({
        action: AuditAction.STAFF_INVITATION_CREATED,
        resourceId: invitationId,
      }),
    ).resolves.toMatchObject({
      branchId: branch.id,
      actorUserId: branchAdmin.id,
    });

    const resent = await branchAdminSession.agent
      .post(`${route}/invitations/${invitationId}/resend`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    const replacementId = (resent.body as { id: string }).id;
    await branchAdminSession.agent
      .post(`${route}/invitations/${replacementId}/revoke`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'SYNTHETIC_REVOKE' })
      .expect(201);

    const acceptedInvitation = await branchAdminSession.agent
      .post(`${route}/invitations`)
      .set('Idempotency-Key', randomUUID())
      .send({
        email: 'branch-accept-target@tenant-staff.test',
        fullName: 'Branch Accept Target',
        roleCodes: [TenantRoleCode.DENTIST],
      })
      .expect(201);
    const acceptedInvitationId = (acceptedInvitation.body as { id: string }).id;
    const invitation = await invitations.findOneByOrFail({
      id: acceptedInvitationId,
    });
    await request(httpServer())
      .post('/auth/staff-invitations/accept')
      .send({ token: tokenService.createToken(invitation), password: PASSWORD })
      .expect(200);
    const acceptedUser = await dataSource.getRepository(User).findOneByOrFail({
      emailNormalized: 'branch-accept-target@tenant-staff.test',
    });
    await expect(
      roleAssignments.findOneByOrFail({
        tenantId: tenant.id,
        branchId: branch.id,
        userId: acceptedUser.id,
        roleCode: TenantRoleCode.DENTIST,
      }),
    ).resolves.toBeDefined();
  });

  async function createTenantAdmin(slug: string): Promise<{
    tenant: Tenant;
    user: User;
    agent: ReturnType<typeof request.agent>;
  }> {
    const createdTenant = await authFixtures.createTenant({ slug });
    const tenant = await dataSource.getRepository(Tenant).findOneByOrFail({
      id: createdTenant.id,
    });
    const user = await authFixtures.createUser({
      email: `tenant-admin-${randomUUID()}@tenant-staff.test`,
    });
    await authFixtures.grantTenantRole(
      user,
      tenant,
      TenantRoleCode.TENANT_ADMIN,
    );
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    return { tenant, user, agent: session.agent };
  }

  function httpServer(): Server {
    const server: unknown = app.getHttpServer();
    return server as Server;
  }
});
