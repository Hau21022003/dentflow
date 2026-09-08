import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptionPlans1786060800008 implements MigrationInterface {
  name = 'CreateSubscriptionPlans1786060800008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "subscription_plan_billing_interval_enum" AS ENUM ('MONTHLY', 'YEARLY')`,
    );
    await queryRunner.query(`
      CREATE TABLE "subscription_plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(100) NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" character varying(1000),
        "billing_interval" "subscription_plan_billing_interval_enum" NOT NULL,
        "amount" integer NOT NULL,
        "currency" character(3) NOT NULL,
        "provider_plan_id" character varying(255),
        "trial_days" smallint,
        "entitlements" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_subscription_plans_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_subscription_plans_code" UNIQUE ("code"),
        CONSTRAINT "chk_subscription_plans_code_format"
          CHECK ("code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        CONSTRAINT "chk_subscription_plans_currency_format"
          CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "chk_subscription_plans_amount_non_negative"
          CHECK ("amount" >= 0),
        CONSTRAINT "chk_subscription_plans_trial_days_positive"
          CHECK ("trial_days" IS NULL OR "trial_days" > 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "subscription_plans"');
    await queryRunner.query(
      'DROP TYPE "subscription_plan_billing_interval_enum"',
    );
  }
}
