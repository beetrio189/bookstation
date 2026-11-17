import { MigrationInterface, QueryRunner } from 'typeorm';

// Ghi chú lý do của hành động (admin/KDV nhập, có thể rỗng)
export class SystemLogNote1794850000000 implements MigrationInterface {
  name = 'SystemLogNote1794850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_logs" ADD COLUMN "note" text NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "system_logs" DROP COLUMN "note"`);
  }
}
