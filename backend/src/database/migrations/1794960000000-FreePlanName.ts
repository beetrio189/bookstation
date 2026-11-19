import { MigrationInterface, QueryRunner } from 'typeorm';

// Đổi tên gói Free mặc định 'none' → 'Free' (tên gói cũng là tên hiển thị), trigger bảo vệ theo tên mới
const protectFunction = (freeName: string) => `
  CREATE OR REPLACE FUNCTION "protect_free_plan"() RETURNS trigger AS $$
  BEGIN
    IF OLD."name" = '${freeName}' AND (
      NEW."duration" IS DISTINCT FROM OLD."duration"
      OR NEW."price" IS DISTINCT FROM OLD."price"
      OR NEW."is_active" IS DISTINCT FROM OLD."is_active"
    ) THEN
      RAISE EXCEPTION 'Không được đổi duration, price, is_active của gói ${freeName}';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql
`;

export class FreePlanName1794960000000 implements MigrationInterface {
  name = 'FreePlanName1794960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "plans" SET "name" = 'Free' WHERE "name" = 'none' AND "duration" = 'infinity'`,
    );
    await queryRunner.query(protectFunction('Free'));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "plans" SET "name" = 'none' WHERE "name" = 'Free' AND "duration" = 'infinity'`,
    );
    await queryRunner.query(protectFunction('none'));
  }
}
