import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IdentityProvider } from '../../../utils/enums/identity-provider.enum';
import { User } from './user.entity';

@Entity('providers')
export class Provider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'boolean', nullable: true })
  verified: boolean | null;

  @Column({
    type: 'enum',
    enum: IdentityProvider,
    enumName: 'identity_provider',
  })
  provider: IdentityProvider;

  @Column({ name: 'provider_key', type: 'varchar', length: 255 })
  providerKey: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.providers)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
