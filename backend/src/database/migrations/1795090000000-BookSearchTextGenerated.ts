import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * books.search_text thành cột generated (như publishers.search_text): DB tự ghép
 * tên sách + tên các contributors, chữ thường, không dấu. translate bỏ ngoặc,
 * nháy, phẩy, gạch chéo ngược do jsonb::text in ra: tên cách nhau đúng một dấu cách.
 * Postgres không đổi được cột thường thành generated nên xóa rồi thêm lại (index GIN đi theo).
 */
export class BookSearchTextGenerated1795090000000 implements MigrationInterface {
  name = 'BookSearchTextGenerated1795090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "search_text"`);
    await queryRunner.query(`
      ALTER TABLE "books" ADD COLUMN "search_text" text NOT NULL GENERATED ALWAYS AS (
        f_unaccent(lower(
          "title" || ' ' ||
          translate(jsonb_path_query_array("contributors", '$[*].name')::text, '[]",\\', '')
        ))
      ) STORED
    `);
    await queryRunner.query(
      `CREATE INDEX "books_search_text_idx" ON "books" USING GIN ("search_text" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "books"."search_text" IS 'Tự sinh: title + tên contributors, chữ thường, không dấu; dùng GIN trigram'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Giữ nguyên giá trị đang có, chỉ bỏ biểu thức sinh
    await queryRunner.query(
      `ALTER TABLE "books" ALTER COLUMN "search_text" DROP EXPRESSION`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "books"."search_text" IS 'Lưu search text, xây từ title || các trường trong json contributors'`,
    );
  }
}
