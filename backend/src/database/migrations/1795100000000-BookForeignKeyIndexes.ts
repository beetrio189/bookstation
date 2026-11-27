import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - books (publisher_id): danh sách sách của NXB, đếm số sách so với bookLimit
 * - book_genres (genre_id): đếm số sách của thể loại, lọc sách theo thể loại
 *   (unique (book_id, genre_id) không dùng được khi chỉ tìm theo genre_id)
 */
export class BookForeignKeyIndexes1795100000000 implements MigrationInterface {
  name = 'BookForeignKeyIndexes1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "books_publisher_id_idx" ON "books" ("publisher_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "book_genres_genre_id_idx" ON "book_genres" ("genre_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "book_genres_genre_id_idx"`);
    await queryRunner.query(`DROP INDEX "books_publisher_id_idx"`);
  }
}
