import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lưu tên người làm và đối tượng tại thời điểm ghi log, để log vẫn đọc được
 * khi người/đối tượng đã bị xóa hẳn. Bảng chưa có dữ liệu thật nên thêm
 * NOT NULL luôn, không cần giá trị mặc định.
 */
export class SystemLogNames1794832000000 implements MigrationInterface {
  name = 'SystemLogNames1794832000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_logs" ADD COLUMN "actor_name" text NOT NULL, ADD COLUMN "target_name" text NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_logs" DROP COLUMN "target_name", DROP COLUMN "actor_name"`,
    );
  }
}
