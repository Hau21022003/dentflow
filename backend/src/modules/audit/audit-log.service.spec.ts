import type { EntityManager } from 'typeorm';
import { AuditAction } from './audit-actions';
import { AuditLogService } from './audit-log.service';
import { AuditActorType } from './entities/audit-log.entity';
import { RequestContextService } from '../../common/request-context/request-context.service';

describe('AuditLogService', () => {
  const requestContext = new RequestContextService();
  const service = new AuditLogService(requestContext);

  it('rejects patient payload values that are not field-name identifiers', async () => {
    const manager = createManager();

    await expect(
      service.record(manager, {
        action: AuditAction.PATIENT_ADMINISTRATIVE_UPDATED,
        actor: { type: AuditActorType.SYSTEM },
        tenantId: '11111111-1111-4111-8111-111111111111',
        resourceId: '22222222-2222-4222-8222-222222222222',
        metadata: { changedFields: [{ phone: '+84900000000' }] },
      }),
    ).rejects.toThrow('field-name identifiers');
  });

  it('uses request metadata and rejects free text for financial actions', async () => {
    const manager = createManager();

    await requestContext.run(
      {
        requestId: '33333333-3333-4333-8333-333333333333',
        sourceIpHmac: 'a'.repeat(64),
        userAgent: 'Synthetic Test Agent',
      },
      async () => {
        await expect(
          service.record(manager, {
            action: AuditAction.PATIENT_PAYMENT_RECORDED,
            actor: { type: AuditActorType.SYSTEM },
            tenantId: '11111111-1111-4111-8111-111111111111',
            resourceId: '22222222-2222-4222-8222-222222222222',
            reason: 'Contains free text',
          }),
        ).rejects.toThrow('reason code');

        const saved = await service.record(manager, {
          action: AuditAction.PATIENT_PAYMENT_RECORDED,
          actor: { type: AuditActorType.SYSTEM },
          tenantId: '11111111-1111-4111-8111-111111111111',
          resourceId: '22222222-2222-4222-8222-222222222222',
          metadata: { reasonCode: 'PAYMENT_CAPTURED', amount: 100000 },
        });

        expect(saved.requestId).toBe('33333333-3333-4333-8333-333333333333');
        expect(saved.sourceIpHmac).toBe('a'.repeat(64));
        expect(saved.userAgent).toBe('Synthetic Test Agent');
      },
    );
  });
});

function createManager(): EntityManager {
  return {
    create: (_entity: unknown, value: unknown) => value,
    getRepository: () => ({
      save: (value: unknown) => Promise.resolve(value),
    }),
  } as unknown as EntityManager;
}
