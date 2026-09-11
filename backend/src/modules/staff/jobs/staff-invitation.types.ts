export const StaffInvitationQueueName = 'staff-notifications';

export const StaffInvitationJobName = {
  SEND_STAFF_INVITATION: 'staff-invitation.send',
} as const;

export interface SendStaffInvitationJob {
  invitationId: string;
}
