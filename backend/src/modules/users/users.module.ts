import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from './entities/provider.entity';
import { User } from './entities/user.entity';
import { UnverifiedUsersCleanupJob } from './unverified-users-cleanup.job';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Provider])],
  controllers: [UsersController],
  providers: [UsersService, UnverifiedUsersCleanupJob],
  exports: [UsersService],
})
export class UsersModule {}
