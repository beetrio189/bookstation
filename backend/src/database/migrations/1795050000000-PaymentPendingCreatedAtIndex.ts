import { MigrationInterface, QueryRunner } from 'typeorm';

// Index partial cho job chốt đơn quá hạn: chỉ đơn pending, sắp theo created_at
export class PaymentPendingCreatedAtIndex1795050000000 implements MigrationInterface {
  name = 'PaymentPendingCreatedAtIndex1795050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "payments_pending_created_at_idx" ON "payments" ("created_at") WHERE "status" = 'pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "payments_pending_created_at_idx"`);
  }
}
