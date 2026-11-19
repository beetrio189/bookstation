import { MigrationInterface, QueryRunner } from 'typeorm';

// Postgres 18 đặt tên cho ràng buộc NOT NULL theo tên cột: đổi theo cột amount → price
export class PaymentPriceNotNull1794950000000 implements MigrationInterface {
  name = 'PaymentPriceNotNull1794950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME CONSTRAINT "payments_amount_not_null" TO "payments_price_not_null"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME CONSTRAINT "payments_price_not_null" TO "payments_amount_not_null"`,
    );
  }
}
