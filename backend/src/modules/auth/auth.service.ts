import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';
import { UserStatus } from '../../utils/enums/user-status.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  isPasswordWithinLimit,
  verifyPassword,
} from '../../utils/password';
import { JwtPayload } from '../../utils/types/jwt-payload';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from './one-time-token.service';
import { RefreshTokenService } from './refresh-token.service';

const VERIFY_EMAIL_TTL_SECONDS = 24 * 60 * 60;
const RESET_PASSWORD_TTL_SECONDS = 30 * 60;
const POSTGRES_UNIQUE_VIOLATION = '23505';

const isLocked = (user: User): boolean => user.status === UserStatus.LOCKED;

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
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
  ) {}

  async register({ email, password, name }: RegisterDto) {
    if (await this.usersService.findLocalProvider(email)) {
      throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
    }

    const user = await this.createReader(
      email,
      await hashPassword(password),
      name,
    );

    await this.sendVerificationEmail(user.id, email);

    return { id: user.id, email, name: user.name };
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.oneTimeTokenService.consume(
      OneTimeTokenPurpose.VERIFY_EMAIL,
      token,
    );

    if (!userId) {
      throw new AppException(ERRORS.INVALID_TOKEN);
    }

    await this.usersService.markLocalVerified(userId);
  }

  async resendVerification(email: string): Promise<void> {
    const provider = await this.usersService.findLocalProvider(email);

    if (provider && !provider.verified) {
      // Không await để thời gian phản hồi không lộ email nào đã đăng ký
      void this.sendVerificationEmail(provider.userId, email);
    }
  }

  async login({ email, password }: LoginDto) {
    const provider = await this.usersService.findLocalProviderForLogin(email);
    const isPasswordCorrect = await verifyPassword(
      provider?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    );

    if (
      !provider?.passwordHash ||
      !isPasswordCorrect ||
      !isPasswordWithinLimit(password)
    ) {
      throw new AppException(ERRORS.INVALID_CREDENTIALS);
    }

    if (isLocked(provider.user)) {
      throw new AppException(ERRORS.ACCOUNT_LOCKED);
    }

    if (!provider.verified) {
      throw new AppException(ERRORS.EMAIL_NOT_VERIFIED);
    }

    return this.issueTokens(provider.user);
  }

  async refresh(refreshToken: string | undefined) {
    const userId =
      refreshToken && (await this.refreshTokenService.consume(refreshToken));
    const user = userId ? await this.usersService.findById(userId) : null;

    if (!user) {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    if (isLocked(user)) {
      throw new AppException(ERRORS.ACCOUNT_LOCKED);
    }

    return this.issueTokens(user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.refreshTokenService.consume(refreshToken);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const provider = await this.usersService.findLocalProvider(email);

    if (provider?.verified && !isLocked(provider.user)) {
      void this.sendPasswordResetEmail(provider.userId, email);
    }
  }

  async resetPassword({ token, newPassword }: ResetPasswordDto): Promise<void> {
    const userId = await this.oneTimeTokenService.consume(
      OneTimeTokenPurpose.RESET_PASSWORD,
      token,
    );

    if (!userId) {
      throw new AppException(ERRORS.INVALID_TOKEN);
    }

    await this.usersService.updateLocalPassword(
      userId,
      await hashPassword(newPassword),
    );
    await this.refreshTokenService.revokeAll(userId);
  }

  async changePassword(
    userId: string,
    { currentPassword, newPassword }: ChangePasswordDto,
  ): Promise<void> {
    const provider =
      await this.usersService.findLocalProviderWithPassword(userId);

    if (!provider?.passwordHash) {
      throw new AppException(ERRORS.PASSWORD_NOT_SET);
    }

    if (
      !isPasswordWithinLimit(currentPassword) ||
      !(await verifyPassword(provider.passwordHash, currentPassword))
    ) {
      throw new AppException(ERRORS.WRONG_PASSWORD);
    }

    await this.usersService.updateLocalPassword(
      userId,
      await hashPassword(newPassword),
    );
    await this.refreshTokenService.revokeAll(userId);
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    return {
      id: user.id,
      name: user.name,
      notificationEmail: user.notificationEmail,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
    };
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      notificationEmail: user.notificationEmail,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken: await this.refreshTokenService.create(user.id),
    };
  }

  private async createReader(
    email: string,
    passwordHash: string,
    name: string,
  ): Promise<User> {
    try {
      return await this.usersService.createReader({
        email,
        passwordHash,
        name,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
      }

      throw error;
    }
  }

  private async sendVerificationEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    try {
      const token = await this.oneTimeTokenService.create(
        OneTimeTokenPurpose.VERIFY_EMAIL,
        userId,
        VERIFY_EMAIL_TTL_SECONDS,
      );

      await this.mailService.sendVerificationEmail(email, token);
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async sendPasswordResetEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    try {
      const token = await this.oneTimeTokenService.create(
        OneTimeTokenPurpose.RESET_PASSWORD,
        userId,
        RESET_PASSWORD_TTL_SECONDS,
      );

      await this.mailService.sendPasswordResetEmail(email, token);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
