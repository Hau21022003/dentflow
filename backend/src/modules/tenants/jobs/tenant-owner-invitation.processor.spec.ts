import type { Job } from 'bullmq';
import type { DataSource } from 'typeorm';
import { AppConfigService } from '../../../config/app-config.service';
import { type EmailSender } from '../../../infrastructure/email';
import {
  EmailTemplateRenderError,
  type EmailTemplateRenderer,
} from '../../email-templates/email-template-renderer.service';
import {
  TenantOwnerInvitation,
  TenantOwnerInvitationDeliveryStatus,
  TenantOwnerInvitationStatus,
} from '../entities/tenant-owner-invitation.entity';
import { TenantInvitationTokenService } from '../tenant-invitation-token.service';
import { TenantOwnerInvitationProcessor } from './tenant-owner-invitation.processor';
import {
  type SendTenantOwnerInvitationJob,
  TenantInvitationJobName,
} from './tenant-owner-invitation.types';

describe('TenantOwnerInvitationProcessor', () => {
  const findOne = jest.fn();
  const update = jest.fn();
  const dataSource = {
    getRepository: jest.fn(() => ({ findOne, update })),
  } as unknown as DataSource;
  const send = jest.fn();
  const sender = { send } as unknown as EmailSender;
  const renderPublished = jest.fn();
  const renderer = { renderPublished } as unknown as EmailTemplateRenderer;
  const createToken = jest.fn(() => 'synthetic-token');
  const tokenService = {
    createToken,
  } as unknown as TenantInvitationTokenService;
  const appConfig = {
    corsConfig: { frontendOrigin: 'https://app.example.test' },
  } as AppConfigService;
  const processor = new TenantOwnerInvitationProcessor(
    dataSource,
    sender,
    appConfig,
    tokenService,
    renderer,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .spyOn(dataSource, 'getRepository')
      .mockReturnValue({ findOne, update } as never);
    findOne.mockResolvedValue(createInvitation());
    update.mockResolvedValue(undefined);
    createToken.mockReturnValue('synthetic-token');
    renderPublished.mockResolvedValue({
      subject: 'Rendered invitation',
      text: 'Rendered text',
      html: '<p>Rendered HTML</p>',
    });
    send.mockResolvedValue({
      provider: 'smtp',
      messageId: 'synthetic-message-id',
    });
  });

  it('uses the current published template for the invitation locale and passes rendered content to the sender', async () => {
    await processor.process(createJob());

    expect(renderPublished).toHaveBeenCalledWith(
      'tenant-owner-invitation',
      'en',
      expect.objectContaining({
        tenantDisplayName: 'Synthetic Clinic',
        invitationUrl:
          'https://app.example.test/accept-tenant-owner-invitation?token=synthetic-token',
      }),
    );
    expect(send).toHaveBeenCalledWith({
      to: ['owner@example.test'],
      subject: 'Rendered invitation',
      text: 'Rendered text',
      html: '<p>Rendered HTML</p>',
    });
    expect(update).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        deliveryStatus: TenantOwnerInvitationDeliveryStatus.SENT,
      }),
    );
  });

  it('marks a missing published template as permanently failed without retrying the provider', async () => {
    renderPublished.mockRejectedValue(
      new EmailTemplateRenderError(
        'PUBLISHED_TEMPLATE_NOT_FOUND',
        'Published template was not found.',
      ),
    );

    await expect(processor.process(createJob())).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      {
        deliveryStatus: TenantOwnerInvitationDeliveryStatus.FAILED,
        lastDeliveryErrorCode: 'PUBLISHED_TEMPLATE_NOT_FOUND',
      },
    );
  });
});

function createJob(): Job<SendTenantOwnerInvitationJob> {
  return {
    name: TenantInvitationJobName.SEND_OWNER_INVITATION,
    data: { invitationId: '11111111-1111-4111-8111-111111111111' },
  } as Job<SendTenantOwnerInvitationJob>;
}

function createInvitation(): TenantOwnerInvitation {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '33333333-3333-4333-8333-333333333333',
    ownerEmail: 'owner@example.test',
    ownerEmailNormalized: 'owner@example.test',
    ownerFullName: 'Synthetic Owner',
    tokenHash: 'a'.repeat(64),
    status: TenantOwnerInvitationStatus.PENDING,
    expiresAt: new Date('2026-09-10T03:00:00.000Z'),
    acceptedAt: null,
    acceptedByUserId: null,
    revokedAt: null,
    deliveryStatus: TenantOwnerInvitationDeliveryStatus.PENDING,
    lastSentAt: null,
    lastDeliveryErrorCode: null,
    createdByUserId: null,
    createdAt: new Date('2026-09-09T03:00:00.000Z'),
    updatedAt: new Date('2026-09-09T03:00:00.000Z'),
    tenant: {
      id: '33333333-3333-4333-8333-333333333333',
      displayName: 'Synthetic Clinic',
      defaultLocale: 'en',
      defaultTimezone: 'Asia/Ho_Chi_Minh',
    },
  } as TenantOwnerInvitation;
}
