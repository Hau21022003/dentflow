import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppConfigService } from 'src/config/app-config.service';
import {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
} from 'src/modules/appointments/entities/appointment.entity';
import { AppointmentStatusTransition } from 'src/modules/appointments/entities/appointment-status-transition.entity';
import {
  RoleAssignment,
  TenantRoleCode,
} from 'src/modules/authorization/entities/role-assignment.entity';
import { Branch } from 'src/modules/branches/entities/branch.entity';
import {
  Operatory,
  OperatoryType,
} from 'src/modules/operatories/entities/operatory.entity';
import {
  Patient,
  PatientGender,
} from 'src/modules/patients/entities/patient.entity';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { User, UserStatus } from 'src/modules/users/entities/user.entity';
import { Visit, VisitStatus } from 'src/modules/visits/entities/visit.entity';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-patient-visits-password';

type VisitListTestBody = {
  items: Array<{
    id: string;
    diagnosisSummary: string | null;
    durationMinutes: number | null;
    dentist: { id: string; fullName: string };
  }>;
  meta: { page: number; limit: number; total: number; totalPages: number };
  summary: { total: number; completed: number; inProgress: number };
  filterOptions: {
    dentists: Array<{ id: string; fullName: string }>;
  };
};

function visitListBody(response: { body: unknown }): VisitListTestBody {
  return response.body as VisitListTestBody;
}

