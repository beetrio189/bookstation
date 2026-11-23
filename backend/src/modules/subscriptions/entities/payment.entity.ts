import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentStatus } from '../../../utils/enums/payment-status.enum';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // NULL khi NXB / gói đã bị xóa (ON DELETE SET NULL); lịch sử đọc từ cột snapshot
  @Column({ name: 'publisher_id', type: 'uuid', nullable: true })
  publisherId: string | null;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  // Snapshot lúc mua
  @Column({ name: 'publisher_name', type: 'varchar', length: 255 })
  publisherName: string;

  @Column({ name: 'plan_name', type: 'varchar', length: 50 })
  planName: string;

  // Thời hạn gói lúc mua (interval); giữ nguyên kể cả khi period_ends_at bị đặt về now() do hủy / hạ gói
  @Column({ type: 'interval' })
  duration: string;

  @Column({ name: 'book_limit', type: 'integer' })
  bookLimit: number;

  @Column({ name: 'editor_limit', type: 'integer' })
  editorLimit: number;

  // Giá lúc mua (VND), đổi plans.price sau này không ảnh hưởng lịch sử
  @Column({ type: 'integer' })
  price: number;

  // Credit (VND) trừ vào giá khi mua đơn này
  @Column({ name: 'credit_used', type: 'integer', default: 0 })
  creditUsed: number;

  // Credit (VND) hoàn lại cho NXB khi kỳ của đơn này bị cắt ngang do đổi gói
  @Column({ name: 'credit_returned', type: 'integer', default: 0 })
  creditReturned: number;

  // order_invoice_number gửi SePay ("BS" + 8 ký tự [0-9A-Z]), dùng để tra đơn bên SePay;
  // đơn trả hết bằng credit cũng có mã
  @Column({
    name: 'order_code',
    type: 'varchar',
    length: 10,
    unique: true,
  })
  orderCode: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  // Khoảng thời gian gói được mua; điền khi thanh toán thành công
  @Column({ name: 'period_starts_at', type: 'timestamptz', nullable: true })
  periodStartsAt: Date | null;

  @Column({ name: 'period_ends_at', type: 'timestamptz', nullable: true })
  periodEndsAt: Date | null;

  // HMAC-SHA256 (hex) các cột tiền / kỳ, xem payment-signature.ts; ghi lại mỗi lần đổi các cột đó
  @Column({ type: 'char', length: 64, nullable: true })
  signature: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
