import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ContributorRole {
  AUTHOR = 'author',
  TRANSLATOR = 'translator',
  EDITOR = 'editor',
  ILLUSTRATOR = 'illustrator',
}

export interface Contributor {
  name: string;
  role: ContributorRole;
}

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'publisher_id', type: 'uuid' })
  publisherId: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  contributors: Contributor[];

  @Column({ name: 'published_year', type: 'smallint', nullable: true })
  publishedYear: number | null;

  // public_id ảnh bìa trên Cloudinary; FE tự ghép URL kèm cỡ ảnh
  @Column({ name: 'cover_public_id', type: 'text', nullable: true })
  coverPublicId: string | null;

  @Column({
    name: 'rating_avg',
    type: 'numeric',
    precision: 3,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  ratingAvg: number | null;

  @Column({ name: 'rating_count', type: 'integer', default: 0 })
  ratingCount: number;

  @Column({
    name: 'search_text',
    type: 'text',
    insert: false,
    update: false,
    select: false,
  })
  searchText: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
