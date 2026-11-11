import { MigrationInterface, QueryRunner } from 'typeorm';

// Phục vụ job xóa tài khoản không kích hoạt sau 7 ngày: chỉ index các
// provider chưa xác minh nên index nhỏ, không phình theo số người dùng thật
export class AddProviderUnverifiedCreatedIndex1794316820306 implements MigrationInterface {
  name = 'AddProviderUnverifiedCreatedIndex1794316820306';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX "idx_provider_unverified_created" ON "providers" ("created_at") WHERE "verified" = false',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "idx_provider_unverified_created"');
  }
}
