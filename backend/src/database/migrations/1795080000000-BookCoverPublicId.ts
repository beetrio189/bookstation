import { MigrationInterface, QueryRunner } from 'typeorm';

// Ảnh bìa lưu trên Cloudinary: DB chỉ giữ public_id, FE tự ghép URL kèm cỡ ảnh
export class BookCoverPublicId1795080000000 implements MigrationInterface {
  name = 'BookCoverPublicId1795080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "books" RENAME COLUMN "cover_url" TO "cover_public_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "books" RENAME COLUMN "cover_public_id" TO "cover_url"`,
    );
  }
}
