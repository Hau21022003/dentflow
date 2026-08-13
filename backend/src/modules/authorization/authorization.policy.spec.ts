import {
  Permission,
  platformRolePermissions,
  tenantRolePermissions,
} from './authorization.policy';
import { PlatformRoleCode } from './entities/platform-role-assignment.entity';
import { TenantRoleCode } from './entities/role-assignment.entity';

describe('authorization policy', () => {
  it('maps the platform admin to every platform capability', () => {
    expect(platformRolePermissions[PlatformRoleCode.PLATFORM_ADMIN]).toEqual([
      Permission.PLATFORM_TENANT_MANAGE,
      Permission.PLATFORM_PLAN_MANAGE,
      Permission.PLATFORM_SAAS_BILLING_READ,
      Permission.PLATFORM_SUPPORT_MANAGE,
      Permission.PLATFORM_SYSTEM_READ,
      Permission.PLATFORM_AUDIT_LOG_READ,
    ]);
  });

  it('does not grant clinical or patient-payment capabilities to tenant admins', () => {
    const permissions = tenantRolePermissions[TenantRoleCode.TENANT_ADMIN];

    expect(permissions).toContain(Permission.TENANT_SETTINGS_MANAGE);
    expect(permissions).not.toContain(Permission.CLINICAL_VISIT_WRITE);
    expect(permissions).not.toContain(Permission.PATIENT_PAYMENT_RECORD);
  });

  it('maps every fixed tenant role to its documented capabilities', () => {
    expect(tenantRolePermissions[TenantRoleCode.BRANCH_ADMIN]).toEqual([
      Permission.STAFF_MANAGE,
      Permission.APPOINTMENT_MANAGE,
      Permission.REPORT_READ,
      Permission.AUDIT_LOG_READ,
    ]);
    expect(tenantRolePermissions[TenantRoleCode.RECEPTIONIST]).toEqual([
      Permission.PATIENT_ADMINISTRATIVE_MANAGE,
      Permission.APPOINTMENT_MANAGE,
      Permission.PATIENT_INVOICE_CREATE,
      Permission.PATIENT_PAYMENT_RECORD,
    ]);
    expect(tenantRolePermissions[TenantRoleCode.DENTIST]).toEqual([
      Permission.APPOINTMENT_ASSIGNED_READ,
      Permission.CLINICAL_VISIT_WRITE,
      Permission.TREATMENT_PLAN_WRITE,
      Permission.TREATMENT_ITEM_COMPLETE,
      Permission.FOLLOW_UP_RECOMMEND,
    ]);
  });
});
