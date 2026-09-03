import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum SubscriptionPlanBillingInterval {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

@Entity({ name: 'subscription_plans' })
@Unique('uq_subscription_plans_code', ['code'])
@Index('uq_subscription_plans_provider_plan_id', ['providerPlanId'], {
  unique: true,
  where: '"provider_plan_id" IS NOT NULL',
})
@Check(
  'chk_subscription_plans_code_format',
  `"code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
)
@Check('chk_subscription_plans_currency_format', `"currency" ~ '^[A-Z]{3}$'`)
@Check('chk_subscription_plans_amount_non_negative', `"amount" >= 0`)
@Check(
  'chk_subscription_plans_trial_days_positive',
  `"trial_days" IS NULL OR "trial_days" > 0`,
)
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({
    name: 'billing_interval',
    type: 'enum',
    enum: SubscriptionPlanBillingInterval,
    enumName: 'subscription_plan_billing_interval_enum',
  })
  billingInterval: SubscriptionPlanBillingInterval;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({
    name: 'provider_plan_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerPlanId: string | null;

  @Column({ name: 'trial_days', type: 'smallint', nullable: true })
  trialDays: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  entitlements: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