describe('Patient Visit history (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;
  let appointments: Repository<Appointment>;
  let transitions: Repository<AppointmentStatusTransition>;
  let visits: Repository<Visit>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    const appConfig = app.get(AppConfigService);
    authFixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds: appConfig.securityConfig.bcryptSaltRounds,
    });
    appointments = dataSource.getRepository(Appointment);
    transitions = dataSource.getRepository(AppointmentStatusTransition);
    visits = dataSource.getRepository(Visit);
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await resetDbToBaseState(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('paginates, filters, sorts, and keeps summary and Dentist options unfiltered', async () => {
    const fixture = await createFixture('patient-visits-list');
    const secondDentist = await createDentist(fixture.branch, 'Second Dentist');
    const expectedIds: string[] = [];

    for (let index = 0; index < 22; index += 1) {
      const startedAt = new Date(Date.UTC(2026, 0, index + 1, 2, 0, 0));
      const dentist = index === 10 ? secondDentist.user : fixture.dentist.user;
      const status = index === 21 ? VisitStatus.OPEN : VisitStatus.COMPLETED;
      const record = await createVisit(fixture, {
        dentist,
        diagnosis: index === 0 ? null : `Synthetic diagnosis ${index}`,
        startedAt,
        status,
      });
      expectedIds.push(record.visit.id);
    }

    const firstPage = await fixture.agent.get(fixture.route).expect(200);
    const firstPageBody = visitListBody(firstPage);
    expect(firstPageBody).toMatchObject({
      meta: { page: 1, limit: 20, total: 22, totalPages: 2 },
      summary: { total: 22, completed: 21, inProgress: 1 },
    });
    expect(firstPageBody.items).toHaveLength(20);
    expect(firstPageBody.items[0]).toMatchObject({
      id: expectedIds[21],
      status: VisitStatus.OPEN,
      completedAt: null,
      durationMinutes: null,
    });
    expect(firstPageBody.filterOptions.dentists).toEqual([
      { id: secondDentist.user.id, fullName: secondDentist.user.fullName },
      {
        id: fixture.dentist.user.id,
        fullName: fixture.dentist.user.fullName,
      },
    ]);

    await fixture.agent
      .get(`${fixture.route}?page=2`)
      .expect(200)
      .expect((response) => {
        expect(visitListBody(response).items).toHaveLength(2);
      });
    await fixture.agent
      .get(`${fixture.route}?page=3`)
      .expect(200)
      .expect((response) => {
        const body = visitListBody(response);
        expect(body.items).toHaveLength(0);
        expect(body.meta).toMatchObject({
          page: 3,
          total: 22,
          totalPages: 2,
        });
      });
    await fixture.agent.get(`${fixture.route}?limit=101`).expect(422);
    await fixture.agent
      .get(`${fixture.route}?limit=100&sortOrder=ASC`)
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          items: Array<{ id: string; durationMinutes: number | null }>;
          meta: { limit: number };
        };
        expect(body.meta.limit).toBe(100);
        expect(body.items.map((item) => item.id)).toEqual(expectedIds);
        expect(body.items[0].durationMinutes).toBe(30);
      });

    await fixture.agent
      .get(fixture.route)
      .query({ status: VisitStatus.OPEN })
      .expect(200)
      .expect((response) => {
        const body = visitListBody(response);
        expect(body.meta.total).toBe(1);
        expect(body.items[0].id).toBe(expectedIds[21]);
      });
    await fixture.agent
      .get(fixture.route)
      .query({ dentistUserId: secondDentist.user.id })
      .expect(200)
      .expect((response) => {
        const body = visitListBody(response);
        expect(body.meta.total).toBe(1);
        expect(body.items[0].id).toBe(expectedIds[10]);
      });

    const filtered = await fixture.agent
      .get(fixture.route)
      .query({
        status: VisitStatus.COMPLETED,
        dentistUserId: secondDentist.user.id,
        from: '2026-01-11T02:00:00.000Z',
        to: '2026-01-12T02:00:00.000Z',
      })
      .expect(200);
    const filteredBody = visitListBody(filtered);
    expect(filteredBody).toMatchObject({
      meta: { total: 1 },
      summary: { total: 22, completed: 21, inProgress: 1 },
    });
    expect(filteredBody.items[0]).toMatchObject({
      id: expectedIds[10],
      dentist: {
        id: secondDentist.user.id,
        fullName: secondDentist.user.fullName,
      },
    });
    expect(filteredBody.filterOptions.dentists).toHaveLength(2);

    await fixture.agent
      .get(fixture.route)
      .query({ from: '2026-01-22T02:00:00.000Z' })
      .expect(200)
      .expect((response) => {
        expect(visitListBody(response).meta.total).toBe(1);
      });
    await fixture.agent
      .get(fixture.route)
      .query({ to: '2026-01-02T02:00:00.000Z' })
      .expect(200)
      .expect((response) => {
        const body = visitListBody(response);
        expect(body.meta.total).toBe(1);
        expect(body.items[0].diagnosisSummary).toBeNull();
      });
    await fixture.agent
      .get(fixture.route)
      .query({
        from: '2026-01-03T02:00:00.000Z',
        to: '2026-01-03T02:00:00.000Z',
      })
      .expect(422);
  });

  it('keeps historical inactive Dentist and Operatory labels and only computes valid actual duration', async () => {
    const fixture = await createFixture('patient-visits-history');
    const valid = await createVisit(fixture, {
      diagnosis: 'Synthetic retained diagnosis',
      startedAt: new Date('2026-03-01T02:00:00.000Z'),
      status: VisitStatus.COMPLETED,
    });
    const missingStart = await createVisit(fixture, {
      diagnosis: null,
      startedAt: null,
      completedAt: new Date('2026-03-02T03:00:00.000Z'),
      status: VisitStatus.COMPLETED,
    });
    const inverted = await createVisit(fixture, {
      diagnosis: null,
      startedAt: new Date('2026-03-03T03:00:00.000Z'),
      completedAt: new Date('2026-03-03T02:00:00.000Z'),
      status: VisitStatus.COMPLETED,
    });

    await dataSource.getRepository(User).update(fixture.dentist.user.id, {
      status: UserStatus.DISABLED,
    });
    await dataSource.getRepository(Operatory).update(fixture.operatory.id, {
      isActive: false,
    });
    await dataSource
      .getRepository(RoleAssignment)
      .update(fixture.dentist.assignment.id, {
        revokedAt: new Date('2026-04-01T00:00:00.000Z'),
        revokedByUserId: fixture.receptionist.id,
        revocationReason: 'Synthetic historical access change',
      });

    const response = await fixture.agent
      .get(`${fixture.route}?limit=100&sortOrder=ASC`)
      .expect(200);
    const body = response.body as {
      items: Array<{
        id: string;
        diagnosisSummary: string | null;
        durationMinutes: number | null;
        dentist: { id: string; fullName: string };
        operatory: { id: string; name: string; isActive: boolean } | null;
      }>;
      filterOptions: { dentists: Array<{ id: string }> };
    };
    const byId = new Map(body.items.map((item) => [item.id, item]));
    expect(byId.get(valid.visit.id)).toMatchObject({
      diagnosisSummary: 'Synthetic retained diagnosis',
      durationMinutes: 30,
      dentist: {
        id: fixture.dentist.user.id,
        fullName: fixture.dentist.user.fullName,
      },
      operatory: {
        id: fixture.operatory.id,
        name: fixture.operatory.name,
        isActive: false,
      },
    });
    expect(byId.get(missingStart.visit.id)).toMatchObject({
      diagnosisSummary: null,
      durationMinutes: null,
    });
    expect(byId.get(inverted.visit.id)).toMatchObject({
      diagnosisSummary: null,
      durationMinutes: null,
    });
    expect(body.filterOptions.dentists).toContainEqual({
      id: fixture.dentist.user.id,
      fullName: fixture.dentist.user.fullName,
    });
  });

  it('uses Visit ID as a stable tie-breaker and always sorts missing start timestamps last', async () => {
    const fixture = await createFixture('patient-visits-stable-sort');
    const sharedStartedAt = new Date('2026-04-01T02:00:00.000Z');
    const firstTiedVisit = await createVisit(fixture, {
      diagnosis: null,
      startedAt: sharedStartedAt,
      status: VisitStatus.OPEN,
    });
    const secondTiedVisit = await createVisit(fixture, {
      diagnosis: null,
      startedAt: sharedStartedAt,
      status: VisitStatus.OPEN,
    });
    const missingTimestamp = await createVisit(fixture, {
      diagnosis: null,
      startedAt: null,
      status: VisitStatus.OPEN,
    });
    const tiedIds = [firstTiedVisit.visit.id, secondTiedVisit.visit.id].sort();

    const ascending = await fixture.agent
      .get(`${fixture.route}?sortOrder=ASC`)
      .expect(200);
    expect(visitListBody(ascending).items.map((item) => item.id)).toEqual([
      ...tiedIds,
      missingTimestamp.visit.id,
    ]);

    const descending = await fixture.agent
      .get(`${fixture.route}?sortOrder=DESC`)
      .expect(200);
    expect(visitListBody(descending).items.map((item) => item.id)).toEqual([
      ...tiedIds.reverse(),
      missingTimestamp.visit.id,
    ]);
  });

  it('enforces permission and tenant/branch/patient isolation with scoped 404s', async () => {
    const fixture = await createFixture('patient-visits-scope');
    const scopedVisit = await createVisit(fixture, {
      diagnosis: 'Synthetic scoped diagnosis',
      startedAt: new Date('2026-05-01T02:00:00.000Z'),
      status: VisitStatus.COMPLETED,
    });
    const otherPatient = await createPatient(fixture.tenant, 'Other Patient');
    const otherPatientVisit = await createVisit(
      { ...fixture, patient: otherPatient },
      {
        diagnosis: 'Synthetic other Patient diagnosis',
        startedAt: new Date('2026-05-02T02:00:00.000Z'),
        status: VisitStatus.COMPLETED,
      },
    );
    await fixture.agent
      .get(fixture.route)
      .expect(200)
      .expect((response) => {
        const body = visitListBody(response);
        expect(body.meta.total).toBe(1);
        expect(body.items[0].id).toBe(scopedVisit.visit.id);
      });
    await fixture.agent
      .get(patientVisitRoute(fixture.tenant, fixture.branch, otherPatient.id))
      .expect(200)
      .expect((response) => {
        const body = visitListBody(response);
        expect(body.meta.total).toBe(1);
        expect(body.items[0].id).toBe(otherPatientVisit.visit.id);
      });

    const siblingBranch = await authFixtures.createBranch(fixture.tenant, {
      slug: `sibling-${randomUUID()}`,
    });
    await authFixtures.grantBranchRole(
      fixture.receptionist,
      siblingBranch,
      TenantRoleCode.RECEPTIONIST,
    );
    const siblingDentist = await createDentist(
      siblingBranch,
      'Sibling Branch Dentist',
    );
    const siblingOperatory = await dataSource.manager.save(
      dataSource.manager.create(Operatory, {
        tenantId: fixture.tenant.id,
        branchId: siblingBranch.id,
        code: `SIBLING-${randomUUID()}`,
        name: 'Synthetic Sibling Chair',
        type: OperatoryType.CHAIR,
        isActive: true,
      }),
    );
    const siblingVisit = await createVisit(
      {
        ...fixture,
        branch: siblingBranch,
        dentist: siblingDentist,
        operatory: siblingOperatory,
      },
      {
        diagnosis: 'Synthetic sibling branch diagnosis',
        startedAt: new Date('2026-05-03T02:00:00.000Z'),
        status: VisitStatus.COMPLETED,
      },
    );
    await fixture.agent
      .get(fixture.route)
      .expect(200)
      .expect((response) => {
        const body = visitListBody(response);
        expect(body.meta.total).toBe(1);
        expect(body.items[0].id).toBe(scopedVisit.visit.id);
      });
    await fixture.agent
      .get(patientVisitRoute(fixture.tenant, siblingBranch, fixture.patient.id))
      .expect(200)
      .expect((response) => {
        const body = visitListBody(response);
        expect(body.meta.total).toBe(1);
        expect(body.items[0].id).toBe(siblingVisit.visit.id);
      });

    const otherBranch = await authFixtures.createBranch(fixture.tenant, {
      slug: `other-${randomUUID()}`,
    });
    await fixture.agent
      .get(patientVisitRoute(fixture.tenant, otherBranch, fixture.patient.id))
      .expect(403);

    const unauthorized = await createDentist(
      fixture.branch,
      'Unauthorized Dentist',
    );
    await unauthorized.agent.get(fixture.route).expect(403);

    const otherTenant = await authFixtures.createTenant({
      slug: `other-${randomUUID()}`,
    });
    const otherTenantPatient = await createPatient(
      otherTenant,
      'Other Tenant Patient',
    );
    await fixture.agent
      .get(
        patientVisitRoute(
          fixture.tenant,
          fixture.branch,
          otherTenantPatient.id,
        ),
      )
      .expect(404);
    await fixture.agent
      .get(patientVisitRoute(fixture.tenant, fixture.branch, randomUUID()))
      .expect(404);

    await requestUnauthenticated(fixture.route).expect(401);
  });

  async function createFixture(suffix: string) {
    const tenant = await authFixtures.createTenant({
      slug: `${suffix}-${randomUUID()}`,
    });
    const branch = await authFixtures.createBranch(tenant, {
      slug: `branch-${randomUUID()}`,
    });
    const receptionist = await authFixtures.createUser({
      email: `reception-${randomUUID()}@patient-visits.test`,
      fullName: 'Synthetic Receptionist',
    });
    await authFixtures.grantBranchRole(
      receptionist,
      branch,
      TenantRoleCode.RECEPTIONIST,
    );
    const session = await loginAs(app, {
      email: receptionist.email,
      password: PASSWORD,
    });
    const dentist = await createDentist(branch, 'Synthetic Historical Dentist');
    const patient = await createPatient(
      tenant,
      'Synthetic Visit History Patient',
    );
    const operatory = await dataSource.manager.save(
      dataSource.manager.create(Operatory, {
        tenantId: tenant.id,
        branchId: branch.id,
        code: `CHAIR-${randomUUID()}`,
        name: 'Synthetic Historical Chair',
        type: OperatoryType.CHAIR,
        isActive: true,
      }),
    );
    return {
      tenant,
      branch,
      receptionist,
      agent: session.agent,
      dentist,
      patient,
      operatory,
      route: patientVisitRoute(tenant, branch, patient.id),
    };
  }

  async function createDentist(branch: Branch, fullName: string) {
    const user = await authFixtures.createUser({
      email: `dentist-${randomUUID()}@patient-visits.test`,
      fullName,
    });
    const assignment = await authFixtures.grantBranchRole(
      user,
      branch,
      TenantRoleCode.DENTIST,
    );
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    return { user, assignment, agent: session.agent };
  }

  async function createPatient(
    tenant: Tenant,
    fullName: string,
  ): Promise<Patient> {
    const digits = randomUUID().replace(/\D/g, '').padEnd(9, '0').slice(0, 9);
    return dataSource.manager.save(
      dataSource.manager.create(Patient, {
        tenantId: tenant.id,
        fullName,
        phone: `09${digits}`,
        phoneNormalized: `+849${digits}`,
        email: null,
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

  async function createVisit(
    fixture: Awaited<ReturnType<typeof createFixture>>,
    input: {
      dentist?: User;
      diagnosis: string | null;
      startedAt: Date | null;
      completedAt?: Date;
      status: VisitStatus;
    },
  ) {
    const dentist = input.dentist ?? fixture.dentist.user;
    const sequence = await appointments.count({
      where: { tenantId: fixture.tenant.id, branchId: fixture.branch.id },
    });
    const scheduledStart = new Date(Date.UTC(2030, 0, sequence + 1, 2, 0, 0));
    const appointment = await appointments.save(
      appointments.create({
        tenantId: fixture.tenant.id,
        branchId: fixture.branch.id,
        patientId: fixture.patient.id,
        status:
          input.status === VisitStatus.COMPLETED
            ? AppointmentStatus.COMPLETED
            : AppointmentStatus.IN_PROGRESS,
        source: AppointmentSource.PHONE,
        startAt: scheduledStart,
        endAt: new Date(scheduledStart.getTime() + 30 * 60_000),
        assignedDentistUserId: dentist.id,
        operatoryId: fixture.operatory.id,
        serviceId: null,
        serviceCode: null,
        serviceName: null,
        serviceAmount: null,
        serviceCurrency: null,
        serviceDurationMinutes: null,
        visitReason: 'Synthetic patient Visit history',
        operationalNote: null,
      }),
    );
    const visit = await visits.save(
      visits.create({
        tenantId: fixture.tenant.id,
        branchId: fixture.branch.id,
        appointmentId: appointment.id,
        openedByUserId: dentist.id,
        status: input.status,
        symptoms: null,
        relevantHistory: null,
        examination: null,
        diagnosis: input.diagnosis,
        clinicalNote: null,
      }),
    );
    if (input.startedAt) {
      await transitions.save(
        transitions.create({
          appointmentId: appointment.id,
          tenantId: fixture.tenant.id,
          branchId: fixture.branch.id,
          fromStatus: AppointmentStatus.CHECKED_IN,
          toStatus: AppointmentStatus.IN_PROGRESS,
          reasonCode: null,
          changedByUserId: dentist.id,
          occurredAt: input.startedAt,
        }),
      );
    }
    if (input.status === VisitStatus.COMPLETED) {
      const completedAt =
        input.completedAt ??
        new Date((input.startedAt?.getTime() ?? Date.now()) + 30 * 60_000);
      await transitions.save(
        transitions.create({
          appointmentId: appointment.id,
          tenantId: fixture.tenant.id,
          branchId: fixture.branch.id,
          fromStatus: AppointmentStatus.IN_PROGRESS,
          toStatus: AppointmentStatus.COMPLETED,
          reasonCode: null,
          changedByUserId: dentist.id,
          occurredAt: completedAt,
        }),
      );
    }
    return { appointment, visit };
  }

  function patientVisitRoute(
    tenant: Pick<Tenant, 'slug'>,
    branch: Pick<Branch, 'slug'>,
    patientId: string,
  ) {
    return `/tenants/${tenant.slug}/branches/${branch.slug}/patients/${patientId}/visits`;
  }

  function requestUnauthenticated(route: string) {
    return request(app.getHttpServer() as Server).get(route);
  }
});
