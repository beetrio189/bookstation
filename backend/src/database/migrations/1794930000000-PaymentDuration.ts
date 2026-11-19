import { MigrationInterface, QueryRunner } from 'typeorm';

// Snapshot thời hạn gói lúc mua: period_ends_at có thể bị đặt về now() khi hủy /
// hạ gói, nên không suy ra thời hạn gốc từ period được. Bảng đang rỗng nên NOT NULL được.
export class PaymentDuration1794930000000 implements MigrationInterface {
  name = 'PaymentDuration1794930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "duration" interval NOT NULL CHECK ("duration" > interval '0')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "duration"`);
  }
}
