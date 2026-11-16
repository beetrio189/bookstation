import { MigrationInterface, QueryRunner } from 'typeorm';

const ACTIONS_WITHOUT_RESET = [
  'moderator_creation',
  'moderator_deletion',
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

export class ModeratorPasswordReset1794840000000 implements MigrationInterface {
  name = 'ModeratorPasswordReset1794840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "system_action_type" ADD VALUE IF NOT EXISTS 'moderator_password_reset' AFTER 'moderator_deletion'`,
    );
  }

  // Postgres không xóa được giá trị enum: tạo lại kiểu. Còn dòng log loại này thì USING báo lỗi, migration dừng.
  public async down(queryRunner: QueryRunner): Promise<void> {
    const values = ACTIONS_WITHOUT_RESET.map((v) => `'${v}'`).join(', ');

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
