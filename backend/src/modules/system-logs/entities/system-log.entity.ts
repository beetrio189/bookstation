import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SystemActionType } from '../../../utils/enums/system-action-type.enum';

// Không có khóa ngoại tới users: xóa hẳn người làm / người bị tác động thì log vẫn giữ uuid
@Entity('system_logs')
export class SystemLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  // Tên lúc ghi log: users.name, người làm là NXB thì publisher_name
  @Column({ name: 'actor_name', type: 'text' })
  actorName: string;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: SystemActionType,
    enumName: 'system_action_type',
  })
  actionType: SystemActionType;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  /**
   * Tên lúc ghi log, tùy action_type: tài khoản = users.name, publisher_* =
   * publisher_name, book_* = tiêu đề sách, review_deletion = "<người viết> tại <sách>"
   */
  @Column({ name: 'target_name', type: 'text' })
  targetName: string;

  // Lý do do người làm nhập, có thể là chuỗi rỗng
  @Column({ type: 'text', default: '' })
  note: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
