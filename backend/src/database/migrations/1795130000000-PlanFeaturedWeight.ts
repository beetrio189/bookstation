import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trọng số lên hàng "Sách mới từ NXB …" ở trang chủ: admin đặt cho từng gói (số
 * nguyên dương, càng cao càng hay được chọn), chép sang payments lúc mua như
 * book_limit / editor_limit nên NXB giữ đúng trọng số đã mua đến hết kỳ.
 */
export class PlanFeaturedWeight1795130000000 implements MigrationInterface {
  name = 'PlanFeaturedWeight1795130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plans" ADD COLUMN "featured_weight" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "featured_weight" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN "featured_weight"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" DROP COLUMN "featured_weight"`,
    );
  }
}
