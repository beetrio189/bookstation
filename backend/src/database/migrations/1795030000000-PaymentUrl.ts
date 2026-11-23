import { MigrationInterface, QueryRunner } from 'typeorm';

// Link VNPAY đã ký lúc tạo đơn: đưa lại cho NXB "Tiếp tục thanh toán" khi đơn còn pending.
// NULL khi đơn không qua VNPAY (trả hết bằng credit).
export class PaymentUrl1795030000000 implements MigrationInterface {
  name = 'PaymentUrl1795030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "payment_url" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "payment_url"`);
  }
}
