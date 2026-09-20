import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit/audit-actions';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
import {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
} from 'src/modules/appointments/entities/appointment.entity';
import { AppointmentStatusTransition } from 'src/modules/appointments/entities/appointment-status-transition.entity';
import { TenantRoleCode } from 'src/modules/authorization/entities/role-assignment.entity';
import { Branch } from 'src/modules/branches/entities/branch.entity';
import {
  Patient,
  PatientGender,
} from 'src/modules/patients/entities/patient.entity';
import { ServiceGroup } from 'src/modules/service-groups/entities/service-group.entity';
import { Service } from 'src/modules/services/entities/service.entity';
import {
  TenantUserMembership,
  TenantUserMembershipStatus,
} from 'src/modules/staff/entities/tenant-user-membership.entity';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { User } from 'src/modules/users/entities/user.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-appointment-workflow-password';
const WINDOW_FROM = '2026-10-01T00:00:00.000Z';
const WINDOW_TO = '2026-10-31T23:59:59.000Z';

describe('Appointment workflow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;
  let appointments: Repository<Appointment>;
  let transitions: Repository<AppointmentStatusTransition>;
  let auditLogs: Repository<AuditLog>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    const config = app.get(AppConfigService);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds: config.securityConfig.bcryptSaltRounds,
    });
    appointments = dataSource.getRepository(Appointment);
    transitions = dataSource.getRepository(AppointmentStatusTransition);
    auditLogs = dataSource.getRepository(AuditLog);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp();
  });

  it('creates an idempotent, audited service appointment and lets PostgreSQL reject only true Dentist overlaps', async () => {
    const fixture = await createFixture('appointment-create');
    const payload = appointmentPayload(fixture, {
      assignedDentistUserId: fixture.dentist.user.id,
      serviceId: fixture.service.id,
      startAt: '2026-10-10T02:00:00.000Z',
      endAt: '2026-10-10T03:00:00.000Z',
      operationalNote: 'Synthetic operational note',
    });
    const key = randomUUID();

    const response = await fixture.receptionist.agent
      .post(fixture.route)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    const body = response.body as { id: string; service: { name: string } };
    expect(body).toMatchObject({
      status: AppointmentStatus.BOOKED,
      service: {
        id: fixture.service.id,
        name: 'Synthetic Exam',
        amount: 150000,
        currency: 'VND',
        durationMinutes: 30,
      },
      assignedDentist: { id: fixture.dentist.user.id },
    });

    await fixture.receptionist.agent
      .post(fixture.route)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201)
      .expect('Idempotency-Replayed', 'true');

    await expect(appointments.count()).resolves.toBe(1);
    await expect(
      transitions.findBy({ appointmentId: body.id }),
    ).resolves.toEqual([
      expect.objectContaining({
        fromStatus: null,
        toStatus: AppointmentStatus.BOOKED,
        changedByUserId: fixture.receptionist.user.id,
      }),
    ]);
    const audit = await auditLogs.findOneByOrFail({
      action: AuditAction.APPOINTMENT_CREATED,
      resourceId: body.id,
    });
    expect(audit).toMatchObject({
      tenantId: fixture.tenant.id,
      branchId: fixture.branch.id,
      actorUserId: fixture.receptionist.user.id,
    });
    expect(JSON.stringify(audit)).not.toContain(fixture.patient.fullName);
    expect(JSON.stringify(audit)).not.toContain('Synthetic operational note');

    await fixture.receptionist.agent
      .post(fixture.route)
      .set('Idempotency-Key', randomUUID())
      .send(
        appointmentPayload(fixture, {
          assignedDentistUserId: fixture.dentist.user.id,
          startAt: '2026-10-10T02:30:00.000Z',
          endAt: '2026-10-10T03:30:00.000Z',
        }),
      )
      .expect(409);

    await fixture.receptionist.agent
      .post(fixture.route)
      .set('Idempotency-Key', randomUUID())
      .send(
        appointmentPayload(fixture, {
          assignedDentistUserId: fixture.dentist.user.id,
          startAt: '2026-10-10T03:00:00.000Z',
          endAt: '2026-10-10T04:00:00.000Z',
        }),
      )
      .expect(201);
    await fixture.receptionist.agent
      .post(fixture.route)
      .set('Idempotency-Key', randomUUID())
      .send(
        appointmentPayload(fixture, {
          startAt: '2026-10-10T02:30:00.000Z',
          endAt: '2026-10-10T03:30:00.000Z',
        }),
      )
      .expect(201);
  });

  it('exposes only appointment-safe booking options and the resolved branch timezone', async () => {
    const fixture = await createFixture('appointment-booking-options');
    const inactiveDentist = await createActor(
      fixture.branch,
      TenantRoleCode.DENTIST,
    );
    await dataSource.getRepository(TenantUserMembership).update(
      { tenantId: fixture.tenant.id, userId: inactiveDentist.user.id },
      { status: TenantUserMembershipStatus.INACTIVE },
    );
    const otherBranch = await authFixtures.createBranch(fixture.tenant, {
      slug: 'other-branch',
    });
    const otherBranchDentist = await createActor(
      otherBranch,
      TenantRoleCode.DENTIST,
    );
    const inactiveService = await dataSource.manager.save(
      dataSource.manager.create(Service, {
        tenantId: fixture.tenant.id,
        serviceGroupId: fixture.service.serviceGroupId,
        code: 'inactive-option',
        name: 'Inactive synthetic service',
        amount: 100000,
        currency: 'VND',
        durationMinutes: 30,
        isActive: false,
      }),
    );
    const otherTenant = await authFixtures.createTenant({
      slug: 'appointment-options-other-tenant',
    });
    const otherTenantGroup = await dataSource.manager.save(
      dataSource.manager.create(ServiceGroup, {
        tenantId: otherTenant.id,
        name: 'Other tenant services',
        isActive: true,
      }),
    );
    const otherTenantService = await dataSource.manager.save(
      dataSource.manager.create(Service, {
        tenantId: otherTenant.id,
        serviceGroupId: otherTenantGroup.id,
        code: 'other-tenant-service',
        name: 'Other tenant synthetic service',
        amount: 100000,
        currency: 'VND',
        durationMinutes: 30,
        isActive: true,
      }),
    );

    const dentistsResponse = await fixture.receptionist.agent
      .get(`${fixture.route}/booking-options/dentists?search=Synthetic%20DENTIST`)
      .expect(200);
    expect(dentistsResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixture.dentist.user.id,
          fullName: fixture.dentist.user.fullName,
        }),
      ]),
    );
    expect(dentistsResponse.body.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: inactiveDentist.user.id }),
        expect.objectContaining({ id: otherBranchDentist.user.id }),
      ]),
    );
    expect(Object.keys(dentistsResponse.body.items[0]).sort()).toEqual([
      'fullName',
      'id',
    ]);
    expect(JSON.stringify(dentistsResponse.body.items)).not.toContain('email');

    await fixture.branchAdmin.agent
      .get(`${fixture.route}/booking-options/dentists`)
      .expect(200);

    const servicesResponse = await fixture.receptionist.agent
      .get(`${fixture.route}/booking-options/services`)
      .expect(200);
    expect(servicesResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixture.service.id, name: 'Synthetic Exam' }),
      ]),
    );
    expect(servicesResponse.body.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: inactiveService.id }),
        expect.objectContaining({ id: otherTenantService.id }),
      ]),
    );
    expect(Object.keys(servicesResponse.body.items[0]).sort()).toEqual([
      'amount',
      'code',
      'currency',
      'durationMinutes',
      'id',
      'name',
    ]);

    const meResponse = await fixture.receptionist.agent.get('/auth/me').expect(200);
    const branchSnapshot = meResponse.body.user.authorization.tenants[0].branches[0]
      .branch;
    expect(branchSnapshot).toMatchObject({
      id: fixture.branch.id,
      timezone: fixture.branch.timezone ?? fixture.tenant.defaultTimezone,
    });
  });

  it('enforces scheduling roles, the confirmed reschedule rule, terminal transitions, and the Dentist-safe schedule', async () => {
    const fixture = await createFixture('appointment-workflow');
    const createResponse = await fixture.receptionist.agent
      .post(fixture.route)
      .set('Idempotency-Key', randomUUID())
      .send(
        appointmentPayload(fixture, {
          startAt: '2026-10-12T02:00:00.000Z',
          endAt: '2026-10-12T03:00:00.000Z',
          operationalNote: 'Never expose this to Dentist schedule list',
        }),
      )
      .expect(201);
    const appointmentId = (createResponse.body as { id: string }).id;

    await fixture.receptionist.agent
      .post(`${fixture.route}/${appointmentId}/assign`)
      .set('Idempotency-Key', randomUUID())
      .send({ assignedDentistUserId: fixture.dentist.user.id })
      .expect(403);
    await fixture.branchAdmin.agent
      .post(`${fixture.route}/${appointmentId}/assign`)
      .set('Idempotency-Key', randomUUID())
      .send({ assignedDentistUserId: fixture.dentist.user.id })
      .expect(200);

    await fixture.receptionist.agent
      .post(`${fixture.route}/${appointmentId}/confirm`)
      .set('Idempotency-Key', randomUUID())
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: AppointmentStatus.CONFIRMED,
        });
      });
    await fixture.receptionist.agent
      .patch(`${fixture.route}/${appointmentId}`)
      .set('Idempotency-Key', randomUUID())
      .send({ startAt: '2026-10-12T03:00:00.000Z' })
      .expect(422);
    await fixture.receptionist.agent
      .patch(`${fixture.route}/${appointmentId}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        startAt: '2026-10-12T03:00:00.000Z',
        endAt: '2026-10-12T04:00:00.000Z',
        reasonCode: 'PATIENT_REQUEST',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: AppointmentStatus.BOOKED,
        });
      });

    await fixture.receptionist.agent
      .post(`${fixture.route}/${appointmentId}/confirm`)
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    await fixture.receptionist.agent
      .post(`${fixture.route}/${appointmentId}/check-in`)
      .set('Idempotency-Key', randomUUID())
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: AppointmentStatus.CHECKED_IN,
        });
      });
    await fixture.receptionist.agent
      .post(`${fixture.route}/${appointmentId}/cancel`)
      .set('Idempotency-Key', randomUUID())
      .send({ reasonCode: 'PATIENT_CANCELLED' })
      .expect(409);

    await fixture.dentist.agent
      .get(`${fixture.route}/assigned?from=${WINDOW_FROM}&to=${WINDOW_TO}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          items: Array<{ id: string; [key: string]: unknown }>;
        };
        const item = body.items.find(
          (candidate: { id: string }) => candidate.id === appointmentId,
        );
        expect(item).toMatchObject({
          id: appointmentId,
          patient: {
            id: fixture.patient.id,
            fullName: fixture.patient.fullName,
          },
        });
        expect(item).not.toHaveProperty('operationalNote');
        expect(JSON.stringify(item)).not.toContain(fixture.patient.phone);
      });
  });

  it('validates scoped references, reason rules, list windows, and branch isolation', async () => {
    const fixture = await createFixture('appointment-security');
    const otherTenant = await authFixtures.createTenant({
      slug: 'appointment-security-other',
    });
    const otherPatient = await createPatient(
      otherTenant,
      'Other Synthetic Patient',
    );

    await fixture.receptionist.agent
      .post(fixture.route)
      .set('Idempotency-Key', randomUUID())
      .send(
        appointmentPayload(fixture, {
          patientId: otherPatient.id,
          assignedDentistUserId: null,
        }),
      )
      .expect(404);
    await fixture.receptionist.agent
      .post(fixture.route)
      .set('Idempotency-Key', randomUUID())
      .send({
        patientId: fixture.patient.id,
        source: AppointmentSource.PHONE,
        startAt: '2026-10-15T02:00:00.000Z',
        endAt: '2026-10-15T03:00:00.000Z',
      })
      .expect(422);
    await fixture.receptionist.agent
      .get(`${fixture.route}?from=${WINDOW_FROM}&to=2026-12-01T00:00:00.000Z`)
      .expect(422);
    await request(app.getHttpServer() as Server)
      .get(`${fixture.route}?from=${WINDOW_FROM}&to=${WINDOW_TO}`)
      .expect(401);
  });

  async function createFixture(slug: string) {
    const tenant = await authFixtures.createTenant({ slug });
    const branch = await authFixtures.createBranch(tenant, { slug: 'main' });
    const receptionist = await createActor(branch, TenantRoleCode.RECEPTIONIST);
    const branchAdmin = await createActor(branch, TenantRoleCode.BRANCH_ADMIN);
    const dentist = await createActor(branch, TenantRoleCode.DENTIST);
    const patient = await createPatient(
      tenant,
      'Synthetic Appointment Patient',
    );
    const serviceGroup = await dataSource.manager.save(
      dataSource.manager.create(ServiceGroup, {
        tenantId: tenant.id,
        name: 'Synthetic Consultation',
        isActive: true,
      }),
    );
    const service = await dataSource.manager.save(
      dataSource.manager.create(Service, {
        tenantId: tenant.id,
        serviceGroupId: serviceGroup.id,
        code: `exam-${slug}`,
        name: 'Synthetic Exam',
        amount: 150000,
        currency: 'VND',
        durationMinutes: 30,
        isActive: true,
      }),
    );
    return {
      tenant,
      branch,
      receptionist,
      branchAdmin,
      dentist,
      patient,
      service,
      route: `/tenants/${tenant.slug}/branches/${branch.slug}/appointments`,
    };
  }

  async function createActor(
    branch: Branch,
    role: Exclude<TenantRoleCode, TenantRoleCode.TENANT_ADMIN>,
  ): Promise<{ user: User; agent: ReturnType<typeof request.agent> }> {
    const user = await authFixtures.createUser({
      email: `user-${randomUUID()}@appointments.example.com`,
      fullName: `Synthetic ${role}`,
    });
    await authFixtures.grantBranchRole(user, branch, role);
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    return { user, agent: session.agent };
  }

  async function createPatient(
    tenant: Tenant,
    fullName: string,
  ): Promise<Patient> {
    const number = `${Math.floor(Math.random() * 900000000 + 100000000)}`;
    return dataSource.manager.save(
      dataSource.manager.create(Patient, {
        tenantId: tenant.id,
        fullName,
        phone: `09${number}`,
        phoneNormalized: `+849${number}`,
        gender: PatientGender.OTHER,
        dateOfBirth: null,
        address: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelationship: null,
        referralSource: null,
      }),
    );
  }

  function appointmentPayload(
    fixture: Awaited<ReturnType<typeof createFixture>>,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      patientId: fixture.patient.id,
      source: AppointmentSource.PHONE,
      startAt: '2026-10-10T02:00:00.000Z',
      endAt: '2026-10-10T03:00:00.000Z',
      visitReason: 'Synthetic examination',
      assignedDentistUserId: null,
      ...overrides,
    };
  }
});
