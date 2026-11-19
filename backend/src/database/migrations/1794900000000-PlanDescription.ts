import { MigrationInterface, QueryRunner } from 'typeorm';

// Mô tả gói hiện ở trang chọn gói; admin nhập lúc thêm gói
export class PlanDescription1794900000000 implements MigrationInterface {
  name = 'PlanDescription1794900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plans" ADD COLUMN "description" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "description"`);
  }
}
