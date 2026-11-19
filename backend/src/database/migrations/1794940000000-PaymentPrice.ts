import { MigrationInterface, QueryRunner } from 'typeorm';

// payments.amount → price (giá gói lúc mua, cùng tên với plans.price)
export class PaymentPrice1794940000000 implements MigrationInterface {
  name = 'PaymentPrice1794940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME COLUMN "amount" TO "price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME CONSTRAINT "payments_amount_check" TO "payments_price_check"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME CONSTRAINT "payments_price_check" TO "payments_amount_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME COLUMN "price" TO "amount"`,
    );
  }
}
