import { MigrationInterface, QueryRunner } from 'typeorm';

// Log admin xóa gói (DELETE /admin/plans/:id)
const ACTIONS_WITHOUT_PLAN_DELETION = [
  'moderator_creation',
  'moderator_deletion',
  'moderator_password_reset',
  'publisher_creation',
  'publisher_update',
  'publisher_deletion',
  'publisher_suspended',
  'publisher_unsuspended',
  'publisher_password_reset',
  'editor_creation',
  'editor_update',
  'editor_deletion',
  'editor_password_reset',
  'reader_lock',
  'reader_unlock',
  'book_creation',
  'book_update',
  'book_deletion',
  'book_review',
  'review_deletion',
  'plan_creation',
  'plan_update',
];

export class PlanDeletionAction1795000000000 implements MigrationInterface {
  name = 'PlanDeletionAction1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "system_action_type" ADD VALUE IF NOT EXISTS 'plan_deletion' AFTER 'plan_update'`,
    );
  }

  // Postgres không xóa được giá trị enum: tạo lại kiểu. Còn dòng log loại này thì USING báo lỗi, migration dừng.
  public async down(queryRunner: QueryRunner): Promise<void> {
    const values = ACTIONS_WITHOUT_PLAN_DELETION.map((v) => `'${v}'`).join(
      ', ',
    );

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
