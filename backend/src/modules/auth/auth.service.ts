import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';
import { UserStatus } from '../../utils/enums/user-status.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '../../utils/password';
import { JwtPayload } from '../../utils/types/jwt-payload';
import { MailQueueService } from '../mail/mail-queue.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleOAuthService, GoogleProfile } from './google-oauth.service';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from './one-time-token.service';
import { RefreshTokenService } from './refresh-token.service';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const MAX_NAME_LENGTH = 100;

const isLocked = (user: User): boolean => user.status === UserStatus.LOCKED;

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly oneTimeTokenService: OneTimeTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly mailQueueService: MailQueueService,
  ) {}

  async register({ email, password, name }: RegisterDto): Promise<void> {
    if (await this.usersService.findLocalProvider(email)) {
      throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
    }

    const user = await this.createReader(
      email,
      await hashPassword(password),
      name,
    );

    await this.enqueueVerificationEmail(user.id, email);
  }

  async verifyEmail({ uid, token }: VerifyEmailDto): Promise<void> {
    const isValid = await this.oneTimeTokenService.peek(
      OneTimeTokenPurpose.VERIFY_EMAIL,
      uid,
      token,
    );

    if (!isValid || !(await this.usersService.markLocalVerified(uid))) {
      throw new AppException(ERRORS.INVALID_TOKEN);
    }

    await this.oneTimeTokenService.consume(
      OneTimeTokenPurpose.VERIFY_EMAIL,
      uid,
      token,
    );
  }

  async resendVerification(email: string): Promise<void> {
    const provider = await this.usersService.findLocalProvider(email);

    if (provider && !provider.verified && !isLocked(provider.user)) {
      void this.enqueueVerificationEmail(provider.userId, email);
    }
  }

  async login({ email, password }: LoginDto) {
    const provider = await this.usersService.findLocalProviderForLogin(email);
    const isPasswordCorrect = await verifyPassword(
      provider?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    );

    if (!provider?.passwordHash || !isPasswordCorrect) {
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

  async loginWithGoogle(code: string) {
    const profile = await this.googleOAuthService.getProfile(code);
    const user = await this.findOrCreateGoogleUser(profile);

    if (isLocked(user)) {
      throw new AppException(ERRORS.ACCOUNT_LOCKED);
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string | undefined) {
    const userId =
      refreshToken && (await this.refreshTokenService.findUserId(refreshToken));
    const user = userId ? await this.usersService.findById(userId) : null;

    if (!user) {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    if (isLocked(user)) {
      throw new AppException(ERRORS.ACCOUNT_LOCKED);
    }

    return { accessToken: await this.signAccessToken(user) };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.refreshTokenService.revoke(refreshToken);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const provider = await this.usersService.findLocalProvider(email);

    if (provider && !isLocked(provider.user)) {
      void this.enqueuePasswordResetEmail(provider.userId, email);
    }
  }

  async resetPassword({
    uid,
    token,
    newPassword,
  }: ResetPasswordDto): Promise<void> {
    // Lua GET + DEL nguyên tử: hai request cùng lúc với một token thì chỉ một request đi tiếp
    const isConsumed = await this.oneTimeTokenService.consume(
      OneTimeTokenPurpose.RESET_PASSWORD,
      uid,
      token,
    );

    if (!isConsumed) {
      throw new AppException(ERRORS.INVALID_TOKEN);
    }

    // Kiểm tra khóa sau token: ai biết uid cũng không dò được tài khoản bị khóa
    const result = await this.usersService.resetLocalPassword(
      uid,
      await hashPassword(newPassword),
    );

    if (result.status === 'no-local-login') {
      throw new AppException(ERRORS.INVALID_TOKEN);
    }

    if (result.status === 'locked') {
      throw new AppException(ERRORS.ACCOUNT_LOCKED);
    }

    await this.enqueuePasswordChangedEmail(uid, result.email);
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

    if (!(await verifyPassword(provider.passwordHash, currentPassword))) {
      throw new AppException(ERRORS.WRONG_PASSWORD);
    }

    if (newPassword === currentPassword) {
      throw new AppException(ERRORS.SAME_PASSWORD);
    }

    const result = await this.usersService.changeLocalPassword(
      userId,
      provider.passwordHash,
      await hashPassword(newPassword),
    );

    if (result.status === 'password-changed-meanwhile') {
      throw new AppException(ERRORS.WRONG_PASSWORD);
    }

    if (result.status === 'locked') {
      throw new AppException(ERRORS.ACCOUNT_LOCKED);
    }

    await this.enqueuePasswordChangedEmail(userId, result.email);
  }

  private async issueTokens(user: User) {
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.refreshTokenService.create(user.id),
    };
  }

  private signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user.id, role: user.role };

    return this.jwtService.signAsync(payload);
  }

  private async findOrCreateGoogleUser({
    sub,
    email,
    name,
    picture,
  }: GoogleProfile): Promise<User> {
    const googleProvider = await this.usersService.findGoogleProvider(sub);

    if (googleProvider) {
      return googleProvider.user;
    }

    try {
      return await this.usersService.createGoogleReader({
        sub,
        email,
        name: (name?.trim() || email.split('@')[0]).slice(0, MAX_NAME_LENGTH),
        avatarUrl: picture ?? null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // vi phạm unique (provider, provider_key)
        throw new AppException(ERRORS.GOOGLE_AUTH_FAILED);
      }

      throw error;
    }
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

  private async enqueueVerificationEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    try {
      await this.mailQueueService.enqueueVerificationEmail(userId, email);
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async enqueuePasswordResetEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    try {
      await this.mailQueueService.enqueuePasswordResetEmail(userId, email);
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async enqueuePasswordChangedEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    try {
      await this.mailQueueService.enqueuePasswordChangedEmail(userId, email);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
