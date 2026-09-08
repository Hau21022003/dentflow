export const TenantInvitationQueueName = 'notifications';

export const TenantInvitationJobName = {
  SEND_OWNER_INVITATION: 'tenant-owner-invitation.send',
} as const;

export interface SendTenantOwnerInvitationJob {
  invitationId: string;
}
