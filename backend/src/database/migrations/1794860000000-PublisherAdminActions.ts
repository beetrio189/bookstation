import { MigrationInterface, QueryRunner } from 'typeorm';

const ACTIONS_BEFORE = [
  'moderator_creation',
  'moderator_deletion',
  'moderator_password_reset',
  'publisher_creation',
  'publisher_update',
  'publisher_deletion',
  'publisher_suspended',
  'editor_creation',
  'editor_update',
  'editor_deletion',
  'reader_lock',
  'reader_unlock',
  'book_creation',
  'book_update',
  'book_deletion',
  'book_review',
  'review_deletion',
];

// Mở lại NXB, đặt lại mật khẩu NXB và biên tập viên (API quản trị NXB)
export class PublisherAdminActions1794860000000 implements MigrationInterface {
  name = 'PublisherAdminActions1794860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "system_action_type" ADD VALUE IF NOT EXISTS 'publisher_unsuspended' AFTER 'publisher_suspended'`,
    );
    await queryRunner.query(
      `ALTER TYPE "system_action_type" ADD VALUE IF NOT EXISTS 'publisher_password_reset' AFTER 'publisher_unsuspended'`,
    );
    await queryRunner.query(
      `ALTER TYPE "system_action_type" ADD VALUE IF NOT EXISTS 'editor_password_reset' AFTER 'editor_deletion'`,
    );
  }

  // Postgres không xóa được giá trị enum: tạo lại kiểu. Còn dòng log loại mới thì USING báo lỗi, migration dừng.
  public async down(queryRunner: QueryRunner): Promise<void> {
    const values = ACTIONS_BEFORE.map((v) => `'${v}'`).join(', ');

    await queryRunner.query(
      `ALTER TYPE "system_action_type" RENAME TO "system_action_type_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "system_action_type" AS ENUM (${values})`,
    );
    await queryRunner.query(
      `ALTER TABLE "system_logs" ALTER COLUMN "action_type" TYPE "system_action_type" USING "action_type"::text::"system_action_type"`,
    );
    await queryRunner.query(`DROP TYPE "system_action_type_old"`);
  }
}
