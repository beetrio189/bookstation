import { MigrationInterface, QueryRunner } from 'typeorm';

// Hạ / đổi gói ngay với credit: phần tiền chưa dùng của kỳ cũ thành credit của NXB,
// trừ vào lần mua sau. vnp_txn_ref NULL được cho đơn trả hết bằng credit (không qua VNPAY).
// vnp_create_date vốn đã NULL được. signature: HMAC-SHA256 (hex) các cột tiền / kỳ của đơn,
// key trong env PAYMENT_HMAC_KEY, để phát hiện dòng bị sửa tay trong DB.
export class PaymentCredit1795020000000 implements MigrationInterface {
  name = 'PaymentCredit1795020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "publishers" ADD COLUMN "credit_balance" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments"
        ADD COLUMN "credit_used" integer NOT NULL DEFAULT 0,
        ADD COLUMN "credit_returned" integer NOT NULL DEFAULT 0,
        ADD COLUMN "signature" char(64),
        ALTER COLUMN "vnp_txn_ref" DROP NOT NULL`,
    );
  }

  // Còn đơn không có vnp_txn_ref thì SET NOT NULL báo lỗi, migration dừng
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments"
        ALTER COLUMN "vnp_txn_ref" SET NOT NULL,
        DROP COLUMN "signature",
        DROP COLUMN "credit_returned",
        DROP COLUMN "credit_used"`,
    );
    await queryRunner.query(
      `ALTER TABLE "publishers" DROP COLUMN "credit_balance"`,
    );
  }
}
