import { MigrationInterface, QueryRunner } from 'typeorm';

// Tên thể loại trùng khi giống nhau sau khi bỏ hoa thường và dấu ("Kinh tế" = "kinh te")
export class GenreNameUnaccentUnique1795070000000 implements MigrationInterface {
  name = 'GenreNameUnaccentUnique1795070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "genres" DROP CONSTRAINT "genres_name_key"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "genres_name_unaccent_key" ON "genres" (lower(f_unaccent("name")))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "genres_name_unaccent_key"`);
    await queryRunner.query(
      `ALTER TABLE "genres" ADD CONSTRAINT "genres_name_key" UNIQUE ("name")`,
    );
  }
}
