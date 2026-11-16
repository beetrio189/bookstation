import { MigrationInterface, QueryRunner } from 'typeorm';

const ACTIONS_BEFORE = [
  'book_review',
  'editor_creation',
  'review_deletion',
  'admin_creation',
  'reader_lock',
  'book_creation',
  'book_update',
  'book_deletion',
  'publisher_creation',
  'moderator_creation',
  'reader_unlock',
];

const ACTIONS_AFTER = [
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

const toList = (values: string[]) => values.map((v) => `'${v}'`).join(', ');

/**
 * Postgres không xóa được giá trị khỏi enum: đổi tên kiểu cũ, tạo kiểu mới,
 * chuyển cột system_logs.action_type sang kiểu mới rồi xóa kiểu cũ.
 * Dòng log có giá trị không còn trong kiểu mới thì USING báo lỗi, migration dừng.
 */
const recreate = async (queryRunner: QueryRunner, values: string[]) => {
  await queryRunner.query(
    `ALTER TYPE "system_action_type" RENAME TO "system_action_type_old"`,
  );
  await queryRunner.query(
    `CREATE TYPE "system_action_type" AS ENUM (${toList(values)})`,
  );
  await queryRunner.query(
    `ALTER TABLE "system_logs" ALTER COLUMN "action_type" TYPE "system_action_type" USING "action_type"::text::"system_action_type"`,
  );
  await queryRunner.query(`DROP TYPE "system_action_type_old"`);
};

export class AccountActionTypes1794814985028 implements MigrationInterface {
  name = 'AccountActionTypes1794814985028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await recreate(queryRunner, ACTIONS_AFTER);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await recreate(queryRunner, ACTIONS_BEFORE);
  }
}
