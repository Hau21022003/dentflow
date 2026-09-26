import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from 'src/config/app-config.service';
import {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
} from 'src/modules/appointments/entities/appointment.entity';
import { TenantRoleCode } from 'src/modules/authorization/entities/role-assignment.entity';
import { Branch } from 'src/modules/branches/entities/branch.entity';
import {
  Patient,
  PatientGender,
} from 'src/modules/patients/entities/patient.entity';
import { ServiceGroup } from 'src/modules/service-groups/entities/service-group.entity';
import { Service } from 'src/modules/services/entities/service.entity';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { TreatmentItemEvent } from 'src/modules/treatment-plans/entities/treatment-item-event.entity';
import { TreatmentPlanStatus } from 'src/modules/treatment-plans/entities/treatment-plan.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Visit, VisitStatus } from 'src/modules/visits/entities/visit.entity';
import request from 'supertest';
import { createAuthFixtures } from 'test/fixtures/auth.fixture';
import { loginAs } from 'test/helpers/auth.helper';
import { resetDbToBaseState } from 'test/helpers/db.helper';
import { DataSource } from 'typeorm';
import { closeApp, initApp } from '../../app.setup';

const PASSWORD = 'synthetic-treatment-password';

describe('Treatment plan V1 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let fixtures: ReturnType<typeof createAuthFixtures>;

  beforeAll(async () => {
    app = await initApp();
    dataSource = app.get(DataSource);
    fixtures = createAuthFixtures({
      manager: dataSource.manager,
      password: PASSWORD,
      bcryptSaltRounds:
        app.get(AppConfigService).securityConfig.bcryptSaltRounds,
    });
    await dataSource.runMigrations();
  });
  beforeEach(async () => resetDbToBaseState(app));
  afterAll(async () => closeApp());

  it('creates, synchronizes, accepts, and records an append-only execution event without leaking clinical content to reception', async () => {
    const tenant = await fixtures.createTenant({
      slug: `treatment-${randomUUID().slice(0, 8)}`,
    });
    const branch = await fixtures.createBranch(tenant, { slug: 'main' });
    const dentist = await actor(branch, TenantRoleCode.DENTIST);
    const receptionist = await actor(branch, TenantRoleCode.RECEPTIONIST);
    const patient = await dataSource.manager.save(
      dataSource.manager.create(Patient, {
        tenantId: tenant.id,
        fullName: 'Synthetic Treatment Patient',
        phone: '+84911111111',
        phoneNormalized: '+84911111111',
        gender: PatientGender.OTHER,
        dateOfBirth: null,
        address: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelationship: null,
        referralSource: null,
      }),
    );
    const serviceGroup = await dataSource.manager.save(
      dataSource.manager.create(ServiceGroup, {
        tenantId: tenant.id,
        name: 'Synthetic treatment group',
        isActive: true,
      }),
    );
    const service = await dataSource.manager.save(
      dataSource.manager.create(Service, {
        tenantId: tenant.id,
        code: 'synthetic-cleaning',
        name: 'Synthetic cleaning',
        serviceGroupId: serviceGroup.id,
        amount: 120000,
        currency: 'VND',
        durationMinutes: 30,
        isActive: true,
      }),
    );
    const appointment = await dataSource.manager.save(
      dataSource.manager.create(Appointment, {
        tenantId: tenant.id,
        branchId: branch.id,
        patientId: patient.id,
        status: AppointmentStatus.IN_PROGRESS,
        source: AppointmentSource.WALK_IN,
        startAt: new Date('2026-10-12T02:00:00.000Z'),
        endAt: new Date('2026-10-12T03:00:00.000Z'),
        assignedDentistUserId: dentist.user.id,
        serviceId: null,
        serviceCode: null,
        serviceName: null,
        serviceAmount: null,
        serviceCurrency: null,
        serviceDurationMinutes: null,
        visitReason: 'Synthetic treatment',
        operationalNote: null,
      }),
    );
    const visit = await dataSource.manager.save(
      dataSource.manager.create(Visit, {
        tenantId: tenant.id,
        branchId: branch.id,
        appointmentId: appointment.id,
        openedByUserId: dentist.user.id,
        status: VisitStatus.OPEN,
        symptoms: null,
        relevantHistory: null,
        examination: null,
        diagnosis: null,
        clinicalNote: null,
      }),
    );
    const root = `/tenants/${tenant.slug}/branches/${branch.slug}`;

    const created = await dentist.agent
      .post(`${root}/visits/${visit.id}/treatment-plans`)
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    const planId = (created.body as { id: string }).id;
    await dentist.agent
      .patch(`${root}/visits/${visit.id}/treatment-plans/${planId}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        items: [
          {
            serviceId: service.id,
            quantity: 1,
            discountAmount: 20000,
            toothPosition: '26',
            indication: 'Synthetic indication',
            plannedDentistUserId: dentist.user.id,
          },
        ],
      })
      .expect(200)
      .expect((response) =>
        expect(response.body.items[0]).toMatchObject({
          serviceName: service.name,
          finalUnitAmount: 100000,
          toothPosition: '26',
        }),
      );
    await dentist.agent
      .post(`${root}/visits/${visit.id}/treatment-plans/${planId}/propose`)
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    await dentist.agent
      .post(`${root}/visits/${visit.id}/treatment-plans`)
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    await dentist.agent
      .get(`${root}/treatment-plan-acceptances`)
      .expect(403);
    const queue = await receptionist.agent
      .get(`${root}/treatment-plan-acceptances?page=1&limit=10`)
      .expect(200);
    expect(queue.body.meta).toMatchObject({ page: 1, limit: 10, total: 1 });
    expect(queue.body.items).toEqual([
      expect.objectContaining({
        id: planId,
        patient: { fullName: patient.fullName, phone: patient.phone },
        status: TreatmentPlanStatus.PROPOSED,
      }),
    ]);
    const queuePayload = JSON.stringify(queue.body);
    [
      'Synthetic indication',
      service.name,
      service.code,
      '100000',
      'toothPosition',
      'plannedDentistUserId',
    ].forEach((forbidden) => expect(queuePayload).not.toContain(forbidden));
    expect(queue.body.items[0]).not.toHaveProperty('items');
    const otherBranch = await fixtures.createBranch(tenant, { slug: 'other' });
    const otherBranchReceptionist = await actor(
      otherBranch,
      TenantRoleCode.RECEPTIONIST,
    );
    await otherBranchReceptionist.agent
      .get(`/tenants/${tenant.slug}/branches/${otherBranch.slug}/treatment-plan-acceptances`)
      .expect(200)
      .expect((response) => expect(response.body.items).toHaveLength(0));
    const otherTenant = await fixtures.createTenant({
      slug: `other-${randomUUID().slice(0, 8)}`,
    });
    const otherTenantBranch = await fixtures.createBranch(otherTenant, {
      slug: 'main',
    });
    const otherTenantReceptionist = await actor(
      otherTenantBranch,
      TenantRoleCode.RECEPTIONIST,
    );
    await otherTenantReceptionist.agent
      .get(`/tenants/${otherTenant.slug}/branches/${otherTenantBranch.slug}/treatment-plan-acceptances`)
      .expect(200)
      .expect((response) => expect(response.body.items).toHaveLength(0));
    const acceptKey = randomUUID();
    const receipt = await receptionist.agent
      .post(`${root}/treatment-plans/${planId}/accept`)
      .set('Idempotency-Key', acceptKey)
      .expect(200);
    expect(receipt.body).toEqual(
      expect.objectContaining({
        id: planId,
        status: TreatmentPlanStatus.ACCEPTED,
        acceptedByUserId: receptionist.user.id,
      }),
    );
    expect(JSON.stringify(receipt.body)).not.toContain('Synthetic indication');
    expect(JSON.stringify(receipt.body)).not.toContain(service.name);
    await receptionist.agent
      .post(`${root}/treatment-plans/${planId}/accept`)
      .set('Idempotency-Key', acceptKey)
      .expect(200)
      .expect((response) => expect(response.body).toEqual(receipt.body));
    await receptionist.agent
      .get(`${root}/treatment-plan-acceptances`)
      .expect(200)
      .expect((response) => expect(response.body.items).toHaveLength(0));
    const detail = await dentist.agent
      .get(`${root}/visits/${visit.id}/treatment-plans/${planId}`)
      .expect(200);
    const itemId = detail.body.items[0].id as string;
    await dentist.agent
      .post(
        `${root}/visits/${visit.id}/treatment-plans/${planId}/items/${itemId}/events`,
      )
      .set('Idempotency-Key', randomUUID())
      .send({ eventType: 'IN_PROGRESS' })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          itemStatus: 'IN_PROGRESS',
          planStatus: TreatmentPlanStatus.ACCEPTED,
        }),
      );
    const event = await dataSource
      .getRepository(TreatmentItemEvent)
      .findOneByOrFail({ treatmentItemId: itemId });
    await expect(
      dataSource.getRepository(TreatmentItemEvent).delete(event.id),
    ).rejects.toThrow('treatment_item_events are append-only');
  });

  async function actor(
    branch: Branch,
    role: Exclude<TenantRoleCode, TenantRoleCode.TENANT_ADMIN>,
  ) {
    const user = await fixtures.createUser({
      email: `${role.toLowerCase()}-${randomUUID()}@example.test`,
      fullName: `Synthetic ${role}`,
    });
    await fixtures.grantBranchRole(user, branch, role);
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    return { user, agent: session.agent };
  }
});
