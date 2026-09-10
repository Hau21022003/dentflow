import { AuditDomain } from './entities/audit-log.entity';

export const AuditAction = {
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  USER_DISABLED: 'USER_DISABLED',
  USER_ENABLED: 'USER_ENABLED',
  ROLE_GRANTED: 'ROLE_GRANTED',
  ROLE_REVOKED: 'ROLE_REVOKED',
  BRANCH_SCOPE_GRANTED: 'BRANCH_SCOPE_GRANTED',
  BRANCH_SCOPE_REVOKED: 'BRANCH_SCOPE_REVOKED',
  TENANT_CREATED: 'TENANT_CREATED',
  TENANT_UPDATED: 'TENANT_UPDATED',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  TENANT_REACTIVATED: 'TENANT_REACTIVATED',
  TENANT_TRIAL_EXTENDED: 'TENANT_TRIAL_EXTENDED',
  TENANT_CANCELED: 'TENANT_CANCELED',
  TENANT_OWNER_INVITATION_CREATED: 'TENANT_OWNER_INVITATION_CREATED',
  TENANT_OWNER_INVITATION_RESENT: 'TENANT_OWNER_INVITATION_RESENT',
  TENANT_OWNER_INVITATION_ACCEPTED: 'TENANT_OWNER_INVITATION_ACCEPTED',
  PLAN_CREATED: 'PLAN_CREATED',
  PLAN_UPDATED: 'PLAN_UPDATED',
  PLAN_DEACTIVATED: 'PLAN_DEACTIVATED',
  PLAN_ACTIVATED: 'PLAN_ACTIVATED',
  EMAIL_TEMPLATE_DRAFT_SAVED: 'EMAIL_TEMPLATE_DRAFT_SAVED',
  EMAIL_TEMPLATE_PUBLISHED: 'EMAIL_TEMPLATE_PUBLISHED',
  SAAS_SUBSCRIPTION_UPDATED: 'SAAS_SUBSCRIPTION_UPDATED',
  SAAS_INVOICE_UPDATED: 'SAAS_INVOICE_UPDATED',
  SAAS_WEBHOOK_RETRIED: 'SAAS_WEBHOOK_RETRIED',
  TENANT_SETTINGS_UPDATED: 'TENANT_SETTINGS_UPDATED',
  BRANCH_CREATED: 'BRANCH_CREATED',
  BRANCH_UPDATED: 'BRANCH_UPDATED',
  BRANCH_DEACTIVATED: 'BRANCH_DEACTIVATED',
  BRANCH_ACTIVATED: 'BRANCH_ACTIVATED',
  SERVICE_CREATED: 'SERVICE_CREATED',
  SERVICE_UPDATED: 'SERVICE_UPDATED',
  SERVICE_DEACTIVATED: 'SERVICE_DEACTIVATED',
  PATIENT_CREATED: 'PATIENT_CREATED',
  PATIENT_ADMINISTRATIVE_UPDATED: 'PATIENT_ADMINISTRATIVE_UPDATED',
  APPOINTMENT_CREATED: 'APPOINTMENT_CREATED',
  APPOINTMENT_STATE_CHANGED: 'APPOINTMENT_STATE_CHANGED',
  TREATMENT_PLAN_STATE_CHANGED: 'TREATMENT_PLAN_STATE_CHANGED',
  TREATMENT_ITEM_STATE_CHANGED: 'TREATMENT_ITEM_STATE_CHANGED',
  PATIENT_INVOICE_ISSUED: 'PATIENT_INVOICE_ISSUED',
  PATIENT_INVOICE_VOIDED: 'PATIENT_INVOICE_VOIDED',
  PATIENT_PAYMENT_RECORDED: 'PATIENT_PAYMENT_RECORDED',
  PATIENT_PAYMENT_REFUNDED: 'PATIENT_PAYMENT_REFUNDED',
  PATIENT_PAYMENT_ADJUSTED: 'PATIENT_PAYMENT_ADJUSTED',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export type AuditResourceType =
  | 'USER'
  | 'ROLE_ASSIGNMENT'
  | 'TENANT'
  | 'TENANT_OWNER_INVITATION'
  | 'PLAN'
  | 'EMAIL_TEMPLATE_REVISION'
  | 'SAAS_SUBSCRIPTION'
  | 'SAAS_INVOICE'
  | 'SAAS_WEBHOOK_EVENT'
  | 'TENANT_SETTINGS'
  | 'BRANCH'
  | 'SERVICE'
  | 'PATIENT'
  | 'APPOINTMENT'
  | 'TREATMENT_PLAN'
  | 'TREATMENT_ITEM'
  | 'PATIENT_INVOICE'
  | 'PAYMENT';

export type AuditPayloadPolicy = {
  before: readonly string[];
  after: readonly string[];
  metadata: readonly string[];
};

type AuditActionDefinition = {
  domain: AuditDomain;
  resourceType: AuditResourceType;
  allowsFreeTextReason: boolean;
  payload: AuditPayloadPolicy;
};

const NO_PAYLOAD: AuditPayloadPolicy = {
  before: [],
  after: [],
  metadata: [],
};
const ACCOUNT_LOCK_PAYLOAD: AuditPayloadPolicy = {
  before: ['failedLoginAttempts'],
  after: ['failedLoginAttempts', 'lockDurationSeconds'],
  metadata: ['reasonCode'],
};
const USER_STATUS_PAYLOAD: AuditPayloadPolicy = {
  before: ['status'],
  after: ['status'],
  metadata: ['reasonCode'],
};
const ROLE_ASSIGNMENT_PAYLOAD: AuditPayloadPolicy = {
  before: ['roleCode', 'branchId', 'revokedAt'],
  after: ['roleCode', 'branchId', 'revokedAt'],
  metadata: ['reasonCode'],
};
const TENANT_CHANGE_PAYLOAD: AuditPayloadPolicy = {
  before: ['status', 'changedFields', 'trialDays'],
  after: ['status', 'changedFields', 'trialDays'],
  metadata: ['reasonCode'],
};
const TENANT_OWNER_INVITATION_PAYLOAD: AuditPayloadPolicy = {
  before: ['status'],
  after: ['status'],
  metadata: ['reasonCode'],
};
const PLAN_CHANGE_PAYLOAD: AuditPayloadPolicy = {
  before: ['changedFields', 'isActive', 'amount', 'currency'],
  after: ['changedFields', 'isActive', 'amount', 'currency'],
  metadata: ['reasonCode'],
};
const EMAIL_TEMPLATE_CHANGE_PAYLOAD: AuditPayloadPolicy = {
  before: ['templateKey', 'locale', 'version', 'status', 'changedFields'],
  after: ['templateKey', 'locale', 'version', 'status', 'changedFields'],
  metadata: [],
};
const SAAS_PAYLOAD: AuditPayloadPolicy = {
  before: ['status', 'amount', 'currency', 'currentPeriodEnd'],
  after: ['status', 'amount', 'currency', 'currentPeriodEnd'],
  metadata: ['reasonCode', 'providerEventId'],
};
const SETTINGS_PAYLOAD: AuditPayloadPolicy = {
  before: ['changedFields', 'defaultLocale', 'defaultTimezone'],
  after: ['changedFields', 'defaultLocale', 'defaultTimezone'],
  metadata: ['reasonCode'],
};
const BRANCH_PAYLOAD: AuditPayloadPolicy = {
  before: ['status', 'changedFields'],
  after: ['status', 'changedFields'],
  metadata: ['reasonCode'],
};
const SERVICE_PAYLOAD: AuditPayloadPolicy = {
  before: [
    'changedFields',
    'isActive',
    'amount',
    'currency',
    'durationMinutes',
  ],
  after: ['changedFields', 'isActive', 'amount', 'currency', 'durationMinutes'],
  metadata: ['reasonCode'],
};
const PATIENT_PAYLOAD: AuditPayloadPolicy = {
  before: ['changedFields'],
  after: ['changedFields'],
  metadata: ['changedFields', 'reasonCode'],
};
const APPOINTMENT_PAYLOAD: AuditPayloadPolicy = {
  before: ['status', 'scheduledAt', 'assignedDentistUserId'],
  after: ['status', 'scheduledAt', 'assignedDentistUserId'],
  metadata: ['reasonCode'],
};
const TREATMENT_PAYLOAD: AuditPayloadPolicy = {
  before: ['status'],
  after: ['status'],
  metadata: ['reasonCode'],
};
const INVOICE_PAYLOAD: AuditPayloadPolicy = {
  before: ['status', 'totalAmount', 'currency'],
  after: ['status', 'totalAmount', 'currency'],
  metadata: ['reasonCode'],
};
const PAYMENT_PAYLOAD: AuditPayloadPolicy = {
  before: ['amount', 'currency', 'method', 'reference'],
  after: ['amount', 'currency', 'method', 'reference'],
  metadata: ['reasonCode', 'amount', 'currency', 'method', 'reference'],
};

function definition(
  domain: AuditDomain,
  resourceType: AuditResourceType,
  allowsFreeTextReason: boolean,
  payload: AuditPayloadPolicy = NO_PAYLOAD,
): AuditActionDefinition {
  return { domain, resourceType, allowsFreeTextReason, payload };
}

export const AUDIT_ACTION_DEFINITIONS: Readonly<
  Record<AuditAction, AuditActionDefinition>
> = {
  [AuditAction.AUTH_ACCOUNT_LOCKED]: definition(
    AuditDomain.SECURITY,
    'USER',
    false,
    ACCOUNT_LOCK_PAYLOAD,
  ),
  [AuditAction.USER_DISABLED]: definition(
    AuditDomain.TENANT_ADMIN,
    'USER',
    true,
    USER_STATUS_PAYLOAD,
  ),
  [AuditAction.USER_ENABLED]: definition(
    AuditDomain.TENANT_ADMIN,
    'USER',
    true,
    USER_STATUS_PAYLOAD,
  ),
  [AuditAction.ROLE_GRANTED]: definition(
    AuditDomain.TENANT_ADMIN,
    'ROLE_ASSIGNMENT',
    true,
    ROLE_ASSIGNMENT_PAYLOAD,
  ),
  [AuditAction.ROLE_REVOKED]: definition(
    AuditDomain.TENANT_ADMIN,
    'ROLE_ASSIGNMENT',
    true,
    ROLE_ASSIGNMENT_PAYLOAD,
  ),
  [AuditAction.BRANCH_SCOPE_GRANTED]: definition(
    AuditDomain.TENANT_ADMIN,
    'ROLE_ASSIGNMENT',
    true,
    ROLE_ASSIGNMENT_PAYLOAD,
  ),
  [AuditAction.BRANCH_SCOPE_REVOKED]: definition(
    AuditDomain.TENANT_ADMIN,
    'ROLE_ASSIGNMENT',
    true,
    ROLE_ASSIGNMENT_PAYLOAD,
  ),
  [AuditAction.TENANT_CREATED]: definition(
    AuditDomain.PLATFORM,
    'TENANT',
    false,
    TENANT_CHANGE_PAYLOAD,
  ),
  [AuditAction.TENANT_UPDATED]: definition(
    AuditDomain.PLATFORM,
    'TENANT',
    true,
    TENANT_CHANGE_PAYLOAD,
  ),
  [AuditAction.TENANT_SUSPENDED]: definition(
    AuditDomain.PLATFORM,
    'TENANT',
    true,
    TENANT_CHANGE_PAYLOAD,
  ),
  [AuditAction.TENANT_REACTIVATED]: definition(
    AuditDomain.PLATFORM,
    'TENANT',
    true,
    TENANT_CHANGE_PAYLOAD,
  ),
  [AuditAction.TENANT_TRIAL_EXTENDED]: definition(
    AuditDomain.PLATFORM,
    'TENANT',
    true,
    TENANT_CHANGE_PAYLOAD,
  ),
  [AuditAction.TENANT_CANCELED]: definition(
    AuditDomain.PLATFORM,
    'TENANT',
    true,
    TENANT_CHANGE_PAYLOAD,
  ),
  [AuditAction.TENANT_OWNER_INVITATION_CREATED]: definition(
    AuditDomain.PLATFORM,
    'TENANT_OWNER_INVITATION',
    false,
    TENANT_OWNER_INVITATION_PAYLOAD,
  ),
  [AuditAction.TENANT_OWNER_INVITATION_RESENT]: definition(
    AuditDomain.PLATFORM,
    'TENANT_OWNER_INVITATION',
    false,
    TENANT_OWNER_INVITATION_PAYLOAD,
  ),
  [AuditAction.TENANT_OWNER_INVITATION_ACCEPTED]: definition(
    AuditDomain.PLATFORM,
    'TENANT_OWNER_INVITATION',
    false,
    TENANT_OWNER_INVITATION_PAYLOAD,
  ),
  [AuditAction.PLAN_CREATED]: definition(
    AuditDomain.PLATFORM,
    'PLAN',
    false,
    PLAN_CHANGE_PAYLOAD,
  ),
  [AuditAction.PLAN_UPDATED]: definition(
    AuditDomain.PLATFORM,
    'PLAN',
    true,
    PLAN_CHANGE_PAYLOAD,
  ),
  [AuditAction.PLAN_DEACTIVATED]: definition(
    AuditDomain.PLATFORM,
    'PLAN',
    true,
    PLAN_CHANGE_PAYLOAD,
  ),
  [AuditAction.PLAN_ACTIVATED]: definition(
    AuditDomain.PLATFORM,
    'PLAN',
    true,
    PLAN_CHANGE_PAYLOAD,
  ),
  [AuditAction.EMAIL_TEMPLATE_DRAFT_SAVED]: definition(
    AuditDomain.PLATFORM,
    'EMAIL_TEMPLATE_REVISION',
    false,
    EMAIL_TEMPLATE_CHANGE_PAYLOAD,
  ),
  [AuditAction.EMAIL_TEMPLATE_PUBLISHED]: definition(
    AuditDomain.PLATFORM,
    'EMAIL_TEMPLATE_REVISION',
    false,
    EMAIL_TEMPLATE_CHANGE_PAYLOAD,
  ),
  [AuditAction.SAAS_SUBSCRIPTION_UPDATED]: definition(
    AuditDomain.PLATFORM,
    'SAAS_SUBSCRIPTION',
    false,
    SAAS_PAYLOAD,
  ),
  [AuditAction.SAAS_INVOICE_UPDATED]: definition(
    AuditDomain.PLATFORM,
    'SAAS_INVOICE',
    false,
    SAAS_PAYLOAD,
  ),
  [AuditAction.SAAS_WEBHOOK_RETRIED]: definition(
    AuditDomain.PLATFORM,
    'SAAS_WEBHOOK_EVENT',
    true,
    SAAS_PAYLOAD,
  ),
  [AuditAction.TENANT_SETTINGS_UPDATED]: definition(
    AuditDomain.TENANT_ADMIN,
    'TENANT_SETTINGS',
    true,
    SETTINGS_PAYLOAD,
  ),
  [AuditAction.BRANCH_CREATED]: definition(
    AuditDomain.TENANT_ADMIN,
    'BRANCH',
    false,
    BRANCH_PAYLOAD,
  ),
  [AuditAction.BRANCH_UPDATED]: definition(
    AuditDomain.TENANT_ADMIN,
    'BRANCH',
    true,
    BRANCH_PAYLOAD,
  ),
  [AuditAction.BRANCH_DEACTIVATED]: definition(
    AuditDomain.TENANT_ADMIN,
    'BRANCH',
    true,
    BRANCH_PAYLOAD,
  ),
  [AuditAction.BRANCH_ACTIVATED]: definition(
    AuditDomain.TENANT_ADMIN,
    'BRANCH',
    true,
    BRANCH_PAYLOAD,
  ),
  [AuditAction.SERVICE_CREATED]: definition(
    AuditDomain.TENANT_ADMIN,
    'SERVICE',
    false,
    SERVICE_PAYLOAD,
  ),
  [AuditAction.SERVICE_UPDATED]: definition(
    AuditDomain.TENANT_ADMIN,
    'SERVICE',
    true,
    SERVICE_PAYLOAD,
  ),
  [AuditAction.SERVICE_DEACTIVATED]: definition(
    AuditDomain.TENANT_ADMIN,
    'SERVICE',
    true,
    SERVICE_PAYLOAD,
  ),
  [AuditAction.PATIENT_CREATED]: definition(
    AuditDomain.CLINICAL,
    'PATIENT',
    false,
    PATIENT_PAYLOAD,
  ),
  [AuditAction.PATIENT_ADMINISTRATIVE_UPDATED]: definition(
    AuditDomain.CLINICAL,
    'PATIENT',
    false,
    PATIENT_PAYLOAD,
  ),
  [AuditAction.APPOINTMENT_CREATED]: definition(
    AuditDomain.CLINICAL,
    'APPOINTMENT',
    false,
    APPOINTMENT_PAYLOAD,
  ),
  [AuditAction.APPOINTMENT_STATE_CHANGED]: definition(
    AuditDomain.CLINICAL,
    'APPOINTMENT',
    false,
    APPOINTMENT_PAYLOAD,
  ),
  [AuditAction.TREATMENT_PLAN_STATE_CHANGED]: definition(
    AuditDomain.CLINICAL,
    'TREATMENT_PLAN',
    false,
    TREATMENT_PAYLOAD,
  ),
  [AuditAction.TREATMENT_ITEM_STATE_CHANGED]: definition(
    AuditDomain.CLINICAL,
    'TREATMENT_ITEM',
    false,
    TREATMENT_PAYLOAD,
  ),
  [AuditAction.PATIENT_INVOICE_ISSUED]: definition(
    AuditDomain.FINANCIAL,
    'PATIENT_INVOICE',
    false,
    INVOICE_PAYLOAD,
  ),
  [AuditAction.PATIENT_INVOICE_VOIDED]: definition(
    AuditDomain.FINANCIAL,
    'PATIENT_INVOICE',
    false,
    INVOICE_PAYLOAD,
  ),
  [AuditAction.PATIENT_PAYMENT_RECORDED]: definition(
    AuditDomain.FINANCIAL,
    'PAYMENT',
    false,
    PAYMENT_PAYLOAD,
  ),
  [AuditAction.PATIENT_PAYMENT_REFUNDED]: definition(
    AuditDomain.FINANCIAL,
    'PAYMENT',
    false,
    PAYMENT_PAYLOAD,
  ),
  [AuditAction.PATIENT_PAYMENT_ADJUSTED]: definition(
    AuditDomain.FINANCIAL,
    'PAYMENT',
    false,
    PAYMENT_PAYLOAD,
  ),
};
