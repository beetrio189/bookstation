import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Gói Free là dòng duy nhất có duration 'infinity': nhận diện bằng duration, không bằng tên (admin đổi tên được)
export const FREE_PLAN_DURATION = 'infinity';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'interval' })
  duration: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer' })
  price: number;

  @Column({ name: 'book_limit', type: 'integer' })
  bookLimit: number;

  @Column({ name: 'editor_limit', type: 'integer' })
  editorLimit: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
