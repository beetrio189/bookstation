import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedRoles1793612042489 implements MigrationInterface {
  name = 'SeedRoles1793612042489';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "roles" ("code", "name") VALUES
        ('reader', 'Độc giả'),
        ('librarian', 'Thủ thư'),
        ('publisher', 'Nhà xuất bản'),
        ('admin', 'Quản trị viên')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "roles"
      WHERE "code" IN ('reader', 'librarian', 'publisher', 'admin')
    `);
  }
}
