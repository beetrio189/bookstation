import { MigrationInterface, QueryRunner } from 'typeorm';

// Gói hội viên thành bảng `plans`; publishers trỏ plan_id + thời hạn gói; lịch sử
// mua là bảng `payments` (lưu giá lúc mua). Bỏ publishers.subscription_tier,
// subscription_logs và enum subscription_status.
//
// Chưa có CHECK "plan_ends_at IS NULL chỉ khi gói vĩnh viễn (duration NULL)" vì CHECK không đọc được
// bảng plans: kiểm tra trong code lúc đổi gói (hoặc trigger), để bàn sau.
export class Plans1794890000000 implements MigrationInterface {
  name = 'Plans1794890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "payment_status" AS ENUM ('pending', 'success', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
        "name" varchar(50) NOT NULL,
        "duration" interval,
        "price" integer NOT NULL CHECK ("price" >= 0),
        "book_limit" integer NOT NULL CHECK ("book_limit" >= 0),
        "editor_limit" integer NOT NULL CHECK ("editor_limit" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT (now()),
        "updated_at" timestamptz NOT NULL DEFAULT (now()),
        UNIQUE NULLS NOT DISTINCT ("name", "duration"),
        CHECK ("duration" > interval '0'),
        CHECK ("duration" IS NOT NULL OR "name" = 'none')
      )
    `);

    // Gói Free mặc định của NXB mới (duration NULL = vĩnh viễn): không tạo biên tập viên, không đăng sách
    await queryRunner.query(`
      INSERT INTO "plans" ("name", "duration", "price", "book_limit", "editor_limit")
      VALUES ('none', NULL, 0, 0, 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "publishers"
        ADD COLUMN "plan_id" uuid,
        ADD COLUMN "plan_starts_at" timestamptz NOT NULL DEFAULT (now()),
        ADD COLUMN "plan_ends_at" timestamptz
    `);
    // NXB đang có (kể cả tier khác none) về gói Free: chưa có ai mua gói thật
    await queryRunner.query(`
      UPDATE "publishers"
      SET "plan_id" = (SELECT "id" FROM "plans" WHERE "name" = 'none' AND "duration" IS NULL),
          "plan_starts_at" = "created_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "publishers"
        ALTER COLUMN "plan_id" SET NOT NULL,
        ADD FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") DEFERRABLE INITIALLY IMMEDIATE,
        DROP COLUMN "subscription_tier"
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
        "publisher_id" uuid NOT NULL,
        "plan_id" uuid NOT NULL,
        "amount" integer NOT NULL CHECK ("amount" >= 0),
        "vnp_txn_ref" varchar(100) UNIQUE NOT NULL,
        "status" payment_status NOT NULL DEFAULT 'pending',
        "period_starts_at" timestamptz,
        "period_ends_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT (now()),
        "updated_at" timestamptz NOT NULL DEFAULT (now())
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
        ADD FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") DEFERRABLE INITIALLY IMMEDIATE
    `);
    await queryRunner.query(
      `CREATE INDEX ON "payments" ("publisher_id", "created_at")`,
    );

    await queryRunner.query(`DROP TABLE "subscription_logs"`);
    await queryRunner.query(`DROP TYPE "subscription_status"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "subscription_status" AS ENUM ('none', 'basic', 'advanced', 'pro')
    `);
    await queryRunner.query(`
      CREATE TABLE "subscription_logs" (
        "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
        "publisher_id" uuid NOT NULL,
        "subscription_tier" subscription_status NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT (now()),
        "updated_at" timestamptz NOT NULL DEFAULT (now())
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_logs"
        ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE
    `);

    await queryRunner.query(`DROP TABLE "payments"`);

    await queryRunner.query(
      `ALTER TABLE "publishers" ADD COLUMN "subscription_tier" subscription_status`,
    );
    await queryRunner.query(`
      UPDATE "publishers" p
      SET "subscription_tier" = pl."name"::subscription_status
      FROM "plans" pl
      WHERE pl."id" = p."plan_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "publishers"
        DROP COLUMN "plan_id",
        DROP COLUMN "plan_starts_at",
        DROP COLUMN "plan_ends_at"
    `);

    await queryRunner.query(`DROP TABLE "plans"`);
    await queryRunner.query(`DROP TYPE "payment_status"`);
  }
}
