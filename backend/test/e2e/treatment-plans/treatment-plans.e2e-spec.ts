import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from 'src/config/app-config.service';
import { AuditAction } from 'src/modules/audit';
import { AuditLog } from 'src/modules/audit/entities/audit-log.entity';
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
import { TreatmentItemEvent } from 'src/modules/treatment-plans/entities/treatment-item-event.entity';
import { TreatmentItemEventImage } from 'src/modules/treatment-plans/entities/treatment-item-event-image.entity';
import { TreatmentItemStatus } from 'src/modules/treatment-plans/entities/treatment-item.entity';
import { TreatmentPlanStatus } from 'src/modules/treatment-plans/entities/treatment-plan.entity';
import { Visit, VisitStatus } from 'src/modules/visits/entities/visit.entity';
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
    const secondDentist = await actor(
      branch,
      TenantRoleCode.DENTIST,
      'Synthetic Treatment Specialist',
    );
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
    const usdService = await dataSource.manager.save(
      dataSource.manager.create(Service, {
        tenantId: tenant.id,
        code: 'synthetic-whitening',
        name: 'Synthetic whitening',
        serviceGroupId: serviceGroup.id,
        amount: 5000,
        currency: 'USD',
        durationMinutes: 45,
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
          {
            serviceId: usdService.id,
            quantity: 2,
            discountAmount: 500,
            toothPosition: null,
            indication: 'Synthetic whitening indication',
            plannedDentistUserId: secondDentist.user.id,
          },
        ],
      })
      .expect(200)
      .expect((response) =>
        expect(response.body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              serviceName: service.name,
              finalUnitAmount: 100000,
              toothPosition: '26',
            }),
            expect.objectContaining({
              serviceName: usdService.name,
              finalUnitAmount: 4500,
            }),
          ]),
        ),
      );
    await dentist.agent
      .post(`${root}/visits/${visit.id}/treatment-plans/${planId}/propose`)
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    await dentist.agent
      .post(`${root}/visits/${visit.id}/treatment-plans`)
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    const visitPlansRoute = `${root}/visits/${visit.id}/treatment-plans`;
    const visitPlans = await dentist.agent
      .get(`${visitPlansRoute}?page=1&limit=10`)
      .expect(200);
    expect(visitPlans.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
    expect(visitPlans.body.items[0]).toMatchObject({
      code: 'TP-0002',
      status: TreatmentPlanStatus.DRAFT,
      plannedDentists: [],
      items: [],
    });
    expect(visitPlans.body.items[1]).toMatchObject({
      id: planId,
      code: 'TP-0001',
      status: TreatmentPlanStatus.PROPOSED,
    });
    expect(visitPlans.body.items[1].plannedDentists).toEqual(
      expect.arrayContaining([
        { id: dentist.user.id, fullName: dentist.user.fullName },
        {
          id: secondDentist.user.id,
          fullName: secondDentist.user.fullName,
        },
      ]),
    );
    expect(visitPlans.body.items[1].plannedDentists).toHaveLength(2);
    await dentist.agent
      .get(`${visitPlansRoute}?search=whitening%20indication`)
      .expect(200)
      .expect((response) => {
        expect(response.body.meta.total).toBe(1);
        expect(response.body.items[0].id).toBe(planId);
      });
    await dentist.agent
      .get(`${visitPlansRoute}?status=DRAFT`)
      .expect(200)
      .expect((response) => {
        expect(response.body.meta.total).toBe(1);
        expect(response.body.items[0].code).toBe('TP-0002');
      });
    await secondDentist.agent.get(visitPlansRoute).expect(403);
    const patientPlansRoute = `${root}/patients/${patient.id}/treatment-plans`;
    const patientPlans = await receptionist.agent
      .get(patientPlansRoute)
      .expect(200);
    expect(patientPlans.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(patientPlans.body.filterOptions.dentists).toEqual(
      expect.arrayContaining([
        { id: dentist.user.id, fullName: dentist.user.fullName },
        {
          id: secondDentist.user.id,
          fullName: secondDentist.user.fullName,
        },
      ]),
    );
    expect(patientPlans.body.filterOptions.dentists).toHaveLength(2);
    expect(patientPlans.body.items[0]).toMatchObject({
      code: 'TP-0002',
      status: TreatmentPlanStatus.DRAFT,
      primaryItem: null,
      plannedDentists: [],
      progress: { completedItems: 0, totalItems: 0 },
      totals: [],
    });
    expect(patientPlans.body.items[1]).toMatchObject({
      id: planId,
      code: 'TP-0001',
      status: TreatmentPlanStatus.PROPOSED,
      originVisit: { id: visit.id },
      progress: { completedItems: 0, totalItems: 2 },
      totals: [
        { currency: 'USD', amount: 9000 },
        { currency: 'VND', amount: 100000 },
      ],
    });
    expect(patientPlans.body.items[1].plannedDentists).toEqual(
      expect.arrayContaining([
        { id: dentist.user.id, fullName: dentist.user.fullName },
        {
          id: secondDentist.user.id,
          fullName: secondDentist.user.fullName,
        },
      ]),
    );
    expect(patientPlans.body.items[1].plannedDentists).toHaveLength(2);
    expect([service.name, usdService.name]).toContain(
      patientPlans.body.items[1].primaryItem.serviceName,
    );
    await receptionist.agent
      .get(`${patientPlansRoute}?search=whitening%20indication`)
      .expect(200)
      .expect((response) => {
        expect(response.body.meta.total).toBe(1);
        expect(response.body.items[0].id).toBe(planId);
      });
    await receptionist.agent
      .get(`${patientPlansRoute}?status=DRAFT`)
      .expect(200)
      .expect((response) => {
        expect(response.body.meta.total).toBe(1);
        expect(response.body.items[0].code).toBe('TP-0002');
      });
    await receptionist.agent
      .get(`${patientPlansRoute}?dentistUserId=${dentist.user.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.meta.total).toBe(1);
        expect(response.body.items[0].id).toBe(planId);
      });
    await receptionist.agent
      .get(`${patientPlansRoute}?sortBy=createdAt&sortOrder=ASC`)
      .expect(200)
      .expect((response) => {
        expect(response.body.items[0].id).toBe(planId);
      });
    await dentist.agent.get(patientPlansRoute).expect(403);
    await dentist.agent.get(`${root}/treatment-plan-acceptances`).expect(403);
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
      .get(
        `/tenants/${tenant.slug}/branches/${otherBranch.slug}/treatment-plan-acceptances`,
      )
      .expect(200)
      .expect((response) => expect(response.body.items).toHaveLength(0));
    await otherBranchReceptionist.agent
      .get(
        `/tenants/${tenant.slug}/branches/${otherBranch.slug}/patients/${patient.id}/treatment-plans`,
      )
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
      .get(
        `/tenants/${otherTenant.slug}/branches/${otherTenantBranch.slug}/treatment-plan-acceptances`,
      )
      .expect(200)
      .expect((response) => expect(response.body.items).toHaveLength(0));
    await otherTenantReceptionist.agent
      .get(
        `/tenants/${otherTenant.slug}/branches/${otherTenantBranch.slug}/patients/${patient.id}/treatment-plans`,
      )
      .expect(404);
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
    await dentist.agent
      .post(`${root}/visits/${visit.id}/treatment-plans/${planId}/cancel`)
      .set('Idempotency-Key', randomUUID())
      .send({ reasonCode: 'PATIENT_REQUEST' })
      .expect(409);
    const progressKey = randomUUID();
    const progressRoute = `${root}/visits/${visit.id}/treatment-plans/${planId}/items/${itemId}/progress-notes`;
    const progressNote = await dentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', progressKey)
      .send({
        content: '  Synthetic progress note\nwith a second line.  ',
        imageObjectKeys: [],
      })
      .expect(200);
    expect(progressNote.body).toMatchObject({
      eventType: 'PROGRESS_NOTE',
      performedByUserId: dentist.user.id,
      performedBy: {
        id: dentist.user.id,
        fullName: dentist.user.fullName,
      },
      content: 'Synthetic progress note\nwith a second line.',
      images: [],
    });
    await dentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', progressKey)
      .send({
        content: '  Synthetic progress note\nwith a second line.  ',
        imageObjectKeys: [],
      })
      .expect(200)
      .expect((response) => expect(response.body).toEqual(progressNote.body));
    await dentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ content: '   ', imageObjectKeys: [] })
      .expect(422);
    await dentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ content: 'x'.repeat(2001), imageObjectKeys: [] })
      .expect(422);
    await dentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', randomUUID())
      .send({
        content: 'Too many images.',
        imageObjectKeys: Array.from(
          { length: 6 },
          (_, index) => `synthetic-${index}`,
        ),
      })
      .expect(422);
    await dentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', randomUUID())
      .send({
        content: 'Duplicate image.',
        imageObjectKeys: ['synthetic-key', 'synthetic-key'],
      })
      .expect(422);
    await dentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', randomUUID())
      .send({
        content: 'Wrong upload scope.',
        imageObjectKeys: [
          `temp/${randomUUID()}/${branch.id}/treatment-progress/${dentist.user.id}/${randomUUID()}.jpg`,
        ],
      })
      .expect(422);
    await dentist.agent
      .post(
        `${root}/visits/${visit.id}/treatment-plans/${planId}/items/${itemId}/events`,
      )
      .set('Idempotency-Key', randomUUID())
      .send({ eventType: 'PROGRESS_NOTE' })
      .expect(422);
    await secondDentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ content: 'Not the assigned dentist.', imageObjectKeys: [] })
      .expect(403);

    const progressAudit = await dataSource.getRepository(AuditLog).findOneBy({
      action: AuditAction.TREATMENT_ITEM_EVENT_RECORDED,
      resourceId: progressNote.body.id as string,
    });
    expect(progressAudit).toMatchObject({
      after: { status: 'IN_PROGRESS', visitId: visit.id },
      metadata: {},
    });
    expect(JSON.stringify(progressAudit)).not.toContain(
      'Synthetic progress note',
    );
    expect(JSON.stringify(progressAudit)).not.toContain('objectKey');

    const oneCharacterNote = await dentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ content: 'x', imageObjectKeys: [] })
      .expect(200);
    expect(oneCharacterNote.body.content).toBe('x');
    const maxLengthNote = await dentist.agent
      .post(progressRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ content: 'x'.repeat(2000), imageObjectKeys: [] })
      .expect(200);
    expect(maxLengthNote.body.content).toHaveLength(2000);

    const secondItemId = detail.body.items[1].id as string;
    await dentist.agent
      .post(
        `${root}/visits/${visit.id}/treatment-plans/${planId}/items/${secondItemId}/progress-notes`,
      )
      .set('Idempotency-Key', randomUUID())
      .send({ content: 'Not allowed while pending.', imageObjectKeys: [] })
      .expect(409);

    await dentist.agent
      .get(
        `${root}/visits/${visit.id}/treatment-plans/${planId}/items/${itemId}/events`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.items).toHaveLength(4);
        expect(response.body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: progressNote.body.id,
              eventType: 'PROGRESS_NOTE',
              content: 'Synthetic progress note\nwith a second line.',
            }),
            expect.objectContaining({ id: oneCharacterNote.body.id }),
            expect.objectContaining({ id: maxLengthNote.body.id }),
          ]),
        );
        expect(response.body.items.at(-1)).toMatchObject({
          eventType: 'IN_PROGRESS',
          content: null,
          images: [],
        });
        const createdAtValues = response.body.items.map(
          (event: { createdAt: string }) => Date.parse(event.createdAt),
        );
        expect(createdAtValues).toEqual(
          [...createdAtValues].sort((left, right) => right - left),
        );
      });
    const persistedEvents = await dataSource
      .getRepository(TreatmentItemEvent)
      .findBy({ treatmentItemId: itemId });
    expect(
      persistedEvents.filter((event) => event.eventType === 'IN_PROGRESS'),
    ).toHaveLength(1);
    expect(
      persistedEvents.filter((event) => event.eventType === 'PROGRESS_NOTE'),
    ).toHaveLength(3);
    const refreshedDetail = await dentist.agent
      .get(`${root}/visits/${visit.id}/treatment-plans/${planId}`)
      .expect(200);
    expect(
      refreshedDetail.body.items.find(
        (candidate: { id: string }) => candidate.id === itemId,
      ).status,
    ).toBe(TreatmentItemStatus.IN_PROGRESS);
    expect(refreshedDetail.body.status).toBe(TreatmentPlanStatus.ACCEPTED);

    const imageRepository = dataSource.getRepository(TreatmentItemEventImage);
    const persistedImage = await imageRepository.save(
      imageRepository.create({
        eventId: progressNote.body.id as string,
        objectKey: `clinical/${tenant.id}/${branch.id}/${patient.id}/treatment-progress/${progressNote.body.id as string}/${randomUUID()}.jpg`,
        contentType: 'image/jpeg',
        sizeBytes: 1,
        sortOrder: 0,
      }),
    );
    await expect(imageRepository.delete(persistedImage.id)).rejects.toThrow(
      'treatment_item_event_images are append-only',
    );

    await expect(
      dataSource
        .getRepository(TreatmentItemEvent)
        .delete(progressNote.body.id as string),
    ).rejects.toThrow('treatment_item_events are append-only');
  }, 15_000);

  it('validates direct cancellation details and records one clinical event per pending item without auditing the note', async () => {
    const tenant = await fixtures.createTenant({
      slug: `cancel-${randomUUID().slice(0, 8)}`,
    });
    const branch = await fixtures.createBranch(tenant, { slug: 'main' });
    const dentist = await actor(branch, TenantRoleCode.DENTIST);
    const receptionist = await actor(branch, TenantRoleCode.RECEPTIONIST);
    const patient = await dataSource.manager.save(
      dataSource.manager.create(Patient, {
        tenantId: tenant.id,
        fullName: 'Synthetic Cancellation Patient',
        phone: '+84912222222',
        phoneNormalized: '+84912222222',
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
        name: 'Synthetic cancellation group',
        isActive: true,
      }),
    );
    const service = await dataSource.manager.save(
      dataSource.manager.create(Service, {
        tenantId: tenant.id,
        code: 'synthetic-cancellation-service',
        name: 'Synthetic cancellation service',
        serviceGroupId: serviceGroup.id,
        amount: 250000,
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
        startAt: new Date('2026-10-18T02:00:00.000Z'),
        endAt: new Date('2026-10-18T03:00:00.000Z'),
        assignedDentistUserId: dentist.user.id,
        serviceId: null,
        serviceCode: null,
        serviceName: null,
        serviceAmount: null,
        serviceCurrency: null,
        serviceDurationMinutes: null,
        visitReason: 'Synthetic cancellation validation',
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
    type CancellationPlanBody = {
      id: string;
      status: TreatmentPlanStatus;
      items: Array<{ id: string; status: TreatmentItemStatus }>;
    };

    const createPlan = async (
      itemCount: number,
      status = TreatmentPlanStatus.DRAFT,
    ): Promise<CancellationPlanBody> => {
      const created = await dentist.agent
        .post(`${root}/visits/${visit.id}/treatment-plans`)
        .set('Idempotency-Key', randomUUID())
        .expect(201);
      const createdBody = created.body as unknown as { id: string };
      const planId = createdBody.id;
      await dentist.agent
        .patch(`${root}/visits/${visit.id}/treatment-plans/${planId}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          items: Array.from({ length: itemCount }, (_, index) => ({
            serviceId: service.id,
            quantity: index + 1,
            discountAmount: 0,
            toothPosition: String(11 + index),
            indication: `Synthetic cancellation indication ${index + 1}`,
            plannedDentistUserId: dentist.user.id,
          })),
        })
        .expect(200);
      if (
        [TreatmentPlanStatus.PROPOSED, TreatmentPlanStatus.ACCEPTED].includes(
          status,
        )
      ) {
        await dentist.agent
          .post(`${root}/visits/${visit.id}/treatment-plans/${planId}/propose`)
          .set('Idempotency-Key', randomUUID())
          .expect(200);
      }
      if (status === TreatmentPlanStatus.ACCEPTED) {
        await receptionist.agent
          .post(`${root}/treatment-plans/${planId}/accept`)
          .set('Idempotency-Key', randomUUID())
          .expect(200);
      }
      const detail = await dentist.agent
        .get(`${root}/visits/${visit.id}/treatment-plans/${planId}`)
        .expect(200);
      const detailBody: unknown = detail.body;
      return detailBody as CancellationPlanBody;
    };

    const plan = await createPlan(2);
    const planId = plan.id;
    const cancelRoute = `${root}/visits/${visit.id}/treatment-plans/${planId}/cancel`;
    await dentist.agent
      .post(cancelRoute)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(422);
    await dentist.agent
      .post(cancelRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ reasonCode: 'patient_request' })
      .expect(422);
    await dentist.agent
      .post(cancelRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ reasonCode: 'OTHER' })
      .expect(422);
    await dentist.agent
      .post(cancelRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ reasonCode: 'OTHER', note: '   ' })
      .expect(422);
    await dentist.agent
      .post(cancelRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ reasonCode: 'OTHER', note: 'x'.repeat(501) })
      .expect(422);

    await dentist.agent
      .get(`${root}/visits/${visit.id}/treatment-plans/${planId}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as CancellationPlanBody;
        expect(body.status).toBe(TreatmentPlanStatus.DRAFT);
        expect(body.items).toHaveLength(2);
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ status: TreatmentItemStatus.PENDING }),
          ]),
        );
      });
    expect(
      await dataSource
        .getRepository(TreatmentItemEvent)
        .countBy({ treatmentPlanId: planId }),
    ).toBe(0);

    const otherBranch = await fixtures.createBranch(tenant, { slug: 'other' });
    const otherBranchDentist = await actor(
      otherBranch,
      TenantRoleCode.DENTIST,
      'Synthetic Other Branch Dentist',
    );
    await otherBranchDentist.agent
      .post(
        `/tenants/${tenant.slug}/branches/${otherBranch.slug}/visits/${visit.id}/treatment-plans/${planId}/cancel`,
      )
      .set('Idempotency-Key', randomUUID())
      .send({ reasonCode: 'PATIENT_REQUEST' })
      .expect(404);

    const cancellationNote =
      'Synthetic cancellation note for clinical follow-up.';
    const cancelledResponse = await dentist.agent
      .post(cancelRoute)
      .set('Idempotency-Key', randomUUID())
      .send({ reasonCode: 'OTHER', note: `  ${cancellationNote}  ` })
      .expect(200);
    const cancelled = cancelledResponse.body as unknown as CancellationPlanBody;
    expect(cancelled).toMatchObject({
      id: planId,
      status: TreatmentPlanStatus.CANCELLED,
    });
    expect(cancelled.items).toHaveLength(2);
    expect(cancelled.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: TreatmentItemStatus.CANCELLED }),
      ]),
    );

    const events = await dataSource.getRepository(TreatmentItemEvent).find({
      where: { treatmentPlanId: planId },
    });
    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'CANCELLED',
          visitId: visit.id,
          performedByUserId: dentist.user.id,
          reasonCode: 'OTHER',
          note: cancellationNote,
        }),
      ]),
    );
    for (const item of cancelled.items) {
      await dentist.agent
        .get(
          `${root}/visits/${visit.id}/treatment-plans/${planId}/items/${item.id}/events`,
        )
        .expect(200)
        .expect((response) => {
          const body = response.body as unknown as {
            items: Array<{
              eventType: string;
              content: string | null;
              reasonCode: string | null;
              note: string | null;
              images: unknown[];
            }>;
          };
          expect(body.items).toEqual([
            expect.objectContaining({
              eventType: 'CANCELLED',
              content: null,
              reasonCode: 'OTHER',
              note: cancellationNote,
              images: [],
            }),
          ]);
        });
    }

    const canonicalCases = [
      {
        reasonCode: 'PATIENT_REQUEST',
        status: TreatmentPlanStatus.DRAFT,
        note: 'x'.repeat(500),
      },
      {
        reasonCode: 'ENTERED_IN_ERROR',
        status: TreatmentPlanStatus.PROPOSED,
      },
      {
        reasonCode: 'DUPLICATE',
        status: TreatmentPlanStatus.ACCEPTED,
      },
      {
        reasonCode: 'NO_LONGER_APPLICABLE',
        status: TreatmentPlanStatus.DRAFT,
      },
      {
        reasonCode: 'TRANSFER_OF_CARE',
        status: TreatmentPlanStatus.DRAFT,
      },
    ];
    for (const canonicalCase of canonicalCases) {
      const candidate = await createPlan(1, canonicalCase.status);
      await dentist.agent
        .post(
          `${root}/visits/${visit.id}/treatment-plans/${candidate.id}/cancel`,
        )
        .set('Idempotency-Key', randomUUID())
        .send({
          reasonCode: canonicalCase.reasonCode,
          ...(canonicalCase.note ? { note: canonicalCase.note } : {}),
        })
        .expect(200)
        .expect((response) => {
          const body = response.body as unknown as CancellationPlanBody;
          expect(body.status).toBe(TreatmentPlanStatus.CANCELLED);
          expect(body.items[0]?.status).toBe(TreatmentItemStatus.CANCELLED);
        });
    }

    const legacyPlan = await createPlan(1);
    await dentist.agent
      .post(
        `${root}/visits/${visit.id}/treatment-plans/${legacyPlan.id}/cancel`,
      )
      .set('Idempotency-Key', randomUUID())
      .send({ reasonCode: 'LEGACY_REASON' })
      .expect(200);

    const auditLogs = await dataSource.getRepository(AuditLog).find({
      where: { tenantId: tenant.id },
    });
    const eventIds = new Set(events.map((event) => event.id));
    const eventAudits = auditLogs.filter(
      (audit) =>
        audit.action === AuditAction.TREATMENT_ITEM_EVENT_RECORDED &&
        eventIds.has(audit.resourceId),
    );
    expect(eventAudits).toHaveLength(2);
    expect(eventAudits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metadata: { reasonCode: 'OTHER' } }),
      ]),
    );
    expect(JSON.stringify(auditLogs)).not.toContain(cancellationNote);
    expect(JSON.stringify(auditLogs)).not.toContain('x'.repeat(500));
  }, 45_000);

  async function actor(
    branch: Branch,
    role: Exclude<TenantRoleCode, TenantRoleCode.TENANT_ADMIN>,
    fullName = `Synthetic ${role}`,
  ) {
    const user = await fixtures.createUser({
      email: `${role.toLowerCase()}-${randomUUID()}@example.test`,
      fullName,
    });
    await fixtures.grantBranchRole(user, branch, role);
    const session = await loginAs(app, {
      email: user.email,
      password: PASSWORD,
    });
    return { user, agent: session.agent };
  }
});
