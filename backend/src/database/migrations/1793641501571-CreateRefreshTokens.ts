import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokens1793641501571 implements MigrationInterface {
  name = 'CreateRefreshTokens1793641501571';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "token_hash" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT (now())
      );

      CREATE UNIQUE INDEX ON "refresh_tokens" ("token_hash");

      CREATE INDEX ON "refresh_tokens" ("user_id");

      COMMENT ON TABLE "refresh_tokens" IS 'Mỗi dòng là một phiên đăng nhập (FR-03, FR-04, FR-06). Đăng nhập trên nhiều thiết bị có nhiều dòng.';

      COMMENT ON COLUMN "refresh_tokens"."token_hash" IS 'SHA-256 của refresh token, token gốc chỉ nằm trong cookie';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
