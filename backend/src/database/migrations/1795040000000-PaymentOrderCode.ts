import { MigrationInterface, QueryRunner } from 'typeorm';

// Chuyển sang cổng thanh toán SePay. Mọi đơn (kể cả đơn trả hết bằng credit) có mã
// order_code = order_invoice_number gửi SePay ("BS" + 8 ký tự [0-9A-Z]); chỉ cần mã này để
// tra đơn (GET /order/detail/{order_invoice_number}), nên bỏ các cột riêng của VNPAY và
// payment_url (SePay nhận form POST, backend ký lại form khi "Tiếp tục thanh toán").
export class PaymentOrderCode1795040000000 implements MigrationInterface {
  name = 'PaymentOrderCode1795040000000';

  // Còn đơn không có mã hoặc mã dài hơn 10 ký tự thì câu lệnh báo lỗi, migration dừng
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME COLUMN "vnp_txn_ref" TO "order_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME CONSTRAINT "payments_vnp_txn_ref_key" TO "payments_order_code_key"`,
    );
    await queryRunner.query(`
      ALTER TABLE "payments"
        ALTER COLUMN "order_code" TYPE varchar(10),
        ALTER COLUMN "order_code" SET NOT NULL,
        DROP COLUMN "vnp_create_date",
        DROP COLUMN "vnp_transaction_no",
        DROP COLUMN "payment_url"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD COLUMN "payment_url" text,
        ADD COLUMN "vnp_transaction_no" varchar(50),
        ADD COLUMN "vnp_create_date" char(14),
        ALTER COLUMN "order_code" DROP NOT NULL,
        ALTER COLUMN "order_code" TYPE varchar(100)`);
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME CONSTRAINT "payments_order_code_key" TO "payments_vnp_txn_ref_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME COLUMN "order_code" TO "vnp_txn_ref"`,
    );
  }
}
