import { MigrationInterface, QueryRunner } from 'typeorm';

// Xóa NXB = xóa user của NXB và biên tập viên, phần còn lại tự xóa theo chuỗi:
// users → publishers/editors → books/surveys/subscription_logs → book_genres/book_reviews.
// violation_reports giữ lại (không có khóa ngoại tới đích).
const CASCADES: [table: string, column: string, refTable: string][] = [
  ['publishers', 'user_id', 'users'],
  ['editors', 'user_id', 'users'],
  ['editors', 'publisher_id', 'publishers'],
  ['books', 'publisher_id', 'publishers'],
  ['book_genres', 'book_id', 'books'],
  ['book_reviews', 'book_id', 'books'],
  ['surveys', 'publisher_id', 'publishers'],
  ['subscription_logs', 'publisher_id', 'publishers'],
];

const recreate = (
  [table, column, refTable]: (typeof CASCADES)[number],
  onDelete: string,
) => {
  const name = `${table}_${column}_fkey`;

  return `ALTER TABLE "${table}" DROP CONSTRAINT "${name}",
    ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${refTable}" ("id")
    ${onDelete} DEFERRABLE INITIALLY IMMEDIATE`;
};

export class PublisherDeleteCascade1794880000000 implements MigrationInterface {
  name = 'PublisherDeleteCascade1794880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const fk of CASCADES) {
      await queryRunner.query(recreate(fk, 'ON DELETE CASCADE'));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const fk of CASCADES) {
      await queryRunner.query(recreate(fk, ''));
    }
  }
}
