import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OneTimeTokenService } from './one-time-token.service';

@Module({
  imports: [UsersModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService, OneTimeTokenService],
})
export class AuthModule {}
