import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { hours, minutes, seconds, Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import { CookieOptions, Request, Response } from 'express';
import { env } from '../../config';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public } from '../../decorators/public.decorator';
import { ThrottleByIpEmail } from '../../decorators/throttle-by-ip-email.decorator';
import { ThrottleByKey } from '../../decorators/throttle-by-key.decorator';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { AuthUser } from '../../utils/types/auth-user';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { GoogleOAuthService } from './google-oauth.service';
import { REFRESH_TOKEN_TTL_SECONDS } from './refresh-token.service';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax',
  path: '/api/auth',
};

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const OAUTH_STATE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax',
  path: '/api/auth/google',
};
const GOOGLE_LOGIN_RESULT_URL = `${env.feUrl}/oauth/google/callback`;

// cookie-parser đổi cookie dạng "j:..." thành object nên phải kiểm tra kiểu
const readCookie = (request: Request, name: string): string | undefined => {
  const value = (request.cookies as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
};

const readRefreshToken = (request: Request) =>
  readCookie(request, REFRESH_COOKIE);

// Query lặp lại (?code=a&code=b) thành mảng nên phải kiểm tra kiểu
const readQuery = (request: Request, name: string): string | undefined => {
  const value = request.query[name];
  return typeof value === 'string' ? value : undefined;
};

const setRefreshCookie = (response: Response, refreshToken: string) =>
  response.cookie(REFRESH_COOKIE, refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { ttl: minutes(1), limit: 20 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Throttle({ default: { ttl: hours(1), limit: 5 } })
  @ThrottleByIpEmail({ ttl: hours(1), limit: 2 })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Public()
  @Throttle({ default: { ttl: minutes(1), limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(dto);

    setRefreshCookie(response, refreshToken);

    return { accessToken };
  }

  @Public()
  @Get('google')
  startGoogleLogin(@Res() response: Response): void {
    const state = randomBytes(32).toString('base64url');

    response.cookie(OAUTH_STATE_COOKIE, state, {
      ...OAUTH_STATE_COOKIE_OPTIONS,
      maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
    });
    response.redirect(this.googleOAuthService.buildAuthUrl(state));
  }

  @Public()
  @Get('google/callback')
  async finishGoogleLogin(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const code = readQuery(request, 'code');
    const state = readQuery(request, 'state');
    const expectedState = readCookie(request, OAUTH_STATE_COOKIE);

    response.clearCookie(OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS);

    try {
      if (!code || !state || state !== expectedState) {
        throw new AppException(ERRORS.GOOGLE_AUTH_FAILED);
      }

      const { refreshToken } = await this.authService.loginWithGoogle(code);

      setRefreshCookie(response, refreshToken);
      response.redirect(GOOGLE_LOGIN_RESULT_URL);
    } catch (error) {
      if (!(error instanceof AppException)) {
        this.logger.error(error);
      }

      const errorCode =
        error instanceof AppException ? error.code : ERRORS.INTERNAL_ERROR.code;

      response.redirect(`${GOOGLE_LOGIN_RESULT_URL}?error=${errorCode}`);
    }
  }

  @Public()
  @Throttle({ default: { ttl: seconds(1), limit: 10 } })
  @ThrottleByKey({
    name: 'refresh-token',
    ttl: seconds(1),
    limit: 4,
    getKey: readRefreshToken,
  })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      return await this.authService.refresh(readRefreshToken(request));
    } catch (error) {
      if (error instanceof AppException) {
        response.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
      }

      throw error;
    }
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(readRefreshToken(request));

    response.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto);

    response.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.id);
  }
}
