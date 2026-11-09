import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthUser } from '../../../src/utils/types/auth-user';
import { AuthController } from '../../../src/modules/auth/auth.controller';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { GoogleOAuthService } from '../../../src/modules/auth/google-oauth.service';
import { AppException } from '../../../src/utils/errors/app.exception';
import { ERRORS } from '../../../src/utils/errors/errors';

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1' };
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  path: '/api/auth',
};

describe('AuthController', () => {
  const authService = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
    getProfile: jest.fn(),
    loginWithGoogle: jest.fn(),
  };
  const googleOAuthService = { buildAuthUrl: jest.fn() };
  const response = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  };
  const controller = new AuthController(
    authService as unknown as AuthService,
    googleOAuthService as unknown as GoogleOAuthService,
  );
  const requestWith = (cookies: object, query: object = {}) =>
    ({ cookies, query }) as unknown as Request;

  beforeEach(() => {
    jest.resetAllMocks();
    authService.login.mockResolvedValue(TOKENS);
    authService.refresh.mockResolvedValue(TOKENS);
    authService.loginWithGoogle.mockResolvedValue(TOKENS);
  });

  it('puts the refresh token only in an httpOnly cookie on login', async () => {
    await expect(
      controller.login(
        { email: 'a@example.com', password: 'mat-khau-dai' },
        response as unknown as Response,
      ),
    ).resolves.toEqual({ accessToken: TOKENS.accessToken });

    expect(response.cookie).toHaveBeenCalledWith(
      'refresh_token',
      TOKENS.refreshToken,
      { ...COOKIE_OPTIONS, maxAge: 2592000000 },
    );
  });

  it('rotates the cookie on refresh', async () => {
    await expect(
      controller.refresh(
        requestWith({ refresh_token: 'old' }),
        response as unknown as Response,
      ),
    ).resolves.toEqual({ accessToken: TOKENS.accessToken });

    expect(authService.refresh).toHaveBeenCalledWith('old');
    expect(response.cookie).toHaveBeenCalledWith(
      'refresh_token',
      TOKENS.refreshToken,
      { ...COOKIE_OPTIONS, maxAge: 2592000000 },
    );
  });

  it('ignores a cookie that was parsed into an object', async () => {
    await controller.refresh(
      requestWith({ refresh_token: { a: 1 } }),
      response as unknown as Response,
    );

    expect(authService.refresh).toHaveBeenCalledWith(undefined);
  });

  it('clears the cookie on logout', async () => {
    await controller.logout(
      requestWith({ refresh_token: 'current' }),
      response as unknown as Response,
    );

    expect(authService.logout).toHaveBeenCalledWith('current');
    expect(response.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      COOKIE_OPTIONS,
    );
  });

  it('clears the cookie after changing the password', async () => {
    const dto = { currentPassword: 'mat-khau-cu', newPassword: 'mat-khau-moi' };

    await controller.changePassword(
      { id: 'user-1' } as AuthUser,
      dto,
      response as unknown as Response,
    );

    expect(authService.changePassword).toHaveBeenCalledWith('user-1', dto);
    expect(response.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      COOKIE_OPTIONS,
    );
  });

  it('keeps the cookie when changing the password fails', async () => {
    authService.changePassword.mockRejectedValue(new Error('wrong'));

    await expect(
      controller.changePassword(
        { id: 'user-1' } as AuthUser,
        { currentPassword: 'sai', newPassword: 'mat-khau-moi' },
        response as unknown as Response,
      ),
    ).rejects.toThrow('wrong');
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('reads the profile of the current user', async () => {
    await controller.me({ id: 'user-1' } as AuthUser);

    expect(authService.getProfile).toHaveBeenCalledWith('user-1');
  });

  describe('Google login', () => {
    const STATE_COOKIE_OPTIONS = {
      ...COOKIE_OPTIONS,
      path: '/api/auth/google',
    };
    const RESULT_URL = 'http://localhost:3000/oauth/google/callback';
    const callback = (cookies: object, query: object) =>
      controller.finishGoogleLogin(
        requestWith(cookies, query),
        response as unknown as Response,
      );

    it('stores a random state in a cookie and redirects to Google', () => {
      googleOAuthService.buildAuthUrl.mockReturnValue('https://google/auth');

      controller.startGoogleLogin(response as unknown as Response);

      const [name, state, options] = response.cookie.mock.calls[0] as [
        string,
        string,
        object,
      ];

      expect(name).toBe('oauth_state');
      expect(state).toMatch(/^[\w-]{43}$/);
      expect(options).toEqual({ ...STATE_COOKIE_OPTIONS, maxAge: 600000 });
      expect(googleOAuthService.buildAuthUrl).toHaveBeenCalledWith(state);
      expect(response.redirect).toHaveBeenCalledWith('https://google/auth');
    });

    it('sets the refresh cookie and redirects to the FE on success', async () => {
      await callback({ oauth_state: 's1' }, { code: 'c1', state: 's1' });

      expect(authService.loginWithGoogle).toHaveBeenCalledWith('c1');
      expect(response.clearCookie).toHaveBeenCalledWith(
        'oauth_state',
        STATE_COOKIE_OPTIONS,
      );
      expect(response.cookie).toHaveBeenCalledWith(
        'refresh_token',
        TOKENS.refreshToken,
        { ...COOKIE_OPTIONS, maxAge: 2592000000 },
      );
      expect(response.redirect).toHaveBeenCalledWith(RESULT_URL);
    });

    it.each([
      [
        'a mismatched state',
        { oauth_state: 's1' },
        { code: 'c1', state: 's2' },
      ],
      ['a missing state cookie', {}, { code: 'c1', state: 's1' }],
      ['a missing code', { oauth_state: 's1' }, { state: 's1' }],
      [
        'a cancelled consent',
        { oauth_state: 's1' },
        { error: 'access_denied', state: 's1' },
      ],
      [
        'a repeated query parameter',
        { oauth_state: 's1' },
        { code: ['c1', 'c2'], state: 's1' },
      ],
    ])('redirects with error 2007 on %s', async (_case, cookies, query) => {
      await callback(cookies, query);

      expect(authService.loginWithGoogle).not.toHaveBeenCalled();
      expect(response.cookie).not.toHaveBeenCalled();
      expect(response.redirect).toHaveBeenCalledWith(
        `${RESULT_URL}?error=2007`,
      );
    });

    it('passes the error code of a rejected login to the FE', async () => {
      authService.loginWithGoogle.mockRejectedValue(
        new AppException(ERRORS.ACCOUNT_LOCKED),
      );

      await callback({ oauth_state: 's1' }, { code: 'c1', state: 's1' });

      expect(response.cookie).not.toHaveBeenCalled();
      expect(response.redirect).toHaveBeenCalledWith(
        `${RESULT_URL}?error=2003`,
      );
    });

    it('hides unexpected errors behind the internal error code', async () => {
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      authService.loginWithGoogle.mockRejectedValue(new Error('db down'));

      await callback({ oauth_state: 's1' }, { code: 'c1', state: 's1' });

      expect(response.redirect).toHaveBeenCalledWith(
        `${RESULT_URL}?error=1005`,
      );
      expect(logError).toHaveBeenCalled();
    });
  });
});
