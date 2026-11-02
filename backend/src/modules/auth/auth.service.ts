import { Injectable, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { hashPassword } from '../../utils/password';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from './one-time-token.service';

const VERIFY_EMAIL_TTL_SECONDS = 24 * 60 * 60;
const POSTGRES_UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly oneTimeTokenService: OneTimeTokenService,
  ) {}

  async register({ email, password, displayName }: RegisterDto) {
    if (await this.usersService.findByEmail(email)) {
      throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
    }

    const user = await this.createReader(
      email,
      await hashPassword(password),
      displayName,
    );

    await this.sendVerificationEmail(user);

    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.oneTimeTokenService.consume(
      OneTimeTokenPurpose.VERIFY_EMAIL,
      token,
    );

    if (!userId) {
      throw new AppException(ERRORS.INVALID_TOKEN);
    }

    await this.usersService.markEmailVerified(userId);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (user && !user.emailVerifiedAt) {
      // Không await để thời gian phản hồi không lộ email nào đã đăng ký
      void this.sendVerificationEmail(user);
    }
  }

  private async createReader(
    email: string,
    passwordHash: string,
    displayName: string,
  ): Promise<User> {
    try {
      return await this.usersService.createReader({
        email,
        passwordHash,
        displayName,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
      }

      throw error;
    }
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    try {
      const token = await this.oneTimeTokenService.create(
        OneTimeTokenPurpose.VERIFY_EMAIL,
        user.id,
        VERIFY_EMAIL_TTL_SECONDS,
      );

      await this.mailService.sendVerificationEmail(user.email, token);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
