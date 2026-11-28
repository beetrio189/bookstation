import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thay index books (publisher_id) bằng (publisher_id, created_at DESC): N sách mới nhất
 * của một NXB (hàng "Sách mới từ NXB …", GET /publisher/books) đọc thẳng từ index,
 * không phải sắp xếp hết sách của NXB. Chỗ chỉ lọc / đếm theo publisher_id vẫn dùng được.
 */
export class BookPublisherCreatedAtIndex1795120000000 implements MigrationInterface {
  name = 'BookPublisherCreatedAtIndex1795120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "books_publisher_id_created_at_idx" ON "books" ("publisher_id", "created_at" DESC)`,
    );
    await queryRunner.query(`DROP INDEX "books_publisher_id_idx"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "books_publisher_id_idx" ON "books" ("publisher_id")`,
    );
    await queryRunner.query(`DROP INDEX "books_publisher_id_created_at_idx"`);
  }
}
