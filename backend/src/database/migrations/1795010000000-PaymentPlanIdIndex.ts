import { MigrationInterface, QueryRunner } from 'typeorm';

// Index payments.plan_id: tìm NXB đang dùng gói (sửa / xóa gói) và ON DELETE SET NULL khi xóa gói
// khỏi phải quét cả bảng payments
export class PaymentPlanIdIndex1795010000000 implements MigrationInterface {
  name = 'PaymentPlanIdIndex1795010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "payments_plan_id_idx" ON "payments" ("plan_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "payments_plan_id_idx"`);
  }
}
