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

  @Column({ name: 'vnp_txn_ref', type: 'varchar', length: 100 })
  vnpTxnRef: string;

  // yyyyMMddHHmmss (giờ VN), cần khi tra cứu giao dịch với VNPAY
  @Column({ name: 'vnp_create_date', type: 'char', length: 14, nullable: true })
  vnpCreateDate: string | null;

  // Mã giao dịch phía VNPAY, điền khi nhận IPN
  @Column({
    name: 'vnp_transaction_no',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  vnpTransactionNo: string | null;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
