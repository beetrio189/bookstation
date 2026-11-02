import { Request, Response } from 'express';
import { AuthUser } from '../../../src/utils/types/auth-user';
import { AuthController } from '../../../src/modules/auth/auth.controller';
import { AuthService } from '../../../src/modules/auth/auth.service';

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
  };
  const response = { cookie: jest.fn(), clearCookie: jest.fn() };
  const controller = new AuthController(authService as unknown as AuthService);
  const requestWith = (cookies: object) => ({ cookies }) as unknown as Request;

  beforeEach(() => {
    jest.resetAllMocks();
    authService.login.mockResolvedValue(TOKENS);
    authService.refresh.mockResolvedValue(TOKENS);
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
});
