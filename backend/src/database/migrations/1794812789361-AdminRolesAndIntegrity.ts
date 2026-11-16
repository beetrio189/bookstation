import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Role mới: kiểm duyệt viên (moderator).
 * - Log thêm: tạo tài khoản NXB (dấu vết ai duyệt NXB nào qua hộp thư chung),
 *   tạo kiểm duyệt viên, mở khóa độc giả (cân xứng với reader_lock).
 * - Mỗi người một phiếu khảo sát: UNIQUE (user_id, survey_id), chống bấm gửi hai lần.
 * - book_reviews: index theo book_id cho danh sách đánh giá và tính rating_avg;
 *   bỏ index trên id vì khóa chính đã có index.
 * - providers.user_id ON DELETE CASCADE: xóa user là xóa luôn cách đăng nhập.
 * - CHECK: rating 1–5, rating_count >= 0, khảo sát kết thúc sau khi bắt đầu.
 */
export class AdminRolesAndIntegrity1794812789361 implements MigrationInterface {
  name = 'AdminRolesAndIntegrity1794812789361';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ADD VALUE chạy được trong transaction (Postgres 12+), chỉ là chưa dùng được
    // giá trị mới ngay trong transaction này; migration này không dùng tới
    await queryRunner.query(
      `ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'moderator'`,
    );
    await queryRunner.query(
      `ALTER TYPE "system_action_type" ADD VALUE IF NOT EXISTS 'publisher_creation'`,
    );
    await queryRunner.query(
      `ALTER TYPE "system_action_type" ADD VALUE IF NOT EXISTS 'moderator_creation'`,
    );
    await queryRunner.query(
      `ALTER TYPE "system_action_type" ADD VALUE IF NOT EXISTS 'reader_unlock'`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "survey_answers_user_id_survey_id_idx" ON "survey_answers" ("user_id", "survey_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "book_reviews_book_id_idx" ON "book_reviews" ("book_id")`,
    );
    await queryRunner.query(`DROP INDEX "book_reviews_id_idx"`);

    await queryRunner.query(
      `ALTER TABLE "providers" DROP CONSTRAINT "providers_user_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" ADD CONSTRAINT "providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE`,
    );

    await queryRunner.query(
      `ALTER TABLE "book_reviews" ADD CONSTRAINT "book_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)`,
    );
    await queryRunner.query(
      `ALTER TABLE "books" ADD CONSTRAINT "books_rating_count_check" CHECK ("rating_count" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "surveys" ADD CONSTRAINT "surveys_period_check" CHECK ("ends_at" > "starts_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "surveys" DROP CONSTRAINT "surveys_period_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "books" DROP CONSTRAINT "books_rating_count_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_reviews" DROP CONSTRAINT "book_reviews_rating_check"`,
    );

    await queryRunner.query(
      `ALTER TABLE "providers" DROP CONSTRAINT "providers_user_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" ADD CONSTRAINT "providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE`,
    );

    await queryRunner.query(
      `CREATE INDEX "book_reviews_id_idx" ON "book_reviews" ("id")`,
    );
    await queryRunner.query(`DROP INDEX "book_reviews_book_id_idx"`);
    await queryRunner.query(
      `DROP INDEX "survey_answers_user_id_survey_id_idx"`,
    );

    // Postgres không xóa được giá trị khỏi enum: moderator, publisher_creation,
    // moderator_creation, reader_unlock vẫn còn sau khi revert (vô hại nếu không dùng)
  }
}
