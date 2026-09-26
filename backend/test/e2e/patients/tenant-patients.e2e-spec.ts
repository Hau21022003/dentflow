import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import { TenantRoleCode } from 'src/modules/authorization/entities/role-assignment.entity';
import {
  Branch,
  BranchStatus,
} from 'src/modules/branches/entities/branch.entity';
import {
  Patient,
  PatientGender,
} from 'src/modules/patients/entities/patient.entity';
import {
  Tenant,
  TenantStatus,
} from 'src/modules/tenants/entities/tenant.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
} from 'src/modules/appointments/entities/appointment.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-patient-management-password';

describe('Patient administrative management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;
  let patientsRepository: Repository<Patient>;
  let auditLogsRepository: Repository<AuditLog>;
  let appointmentsRepository: Repository<Appointment>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    const appConfig = app.get(AppConfigService);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds: appConfig.securityConfig.bcryptSaltRounds,
    });
    patientsRepository = dataSource.getRepository(Patient);
    auditLogsRepository = dataSource.getRepository(AuditLog);
    appointmentsRepository = dataSource.getRepository(Appointment);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('creates an administrative patient, hides normalized phone data, audits safely, and replays the command', async () => {
    const { tenant, branch, user, agent } = await createBranchActor(
      'patient-create',
      TenantRoleCode.RECEPTIONIST,
    );
    const route = patientRoute(tenant, branch);
    const payload = {
      fullName: '  Synthetic   Minh Anh ',
      phone: '090 123 4567',
      gender: PatientGender.FEMALE,
      dateOfBirth: '1999-04-20',
      address: '  1 Synthetic Street ',
      emergencyContact: {
        fullName: 'Synthetic Guardian',
        phone: '+84 912 345 678',
        relationship: ' Parent ',
      },
      referralSource: ' Friend referral ',
    };
    const idempotencyKey = randomUUID();

    const response = await agent
      .post(route)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);
    const body = response.body as { id: string; phone: string };
    expect(body).toMatchObject({
      fullName: 'Synthetic Minh Anh',
      phone: '090 123 4567',
      gender: PatientGender.FEMALE,
      dateOfBirth: '1999-04-20',
      address: '1 Synthetic Street',
      emergencyContact: {
        fullName: 'Synthetic Guardian',
        phone: '+84 912 345 678',
        relationship: 'Parent',
      },
      referralSource: 'Friend referral',
    });
    expect(body).not.toHaveProperty('phoneNormalized');

    await agent
      .post(route)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201)
      .expect('Idempotency-Replayed', 'true');

    await expect(
      patientsRepository.findOneByOrFail({ id: body.id }),
    ).resolves.toMatchObject({
      tenantId: tenant.id,
      phoneNormalized: '+84901234567',
    });
    await expect(
      auditLogsRepository.count({
        where: { action: AuditAction.PATIENT_CREATED, resourceId: body.id },
      }),
    ).resolves.toBe(1);
    const auditLog = await auditLogsRepository.findOneByOrFail({
      action: AuditAction.PATIENT_CREATED,
      resourceId: body.id,
    });
    expect(auditLog).toMatchObject({
      actorUserId: user.id,
      tenantId: tenant.id,
      branchId: branch.id,
    });
    expect(auditLog.after).toEqual({
      changedFields: [
        'fullName',
        'phone',
        'gender',
        'dateOfBirth',
        'address',
        'emergencyContact',
        'referralSource',
      ],
    });
    expect(JSON.stringify(auditLog)).not.toContain('Synthetic Minh Anh');
    expect(JSON.stringify(auditLog)).not.toContain('090 123 4567');
  });

  it('supports Branch Admin, validates profile input, and prevents normalized-phone duplicates only within a tenant', async () => {
    const { tenant, branch, agent } = await createBranchActor(
      'patient-duplicate',
      TenantRoleCode.BRANCH_ADMIN,
    );
    const route = patientRoute(tenant, branch);
    await createPatient(agent, route, {
      fullName: 'Synthetic Existing Patient',
      phone: '0901234567',
      gender: PatientGender.MALE,
    });

    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({
        fullName: 'Synthetic Duplicate Patient',
        phone: '+84 901 234 567',
        gender: PatientGender.OTHER,
      })
      .expect(409);
    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({
        fullName: 'Synthetic Invalid Date',
        phone: '0901234568',
        gender: PatientGender.MALE,
        dateOfBirth: '2999-01-01',
      })
      .expect(422);
    await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send({
        fullName: 'Synthetic Incomplete Emergency Contact',
        phone: '0901234569',
        gender: PatientGender.MALE,
        emergencyContact: { fullName: 'Synthetic Guardian' },
      })
      .expect(422);

    const otherTenant = await authFixtures.createTenant({
      slug: 'patient-duplicate-other',
    });
    const otherBranch = await authFixtures.createBranch(otherTenant, {
      slug: 'other',
    });
    const otherUser = await authFixtures.createUser({
      email: `other-${randomUUID()}@patients.test`,
    });
    await authFixtures.grantBranchRole(
      otherUser,
      otherBranch,
      TenantRoleCode.RECEPTIONIST,
    );
    const otherSession = await loginAs(app, {
      email: otherUser.email,
      password: PASSWORD,
    });
    await otherSession.agent
      .post(patientRoute(otherTenant, otherBranch))
      .set('Idempotency-Key', randomUUID())
      .send({
        fullName: 'Synthetic Other Tenant Patient',
        phone: '+84901234567',
        gender: PatientGender.MALE,
      })
      .expect(201);
  });

  it('lists and updates only tenant-scoped patients with safe sorting and idempotency', async () => {
    const { tenant, branch, agent } = await createBranchActor(
      'patient-list-update',
      TenantRoleCode.RECEPTIONIST,
    );
    const route = patientRoute(tenant, branch);
    const zulu = await createPatient(agent, route, {
      fullName: 'Zulu Synthetic',
      phone: '0901234570',
      gender: PatientGender.MALE,
      dateOfBirth: '2000-01-01',
    });
    const alpha = await createPatient(agent, route, {
      fullName: 'Alpha Synthetic',
      phone: '0901234571',
      gender: PatientGender.FEMALE,
      dateOfBirth: '1990-01-01',
    });
    await patientsRepository.update(zulu.id, {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await patientsRepository.update(alpha.id, {
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    await agent
      .get(`${route}?search=Alpha&sortBy=fullName&sortOrder=ASC&page=1&limit=1`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          items: [expect.objectContaining({ id: alpha.id })],
          meta: {
            page: 1,
            limit: 1,
            total: 1,
            totalPages: 1,
            scheduleCounts: {
              all: 1,
              withUpcoming: 0,
              withoutUpcoming: 1,
            },
          },
        });
      });
    await agent
      .get(`${route}?search=0901234570`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: Array<{ id: string }> };
        expect(body.items).toEqual([expect.objectContaining({ id: zulu.id })]);
      });
    await agent
      .get(`${route}?sortBy=dateOfBirth&sortOrder=ASC`)
      .expect(200)
      .expect((response) => {
        expect(
          (response.body as { items: Array<{ id: string }> }).items.map(
            (patient) => patient.id,
          ),
        ).toEqual([alpha.id, zulu.id]);
      });
    await agent
      .get(`${route}?sortBy=createdAt&sortOrder=DESC`)
      .expect(200)
      .expect((response) => {
        expect(
          (response.body as { items: Array<{ id: string }> }).items.map(
            (patient) => patient.id,
          ),
        ).toEqual([alpha.id, zulu.id]);
      });
    await agent.get(`${route}?sortBy=unsafe_column`).expect(422);

    const updateKey = randomUUID();
    await agent
      .patch(`${route}/${alpha.id}`)
      .set('Idempotency-Key', updateKey)
      .send({
        address: '2 Synthetic Updated Street',
        emergencyContact: null,
        referralSource: null,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: alpha.id,
          address: '2 Synthetic Updated Street',
          emergencyContact: null,
          referralSource: null,
        });
      });
    await agent
      .patch(`${route}/${alpha.id}`)
      .set('Idempotency-Key', updateKey)
      .send({
        address: '2 Synthetic Updated Street',
        emergencyContact: null,
        referralSource: null,
      })
      .expect(200)
      .expect('Idempotency-Replayed', 'true');
    await expect(
      auditLogsRepository.count({
        where: {
          action: AuditAction.PATIENT_ADMINISTRATIVE_UPDATED,
          resourceId: alpha.id,
        },
      }),
    ).resolves.toBe(1);

    await agent
      .patch(`${route}/${alpha.id}`)
      .set('Idempotency-Key', randomUUID())
      .send({ phone: '0901234570' })
      .expect(409);
  });

  it('enforces authentication, branch scope, tenant isolation, role, and lifecycle guards', async () => {
    const { tenant, branch, agent } = await createBranchActor(
      'patient-security',
      TenantRoleCode.RECEPTIONIST,
    );
    const route = patientRoute(tenant, branch);
    const patient = await createPatient(agent, route, {
      fullName: 'Synthetic Protected Patient',
      phone: '0901234572',
      gender: PatientGender.OTHER,
    });
    const otherBranch = await authFixtures.createBranch(tenant, {
      slug: 'other-scope',
    });
    const dentist = await authFixtures.createUser({
      email: `dentist-${randomUUID()}@patients.test`,
    });
    await authFixtures.grantBranchRole(dentist, branch, TenantRoleCode.DENTIST);
    const dentistSession = await loginAs(app, {
      email: dentist.email,
      password: PASSWORD,
    });

    await request(app.getHttpServer() as Server)
      .get(route)
      .expect(401);
    await agent.get(patientRoute(tenant, otherBranch)).expect(403);
    await dentistSession.agent.get(route).expect(403);

    const otherTenant = await authFixtures.createTenant({
      slug: 'patient-security-other',
    });
    const otherTenantBranch = await authFixtures.createBranch(otherTenant, {
      slug: 'other-tenant',
    });
    const otherTenantUser = await authFixtures.createUser({
      email: `other-tenant-${randomUUID()}@patients.test`,
    });
    await authFixtures.grantBranchRole(
      otherTenantUser,
      otherTenantBranch,
      TenantRoleCode.RECEPTIONIST,
    );
    const otherTenantSession = await loginAs(app, {
      email: otherTenantUser.email,
      password: PASSWORD,
    });
    const otherPatient = await createPatient(
      otherTenantSession.agent,
      patientRoute(otherTenant, otherTenantBranch),
      {
        fullName: 'Synthetic Other Tenant Protected Patient',
        phone: '0901234573',
        gender: PatientGender.MALE,
      },
    );
    await agent.get(`${route}/${otherPatient.id}`).expect(404);

    await dataSource.getRepository(Branch).update(branch.id, {
      status: BranchStatus.INACTIVE,
    });
    await agent.get(route).expect(403);
    await dataSource.getRepository(Branch).update(branch.id, {
      status: BranchStatus.ACTIVE,
    });
    await dataSource.getRepository(Tenant).update(tenant.id, {
      status: TenantStatus.SUSPENDED,
    });
    await agent.get(route).expect(403);
    expect(patient.id).toBeDefined();
  });

  it('lists only patients currently assigned to the requesting Dentist with branch-scoped schedule summaries', async () => {
    const { tenant, branch, agent } = await createBranchActor(
      'patient-assigned-list',
      TenantRoleCode.RECEPTIONIST,
    );
    const route = patientRoute(tenant, branch);
    const assignedPatient = await createPatient(agent, route, {
      fullName: 'Synthetic Assigned Patient',
      phone: '0901234580',
      gender: PatientGender.FEMALE,
      address: 'Sensitive address must not be returned to Dentist',
    });
    const otherPatient = await createPatient(agent, route, {
      fullName: 'Synthetic Other Dentist Patient',
      phone: '0901234581',
      gender: PatientGender.MALE,
    });
    const unassignedPatient = await createPatient(agent, route, {
      fullName: 'Synthetic Unassigned Patient',
      phone: '0901234582',
      gender: PatientGender.OTHER,
    });
    const dentist = await authFixtures.createUser({
      email: `assigned-dentist-${randomUUID()}@patients.test`,
    });
    const otherDentist = await authFixtures.createUser({
      email: `other-dentist-${randomUUID()}@patients.test`,
    });
    await authFixtures.grantBranchRole(dentist, branch, TenantRoleCode.DENTIST);
    await authFixtures.grantBranchRole(
      otherDentist,
      branch,
      TenantRoleCode.DENTIST,
    );
    const dentistSession = await loginAs(app, {
      email: dentist.email,
      password: PASSWORD,
    });
    const now = Date.now();
    await appointmentsRepository.save([
      appointmentsRepository.create({
        tenantId: tenant.id,
        branchId: branch.id,
        patientId: assignedPatient.id,
        source: AppointmentSource.PHONE,
        status: AppointmentStatus.BOOKED,
        startAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
        endAt: new Date(now + (2 * 24 * 60 + 30) * 60 * 1000),
        assignedDentistUserId: dentist.id,
        visitReason: 'Synthetic follow-up',
      }),
      appointmentsRepository.create({
        tenantId: tenant.id,
        branchId: branch.id,
        patientId: assignedPatient.id,
        source: AppointmentSource.PHONE,
        status: AppointmentStatus.COMPLETED,
        startAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        endAt: new Date(now - (3 * 24 * 60 - 30) * 60 * 1000),
        assignedDentistUserId: dentist.id,
        visitReason: 'Synthetic completed visit',
      }),
      appointmentsRepository.create({
        tenantId: tenant.id,
        branchId: branch.id,
        patientId: otherPatient.id,
        source: AppointmentSource.PHONE,
        status: AppointmentStatus.CONFIRMED,
        startAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
        endAt: new Date(now + (3 * 24 * 60 + 30) * 60 * 1000),
        assignedDentistUserId: otherDentist.id,
        visitReason: 'Synthetic other appointment',
      }),
      appointmentsRepository.create({
        tenantId: tenant.id,
        branchId: branch.id,
        patientId: unassignedPatient.id,
        source: AppointmentSource.PHONE,
        status: AppointmentStatus.BOOKED,
        startAt: new Date(now + 4 * 24 * 60 * 60 * 1000),
        endAt: new Date(now + (4 * 24 * 60 + 30) * 60 * 1000),
        assignedDentistUserId: null,
        visitReason: 'Synthetic unassigned appointment',
      }),
    ]);

    await agent.get(`${route}/assigned`).expect(403);
    await dentistSession.agent
      .get(`${route}/assigned?scheduleFilter=WITH_UPCOMING&sortBy=nextAppointmentAt&sortOrder=ASC`)
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          items: Array<Record<string, unknown>>;
          meta: {
            scheduleCounts: {
              all: number;
              withUpcoming: number;
              withoutUpcoming: number;
            };
          };
        };
        expect(body.items).toHaveLength(1);
        expect(body.meta).toMatchObject({
          scheduleCounts: {
            all: 1,
            withUpcoming: 1,
            withoutUpcoming: 0,
          },
        });
        expect(body.items[0]).toMatchObject({
          id: assignedPatient.id,
          fullName: 'Synthetic Assigned Patient',
          phone: '0901234580',
          nextAppointment: { visitReason: 'Synthetic follow-up' },
          lastVisit: expect.objectContaining({ completedAt: expect.any(String) }),
        });
        expect(body.items[0]).not.toHaveProperty('address');
        expect(body.items[0]).not.toHaveProperty('emergencyContact');
        expect(body.items[0]).not.toHaveProperty('createdAt');
      });
    await dentistSession.agent
      .get(`${route}/assigned?scheduleFilter=WITHOUT_UPCOMING`)
      .expect(200)
      .expect((response) => expect(response.body.items).toEqual([]));
  });

  async function createBranchActor(
    slug: string,
    roleCode: TenantRoleCode.BRANCH_ADMIN | TenantRoleCode.RECEPTIONIST,
  ): Promise<{
    tenant: Tenant;
    branch: Branch;
    user: User;
    agent: ReturnType<typeof request.agent>;
  }> {
    const tenant = await authFixtures.createTenant({ slug });
    const branch = await authFixtures.createBranch(tenant, { slug: 'main' });
    const user = await authFixtures.createUser({
      email: `${roleCode.toLowerCase()}-${randomUUID()}@patients.test`,
    });
    await authFixtures.grantBranchRole(user, branch, roleCode);
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    return { tenant, branch, user, agent: session.agent };
  }

  async function createPatient(
    agent: ReturnType<typeof request.agent>,
    route: string,
    payload: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const response = await agent
      .post(route)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);
    return response.body as { id: string };
  }

  function patientRoute(tenant: Tenant, branch: Branch): string {
    return `/tenants/${tenant.slug}/branches/${branch.slug}/patients`;
  }
});
