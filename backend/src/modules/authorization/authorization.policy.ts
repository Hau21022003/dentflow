import { PlatformRoleCode } from './entities/platform-role-assignment.entity';
import { TenantRoleCode } from './entities/role-assignment.entity';

export enum Permission {
  PLATFORM_TENANT_MANAGE = 'platform.tenant.manage',
  PLATFORM_PLAN_MANAGE = 'platform.plan.manage',
  PLATFORM_SAAS_BILLING_READ = 'platform.saas-billing.read',
  PLATFORM_SUPPORT_MANAGE = 'platform.support.manage',
  PLATFORM_SYSTEM_READ = 'platform.system.read',
  PLATFORM_AUDIT_LOG_READ = 'platform.audit-log.read',
  PLATFORM_EMAIL_TEMPLATE_MANAGE = 'platform.email-template.manage',
  TENANT_SETTINGS_MANAGE = 'tenant.settings.manage',
  BRANCH_MANAGE = 'branch.manage',
  SERVICE_CATALOG_MANAGE = 'service-catalog.manage',
  STAFF_MANAGE = 'staff.manage',
  STAFF_BRANCH_MANAGE = 'staff.branch.manage',
  REPORT_READ = 'report.read',
  AUDIT_LOG_READ = 'audit-log.read',
  SAAS_BILLING_MANAGE = 'saas-billing.manage',
  NOTIFICATION_SETTINGS_MANAGE = 'notification-settings.manage',
  FILE_UPLOAD = 'file.upload',
  PATIENT_ADMINISTRATIVE_MANAGE = 'patient.administrative.manage',
  APPOINTMENT_MANAGE = 'appointment.manage',
  PATIENT_INVOICE_CREATE = 'patient-invoice.create',
  PATIENT_PAYMENT_RECORD = 'patient-payment.record',
  APPOINTMENT_ASSIGNED_READ = 'appointment.assigned.read',
  CLINICAL_VISIT_WRITE = 'clinical.visit.write',
  TREATMENT_PLAN_WRITE = 'treatment-plan.write',
  TREATMENT_ITEM_COMPLETE = 'treatment-item.complete',
  FOLLOW_UP_RECOMMEND = 'follow-up.recommend',
}

const platformPermissions = [
  Permission.PLATFORM_TENANT_MANAGE,
  Permission.PLATFORM_PLAN_MANAGE,
  Permission.PLATFORM_SAAS_BILLING_READ,
  Permission.PLATFORM_SUPPORT_MANAGE,
  Permission.PLATFORM_SYSTEM_READ,
  Permission.PLATFORM_AUDIT_LOG_READ,
  Permission.PLATFORM_EMAIL_TEMPLATE_MANAGE,
] as const;

const tenantAdminPermissions = [
  Permission.TENANT_SETTINGS_MANAGE,
  Permission.BRANCH_MANAGE,
  Permission.SERVICE_CATALOG_MANAGE,
  Permission.STAFF_MANAGE,
  Permission.STAFF_BRANCH_MANAGE,
  Permission.REPORT_READ,
  Permission.AUDIT_LOG_READ,
  Permission.SAAS_BILLING_MANAGE,
  Permission.NOTIFICATION_SETTINGS_MANAGE,
  Permission.FILE_UPLOAD,
] as const;

export const platformRolePermissions: Readonly<
  Record<PlatformRoleCode, readonly Permission[]>
> = {
  [PlatformRoleCode.PLATFORM_ADMIN]: platformPermissions,
};

export const tenantRolePermissions: Readonly<
  Record<TenantRoleCode, readonly Permission[]>
> = {
  [TenantRoleCode.TENANT_ADMIN]: tenantAdminPermissions,
  [TenantRoleCode.BRANCH_ADMIN]: [
    Permission.STAFF_BRANCH_MANAGE,
    Permission.PATIENT_ADMINISTRATIVE_MANAGE,
    Permission.APPOINTMENT_MANAGE,
    Permission.REPORT_READ,
    Permission.AUDIT_LOG_READ,
    Permission.FILE_UPLOAD,
  ],
  [TenantRoleCode.RECEPTIONIST]: [
    Permission.PATIENT_ADMINISTRATIVE_MANAGE,
    Permission.APPOINTMENT_MANAGE,
    Permission.PATIENT_INVOICE_CREATE,
    Permission.PATIENT_PAYMENT_RECORD,
    Permission.FILE_UPLOAD,
  ],
  [TenantRoleCode.DENTIST]: [
    Permission.APPOINTMENT_ASSIGNED_READ,
    Permission.CLINICAL_VISIT_WRITE,
    Permission.TREATMENT_PLAN_WRITE,
    Permission.TREATMENT_ITEM_COMPLETE,
    Permission.FOLLOW_UP_RECOMMEND,
    Permission.FILE_UPLOAD,
  ],
};
