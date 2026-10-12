import { EntityManager } from 'typeorm';

export type TenantDisplayCounter = 'patient' | 'treatmentPlan';

export async function allocateTenantDisplayNumber(
  manager: EntityManager,
  tenantId: string,
  counter: TenantDisplayCounter,
): Promise<number> {
  const column =
    counter === 'patient'
      ? 'next_patient_number'
      : 'next_treatment_plan_number';
  await manager.query(
    `INSERT INTO tenant_display_counters (tenant_id)
     VALUES ($1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId],
  );
  const [rows] = await manager.query<
    [Array<{ value: string | number }>, number]
  >(
    `UPDATE tenant_display_counters
     SET ${column} = ${column} + 1
     WHERE tenant_id = $1
     RETURNING ${column} - 1 AS value`,
    [tenantId],
  );
  const value = Number(rows[0]?.value);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Display counter ${counter} is not initialized.`);
  }
  return value;
}

export function patientCode(displayNumber: number): string {
  return `PAT-${String(displayNumber).padStart(6, '0')}`;
}

export function treatmentPlanCode(displayNumber: number): string {
  return `TP-${String(displayNumber).padStart(4, '0')}`;
}
