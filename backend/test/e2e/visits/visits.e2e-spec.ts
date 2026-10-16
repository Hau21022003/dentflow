import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { TreatmentNote } from 'src/modules/visits/entities/treatment-note.entity';
import { Visit, VisitStatus } from 'src/modules/visits/entities/visit.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource, Repository } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-visit-workflow-password';

describe('Visit workflow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authFixtures: ReturnType<typeof createAuthFixtures>;
  let appointments: Repository<Appointment>;
  let visits: Repository<Visit>;
  let treatmentNotes: Repository<TreatmentNote>;
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
    visits = dataSource.getRepository(Visit);
    treatmentNotes = dataSource.getRepository(TreatmentNote);
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

  it('starts, edits, completes, and adds an immutable addendum without auditing clinical content', async () => {
    const fixture = await createFixture('visit-core');
    const appointment = await createAppointment(fixture, {
      status: AppointmentStatus.CHECKED_IN,
      assignedDentistUserId: fixture.dentist.user.id,
    });
    const startKey = randomUUID();

    const started = await fixture.dentist.agent
      .post(`${fixture.route}/${appointment.id}/start`)
      .set('Idempotency-Key', startKey)
      .expect(201);
    expect(started.body).toMatchObject({
      appointmentId: appointment.id,
      status: VisitStatus.OPEN,
      symptoms: null,
      addenda: [],
    });
    await fixture.dentist.agent
      .post(`${fixture.route}/${appointment.id}/start`)
      .set('Idempotency-Key', startKey)
      .expect(201)
      .expect('Idempotency-Replayed', 'true');

    const visitId = (started.body as { id: string }).id;
    await expect(visits.countBy({ tenantId: fixture.tenant.id })).resolves.toBe(
      1,
    );
    await expect(
      appointments.findOneByOrFail({ id: appointment.id }),
    ).resolves.toMatchObject({
      status: AppointmentStatus.IN_PROGRESS,
    });
    await expect(
      transitions.findBy({ appointmentId: appointment.id }),
    ).resolves.toEqual([
      expect.objectContaining({
        fromStatus: AppointmentStatus.CHECKED_IN,
        toStatus: AppointmentStatus.IN_PROGRESS,
        changedByUserId: fixture.dentist.user.id,
      }),
    ]);

    const clinicalText = 'Synthetic pain in tooth 26';
    await fixture.dentist.agent
      .patch(`${fixture.route}/${appointment.id}/visit`)
      .set('Idempotency-Key', randomUUID())
      .send({ symptoms: clinicalText, diagnosis: 'Synthetic caries diagnosis' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: visitId,
          symptoms: clinicalText,
          diagnosis: 'Synthetic caries diagnosis',
        });
      });

    await fixture.dentist.agent
      .post(`${fixture.route}/${appointment.id}/visit/complete`)
      .set('Idempotency-Key', randomUUID())
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ status: VisitStatus.COMPLETED });
      });
    await expect(
      appointments.findOneByOrFail({ id: appointment.id }),
    ).resolves.toMatchObject({
      status: AppointmentStatus.COMPLETED,
    });
    await expect(
      transitions.findBy({ appointmentId: appointment.id }),
    ).resolves.toHaveLength(2);

    await fixture.dentist.agent
      .patch(`${fixture.route}/${appointment.id}/visit`)
      .set('Idempotency-Key', randomUUID())
      .send({ symptoms: 'Attempt to overwrite clinical history' })
      .expect(409);
    const addendumText = 'Synthetic addendum after completion';
    const completed = await fixture.dentist.agent
      .post(`${fixture.route}/${appointment.id}/visit/addenda`)
      .set('Idempotency-Key', randomUUID())
      .send({ content: addendumText })
      .expect(201);
    const completedBody = completed.body as {
      addenda: Array<{
        content: string;
        author: { id: string; fullName: string };
      }>;
    };
    expect(completedBody.addenda).toHaveLength(1);
    expect(completedBody.addenda[0]?.content).toBe(addendumText);
    expect(completedBody.addenda[0]?.author.id).toBe(fixture.dentist.user.id);
    const note = await treatmentNotes.findOneByOrFail({ visitId });
    await expect(
      treatmentNotes.update({ id: note.id }, { content: 'Mutation attempt' }),
    ).rejects.toThrow('treatment_notes are append-only');

    const audit = await auditLogs.find({
      where: { resourceId: visitId },
      order: { occurredAt: 'ASC' },
    });
    expect(audit.map((record) => record.action)).toEqual(
      expect.arrayContaining([
        AuditAction.VISIT_OPENED,
        AuditAction.VISIT_UPDATED,
        AuditAction.VISIT_COMPLETED,
      ]),
    );
    expect(JSON.stringify(audit)).not.toContain(clinicalText);
    expect(JSON.stringify(audit)).not.toContain(addendumText);
    const noteAudit = await auditLogs.findOneByOrFail({
      action: AuditAction.TREATMENT_NOTE_ADDED,
      resourceId: note.id,
    });
    expect(noteAudit.after).toMatchObject({ visitId });
  });

  it('enforces check-in, assigned-Dentist ownership, Visit locking, blank completion, and branch scope', async () => {
    const fixture = await createFixture('visit-access');
    const otherDentist = await createActor(
      fixture.branch,
      TenantRoleCode.DENTIST,
    );
    const checkedIn = await createAppointment(fixture, {
      status: AppointmentStatus.CHECKED_IN,
      assignedDentistUserId: fixture.dentist.user.id,
    });
    const route = `${fixture.route}/${checkedIn.id}`;

    await otherDentist.agent
      .post(`${route}/start`)
      .set('Idempotency-Key', randomUUID())
      .expect(403);
    await fixture.receptionist.agent
      .post(`${route}/start`)
      .set('Idempotency-Key', randomUUID())
      .expect(403);
    await fixture.dentist.agent.get(`${route}/visit`).expect(404);
    await fixture.dentist.agent
      .post(`${route}/start`)
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    await fixture.dentist.agent
      .post(`${route}/start`)
      .set('Idempotency-Key', randomUUID())
      .expect(409);
    await otherDentist.agent.get(`${route}/visit`).expect(403);
    await fixture.branchAdmin.agent.get(`${route}/visit`).expect(403);
    await fixture.dentist.agent
      .post(`${route}/visit/complete`)
      .set('Idempotency-Key', randomUUID())
      .expect(422);
    await fixture.dentist.agent
      .post(`${route}/visit/addenda`)
      .set('Idempotency-Key', randomUUID())
      .send({ content: 'Cannot add while open' })
      .expect(409);

    const booked = await createAppointment(fixture, {
      status: AppointmentStatus.BOOKED,
      assignedDentistUserId: fixture.dentist.user.id,
      startAt: '2026-10-12T04:00:00.000Z',
      endAt: '2026-10-12T05:00:00.000Z',
    });
    await fixture.dentist.agent
      .post(`${fixture.route}/${booked.id}/start`)
      .set('Idempotency-Key', randomUUID())
      .expect(409);
    const unassigned = await createAppointment(fixture, {
      status: AppointmentStatus.CHECKED_IN,
      assignedDentistUserId: null,
    });
    await fixture.dentist.agent
      .post(`${fixture.route}/${unassigned.id}/start`)
      .set('Idempotency-Key', randomUUID())
      .expect(403);
    await fixture.dentist.agent
      .get(`${fixture.route}/${randomUUID()}/visit`)
      .expect(404);

    const otherTenant = await authFixtures.createTenant({
      slug: 'visit-other-tenant',
    });
    const otherBranch = await authFixtures.createBranch(otherTenant, {
      slug: 'main',
    });
    await fixture.dentist.agent
      .get(
        `/tenants/${otherTenant.slug}/branches/${otherBranch.slug}/appointments/${checkedIn.id}/visit`,
      )
      .expect(403);
  });

  it('lets only an assigned Dentist manage Patient Alerts without leaking message content to audit', async () => {
    const fixture = await createFixture('patient-alert-access');
    const assignedAppointment = await createAppointment(fixture, {
      status: AppointmentStatus.BOOKED,
      assignedDentistUserId: fixture.dentist.user.id,
    });
    const otherDentist = await createActor(
      fixture.branch,
      TenantRoleCode.DENTIST,
    );
    const patientRoute = `/tenants/${fixture.tenant.slug}/branches/${fixture.branch.slug}/patients/${fixture.patient.id}`;
    const alertPayload = {
      category: 'ALLERGY',
      severity: 'CRITICAL',
      message: 'Synthetic penicillin allergy',
    };

    await fixture.branchAdmin.agent
      .post(`${patientRoute}/alerts`)
      .set('Idempotency-Key', randomUUID())
      .send(alertPayload)
      .expect(403);
    await otherDentist.agent
      .post(`${patientRoute}/alerts`)
      .set('Idempotency-Key', randomUUID())
      .send(alertPayload)
      .expect(403);

    const createKey = randomUUID();
    const created = await fixture.dentist.agent
      .post(`${patientRoute}/alerts`)
      .set('Idempotency-Key', createKey)
      .send(alertPayload)
      .expect(201);
    expect(created.body).toMatchObject({
      ...alertPayload,
      updatedBy: {
        id: fixture.dentist.user.id,
        fullName: fixture.dentist.user.fullName,
      },
    });
    await fixture.dentist.agent
      .post(`${patientRoute}/alerts`)
      .set('Idempotency-Key', createKey)
      .send(alertPayload)
      .expect(201)
      .expect('Idempotency-Replayed', 'true');
    const alertId = (created.body as { id: string }).id;

    await fixture.receptionist.agent
      .get(`${patientRoute}/overview`)
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          activeAlerts: Array<Record<string, unknown>>;
        };
        expect(body.activeAlerts).toEqual([
          expect.objectContaining({
            id: alertId,
            category: 'ALLERGY',
            severity: 'CRITICAL',
            message: alertPayload.message,
          }),
        ]);
      });

    const updatedMessage = 'Synthetic severe penicillin allergy';
    const updated = await fixture.dentist.agent
      .patch(`${patientRoute}/alerts/${alertId}`)
      .set('Idempotency-Key', randomUUID())
      .send({ ...alertPayload, message: updatedMessage })
      .expect(200);
    const updatedBody = updated.body as {
      updatedAt: string;
      updatedBy: { id: string; fullName: string };
    };
    expect(updatedBody).toMatchObject({
      id: alertId,
      message: updatedMessage,
      updatedBy: {
        id: fixture.dentist.user.id,
        fullName: fixture.dentist.user.fullName,
      },
    });
    const noOpUpdate = await fixture.dentist.agent
      .patch(`${patientRoute}/alerts/${alertId}`)
      .set('Idempotency-Key', randomUUID())
      .send({ ...alertPayload, message: updatedMessage })
      .expect(200);
    expect(noOpUpdate.body).toMatchObject({
      updatedAt: updatedBody.updatedAt,
      updatedBy: updatedBody.updatedBy,
    });
    await fixture.dentist.agent
      .get(`${patientRoute}/alerts`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: Array<Record<string, unknown>> };
        expect(body.items).toEqual([
          expect.objectContaining({
            id: alertId,
            message: updatedMessage,
            updatedBy: {
              id: fixture.dentist.user.id,
              fullName: fixture.dentist.user.fullName,
            },
          }),
        ]);
      });
    const alertAudits = await auditLogs.find({
      where: { resourceId: alertId },
    });
    expect(alertAudits.map((record) => record.action)).toEqual(
      expect.arrayContaining([
        AuditAction.PATIENT_ALERT_CREATED,
        AuditAction.PATIENT_ALERT_UPDATED,
      ]),
    );
    expect(JSON.stringify(alertAudits)).not.toContain(alertPayload.message);
    expect(JSON.stringify(alertAudits)).not.toContain(updatedMessage);

    const resolveKey = randomUUID();
    const resolved = await fixture.dentist.agent
      .post(`${patientRoute}/alerts/${alertId}/resolve`)
      .set('Idempotency-Key', resolveKey)
      .send({ reasonCode: 'NO_LONGER_APPLICABLE' })
      .expect(200);
    expect(resolved.body).toMatchObject({
      id: alertId,
      updatedBy: {
        id: fixture.dentist.user.id,
        fullName: fixture.dentist.user.fullName,
      },
    });
    await fixture.dentist.agent
      .post(`${patientRoute}/alerts/${alertId}/resolve`)
      .set('Idempotency-Key', resolveKey)
      .send({ reasonCode: 'NO_LONGER_APPLICABLE' })
      .expect(200)
      .expect('Idempotency-Replayed', 'true');
    await fixture.receptionist.agent
      .get(`${patientRoute}/overview`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { activeAlerts: unknown[] };
        expect(body.activeAlerts).toEqual([]);
      });

    await appointments.update(
      { id: assignedAppointment.id },
      { status: AppointmentStatus.CANCELLED },
    );
    await fixture.dentist.agent
      .post(`${patientRoute}/alerts`)
      .set('Idempotency-Key', randomUUID())
      .send(alertPayload)
      .expect(403);
  });

  async function createFixture(slug: string) {
    const tenant = await authFixtures.createTenant({ slug });
    const branch = await authFixtures.createBranch(tenant, { slug: 'main' });
    const receptionist = await createActor(branch, TenantRoleCode.RECEPTIONIST);
    const branchAdmin = await createActor(branch, TenantRoleCode.BRANCH_ADMIN);
    const dentist = await createActor(branch, TenantRoleCode.DENTIST);
    const patient = await createPatient(tenant, 'Synthetic Visit Patient');
    return {
      tenant,
      branch,
      receptionist,
      branchAdmin,
      dentist,
      patient,
      route: `/tenants/${tenant.slug}/branches/${branch.slug}/appointments`,
    };
  }

  async function createActor(
    branch: Branch,
    role: Exclude<TenantRoleCode, TenantRoleCode.TENANT_ADMIN>,
  ): Promise<{ user: User; agent: ReturnType<typeof request.agent> }> {
    const user = await authFixtures.createUser({
      email: `user-${randomUUID()}@visits.example.com`,
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

  async function createAppointment(
    fixture: Awaited<ReturnType<typeof createFixture>>,
    input: {
      status: AppointmentStatus;
      assignedDentistUserId: string | null;
      startAt?: string;
      endAt?: string;
    },
  ): Promise<Appointment> {
    return appointments.save(
      appointments.create({
        tenantId: fixture.tenant.id,
        branchId: fixture.branch.id,
        patientId: fixture.patient.id,
        status: input.status,
        source: AppointmentSource.WALK_IN,
        startAt: new Date(input.startAt ?? '2026-10-12T02:00:00.000Z'),
        endAt: new Date(input.endAt ?? '2026-10-12T03:00:00.000Z'),
        assignedDentistUserId: input.assignedDentistUserId,
        serviceId: null,
        serviceCode: null,
        serviceName: null,
        serviceAmount: null,
        serviceCurrency: null,
        serviceDurationMinutes: null,
        visitReason: 'Synthetic examination',
        operationalNote: null,
      }),
    );
  }
});
