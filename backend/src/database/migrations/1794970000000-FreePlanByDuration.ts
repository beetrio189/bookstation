import { MigrationInterface, QueryRunner } from 'typeorm';

// Trigger bảo vệ gói Free nhận diện bằng duration = 'infinity' (dòng duy nhất) thay
// cho tên: admin được đổi tên gói Free. duration của dòng này cũng bị chặn đổi.
const protectFunction = (condition: string) => `
  CREATE OR REPLACE FUNCTION "protect_free_plan"() RETURNS trigger AS $$
  BEGIN
    IF ${condition} AND (
      NEW."duration" IS DISTINCT FROM OLD."duration"
      OR NEW."price" IS DISTINCT FROM OLD."price"
      OR NEW."is_active" IS DISTINCT FROM OLD."is_active"
    ) THEN
      RAISE EXCEPTION 'Không được đổi duration, price, is_active của gói Free';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql
`;

export class FreePlanByDuration1794970000000 implements MigrationInterface {
  name = 'FreePlanByDuration1794970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(protectFunction(`OLD."duration" = 'infinity'`));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(protectFunction(`OLD."name" = 'Free'`));
  }
}
