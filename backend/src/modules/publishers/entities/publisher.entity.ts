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

  // public_id trên Cloudinary, FE tự ghép URL (t_logo_small / t_logo_large)
  @Column({ name: 'logo_public_id', type: 'text', nullable: true })
  logoPublicId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Credit (VND) còn lại từ phần chưa dùng của các kỳ bị cắt khi đổi gói, trừ vào lần mua sau
  @Column({ name: 'credit_balance', type: 'integer', default: 0 })
  creditBalance: number;

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
