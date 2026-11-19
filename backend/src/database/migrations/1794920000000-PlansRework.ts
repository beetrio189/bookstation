import { MigrationInterface, QueryRunner } from 'typeorm';

// Gói hiện tại của NXB không lưu trên publishers nữa mà tra từ payments
// (status = success, period_ends_at > now(); không có thì là gói Free "none").
// plans.duration NOT NULL, gói none = 'infinity'; thêm is_active; dòng none bị
// trigger chặn đổi duration / price / is_active. payments giữ lịch sử kể cả khi
// NXB hoặc gói bị xóa (SET NULL + cột snapshot), thêm cột VNPAY.
export class PlansRework1794920000000 implements MigrationInterface {
  name = 'PlansRework1794920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // publishers: bỏ 3 cột gói (FK publishers_plan_id_fkey mất theo cột)
    await queryRunner.query(`
      ALTER TABLE "publishers"
        DROP COLUMN "plan_id",
        DROP COLUMN "plan_starts_at",
        DROP COLUMN "plan_ends_at"
    `);

    // plans
    await queryRunner.query(
      `ALTER TABLE "plans" DROP CONSTRAINT "plans_check"`,
    );
    await queryRunner.query(
      `UPDATE "plans" SET "duration" = 'infinity' WHERE "name" = 'none' AND "duration" IS NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "plans"
        ALTER COLUMN "duration" SET NOT NULL,
        ADD COLUMN "is_active" bool NOT NULL DEFAULT true,
        DROP CONSTRAINT "plans_name_duration_key",
        ADD CONSTRAINT "plans_name_duration_key" UNIQUE ("name", "duration")
    `);
    await queryRunner.query(`
      CREATE FUNCTION "protect_free_plan"() RETURNS trigger AS $$
      BEGIN
        IF OLD."name" = 'none' AND (
          NEW."duration" IS DISTINCT FROM OLD."duration"
          OR NEW."price" IS DISTINCT FROM OLD."price"
          OR NEW."is_active" IS DISTINCT FROM OLD."is_active"
        ) THEN
          RAISE EXCEPTION 'Không được đổi duration, price, is_active của gói none';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "plans_protect_free_plan"
      BEFORE UPDATE ON "plans"
      FOR EACH ROW EXECUTE FUNCTION "protect_free_plan"()
    `);

    // payments (bảng đang rỗng nên cột snapshot thêm NOT NULL được)
    await queryRunner.query(`
      ALTER TABLE "payments"
        DROP CONSTRAINT "payments_publisher_id_fkey",
        DROP CONSTRAINT "payments_plan_id_fkey",
        ALTER COLUMN "publisher_id" DROP NOT NULL,
        ALTER COLUMN "plan_id" DROP NOT NULL,
        ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
        ADD FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
        ADD COLUMN "publisher_name" varchar(255) NOT NULL,
        ADD COLUMN "plan_name" varchar(50) NOT NULL,
        ADD COLUMN "book_limit" integer NOT NULL CHECK ("book_limit" >= 0),
        ADD COLUMN "editor_limit" integer NOT NULL CHECK ("editor_limit" >= 0),
        ADD COLUMN "vnp_create_date" char(14),
        ADD COLUMN "vnp_transaction_no" varchar(50),
        ADD CONSTRAINT "payments_period_check" CHECK ("period_ends_at" > "period_starts_at"),
        ADD CONSTRAINT "payments_success_period_check" CHECK (
          "status" <> 'success' OR ("period_starts_at" IS NOT NULL AND "period_ends_at" IS NOT NULL)
        )
    `);
    await queryRunner.query(
      `CREATE INDEX ON "payments" ("publisher_id", "status", "period_ends_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "payments"`);
    await queryRunner.query(
      `DROP INDEX "payments_publisher_id_status_period_ends_at_idx"`,
    );
    await queryRunner.query(`
      ALTER TABLE "payments"
        DROP CONSTRAINT "payments_success_period_check",
        DROP CONSTRAINT "payments_period_check",
        DROP COLUMN "vnp_transaction_no",
        DROP COLUMN "vnp_create_date",
        DROP COLUMN "editor_limit",
        DROP COLUMN "book_limit",
        DROP COLUMN "plan_name",
        DROP COLUMN "publisher_name",
        DROP CONSTRAINT "payments_publisher_id_fkey",
        DROP CONSTRAINT "payments_plan_id_fkey",
        ALTER COLUMN "publisher_id" SET NOT NULL,
        ALTER COLUMN "plan_id" SET NOT NULL,
        ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
        ADD FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") DEFERRABLE INITIALLY IMMEDIATE
    `);

    await queryRunner.query(
      `DROP TRIGGER "plans_protect_free_plan" ON "plans"`,
    );
    await queryRunner.query(`DROP FUNCTION "protect_free_plan"()`);
    await queryRunner.query(`
      ALTER TABLE "plans"
        DROP COLUMN "is_active",
        DROP CONSTRAINT "plans_name_duration_key",
        ALTER COLUMN "duration" DROP NOT NULL
    `);
    await queryRunner.query(
      `UPDATE "plans" SET "duration" = NULL WHERE "name" = 'none'`,
    );
    await queryRunner.query(`
      ALTER TABLE "plans"
        ADD CONSTRAINT "plans_name_duration_key" UNIQUE NULLS NOT DISTINCT ("name", "duration"),
        ADD CONSTRAINT "plans_check" CHECK ("duration" IS NOT NULL OR "name" = 'none')
    `);

    await queryRunner.query(`
      ALTER TABLE "publishers"
        ADD COLUMN "plan_id" uuid,
        ADD COLUMN "plan_starts_at" timestamptz NOT NULL DEFAULT (now()),
        ADD COLUMN "plan_ends_at" timestamptz
    `);
    await queryRunner.query(`
      UPDATE "publishers"
      SET "plan_id" = (SELECT "id" FROM "plans" WHERE "name" = 'none' AND "duration" IS NULL),
          "plan_starts_at" = "created_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "publishers"
        ALTER COLUMN "plan_id" SET NOT NULL,
        ADD FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") DEFERRABLE INITIALLY IMMEDIATE
    `);
  }
}
