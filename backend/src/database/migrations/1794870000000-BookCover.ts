import { MigrationInterface, QueryRunner } from 'typeorm';

// Ảnh bìa sách (hiện ở thẻ sách trên trang chủ); chưa có ảnh thì FE dùng bìa mặc định
export class BookCover1794870000000 implements MigrationInterface {
  name = 'BookCover1794870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "books" ADD COLUMN "cover_url" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "cover_url"`);
  }
}
