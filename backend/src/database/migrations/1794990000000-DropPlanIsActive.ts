import { MigrationInterface, QueryRunner } from 'typeorm';

// Gói không bán nữa thì xóa hẳn (payments giữ snapshot, plan_id thành NULL), không
// ẩn: bỏ cột is_active. Trigger gói Free (duration = 'infinity') giờ chặn đổi
// duration / price và chặn xóa.
export class DropPlanIsActive1794990000000 implements MigrationInterface {
  name = 'DropPlanIsActive1794990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Bỏ is_active khỏi trigger trước khi xóa cột (hàm còn tham chiếu sẽ lỗi lúc chạy)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_free_plan"() RETURNS trigger AS $$
      BEGIN
        IF OLD."duration" = 'infinity' THEN
          IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Không được xóa gói Free';
          END IF;

          IF NEW."duration" IS DISTINCT FROM OLD."duration"
            OR NEW."price" IS DISTINCT FROM OLD."price" THEN
            RAISE EXCEPTION 'Không được đổi duration, price của gói Free';
          END IF;
        END IF;

        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "plans_protect_free_plan_delete"
      BEFORE DELETE ON "plans"
      FOR EACH ROW EXECUTE FUNCTION "protect_free_plan"()
    `);
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "is_active"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plans" ADD COLUMN "is_active" bool NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `DROP TRIGGER "plans_protect_free_plan_delete" ON "plans"`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_free_plan"() RETURNS trigger AS $$
      BEGIN
        IF OLD."duration" = 'infinity' AND (
          NEW."duration" IS DISTINCT FROM OLD."duration"
          OR NEW."price" IS DISTINCT FROM OLD."price"
          OR NEW."is_active" IS DISTINCT FROM OLD."is_active"
        ) THEN
          RAISE EXCEPTION 'Không được đổi duration, price, is_active của gói Free';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
  }
}
