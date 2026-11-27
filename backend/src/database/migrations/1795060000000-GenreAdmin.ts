import { MigrationInterface, QueryRunner } from 'typeorm';

// Admin/KDV quản lý thể loại: log genre_* và xóa thể loại thì sách chỉ mất thể loại đó
const ACTIONS_WITHOUT_GENRE = [
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
  'plan_deletion',
];

const GENRE_ACTIONS = ['genre_creation', 'genre_update', 'genre_deletion'];

const recreateGenreFk = (onDelete: string) =>
  `ALTER TABLE "book_genres" DROP CONSTRAINT "book_genres_genre_id_fkey",
    ADD CONSTRAINT "book_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres" ("id")
    ${onDelete} DEFERRABLE INITIALLY IMMEDIATE`;

export class GenreAdmin1795060000000 implements MigrationInterface {
  name = 'GenreAdmin1795060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let after = 'plan_deletion';

    for (const action of GENRE_ACTIONS) {
      await queryRunner.query(
        `ALTER TYPE "system_action_type" ADD VALUE IF NOT EXISTS '${action}' AFTER '${after}'`,
      );
      after = action;
    }

    await queryRunner.query(recreateGenreFk('ON DELETE CASCADE'));
  }

  // Postgres không xóa được giá trị enum: tạo lại kiểu. Còn dòng log genre_* thì USING báo lỗi, migration dừng.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(recreateGenreFk(''));

    const values = ACTIONS_WITHOUT_GENRE.map((v) => `'${v}'`).join(', ');

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
