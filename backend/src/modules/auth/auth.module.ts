import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { GoogleOAuthService } from './google-oauth.service';
import { OneTimeTokenService } from './one-time-token.service';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshToken]), UsersModule, MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthService,
    OneTimeTokenService,
    RefreshTokenService,
  ],
})
export class AuthModule {}
