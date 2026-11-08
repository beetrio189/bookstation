import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleCode } from '../../../utils/enums/role-code.enum';
import { UserStatus } from '../../../utils/enums/user-status.enum';
import { Provider } from './provider.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: RoleCode, enumName: 'role' })
  role: RoleCode;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'notification_email', type: 'varchar', length: 255 })
  notificationEmail: string;

  @Column({ name: 'notification_email_verified', type: 'boolean' })
  notificationEmailVerified: boolean;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Provider, (provider) => provider.user)
  providers: Provider[];
}
