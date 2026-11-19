import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('publishers')
export class Publisher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Tên hiển thị của NXB ở mọi nơi (không dùng users.name)
  @Column({ name: 'publisher_name', type: 'varchar', length: 255 })
  publisherName: string;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Cột generated trong DB: f_unaccent(publisher_name), có index GIN trigram
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
