import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';
import { RoleCode } from '../../utils/enums/role-code.enum';
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

const getRoleCodes = (user: User): RoleCode[] =>
  user.userRoles.map(({ role }) => role.code as RoleCode);

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

  async login({ email, password }: LoginDto) {
    const user = await this.usersService.findByEmailForLogin(email);
    const isPasswordCorrect = await verifyPassword(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    );

    if (
      !user?.passwordHash ||
      !isPasswordCorrect ||
      !isPasswordWithinLimit(password)
    ) {
      throw new AppException(ERRORS.INVALID_CREDENTIALS);
    }

    if (user.lockedAt) {
      throw new AppException(ERRORS.ACCOUNT_LOCKED);
    }

    if (!user.emailVerifiedAt) {
      throw new AppException(ERRORS.EMAIL_NOT_VERIFIED);
    }

    await this.usersService.updateLastLogin(user.id);

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string | undefined) {
    const userId =
      refreshToken && (await this.refreshTokenService.consume(refreshToken));
    const user = userId
      ? await this.usersService.findByIdWithRoles(userId)
      : null;

    if (!user) {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    if (user.lockedAt) {
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
    const user = await this.usersService.findByEmail(email);

    if (user?.emailVerifiedAt && !user.lockedAt) {
      void this.sendPasswordResetEmail(user);
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

    await this.usersService.updatePassword(
      userId,
      await hashPassword(newPassword),
    );
    await this.refreshTokenService.revokeAll(userId);
  }

  async changePassword(
    userId: string,
    { currentPassword, newPassword }: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.usersService.findByIdWithPassword(userId);

    if (!user) {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    if (!user.passwordHash) {
      throw new AppException(ERRORS.PASSWORD_NOT_SET);
    }

    if (
      !isPasswordWithinLimit(currentPassword) ||
      !(await verifyPassword(user.passwordHash, currentPassword))
    ) {
      throw new AppException(ERRORS.WRONG_PASSWORD);
    }

    await this.usersService.updatePassword(
      userId,
      await hashPassword(newPassword),
    );
    await this.refreshTokenService.revokeAll(userId);
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findByIdWithRoles(userId);

    if (!user) {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      roles: getRoleCodes(user),
    };
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: getRoleCodes(user),
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken: await this.refreshTokenService.create(user.id),
    };
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

  private async sendPasswordResetEmail(user: User): Promise<void> {
    try {
      const token = await this.oneTimeTokenService.create(
        OneTimeTokenPurpose.RESET_PASSWORD,
        user.id,
        RESET_PASSWORD_TTL_SECONDS,
      );

      await this.mailService.sendPasswordResetEmail(user.email, token);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
