import { MigrationInterface, QueryRunner } from 'typeorm';

// Logo NXB lưu trên Cloudinary như ảnh bìa: DB chỉ giữ public_id, FE tự ghép URL (t_logo_small / t_logo_large)
export class PublisherLogoPublicId1795110000000 implements MigrationInterface {
  name = 'PublisherLogoPublicId1795110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "publishers" RENAME COLUMN "logo_url" TO "logo_public_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "publishers" RENAME COLUMN "logo_public_id" TO "logo_url"`,
    );
  }
}
