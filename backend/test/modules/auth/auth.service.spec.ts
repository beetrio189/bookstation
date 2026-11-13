import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';
import { hashPassword, verifyPassword } from '../../../src/utils/password';
import { MailQueueService } from '../../../src/modules/mail/mail-queue.service';
import { UsersService } from '../../../src/modules/users/users.service';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { GoogleOAuthService } from '../../../src/modules/auth/google-oauth.service';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from '../../../src/modules/auth/one-time-token.service';
import { RefreshTokenService } from '../../../src/modules/auth/refresh-token.service';

const EMAIL = 'a@example.com';
const USER = {
  id: 'user-1',
  role: 'reader',
  status: 'active',
  name: 'Wing',
  notificationEmail: EMAIL,
  avatarUrl: null,
  bio: null,
};
const LOCKED_USER = { ...USER, status: 'locked' };
const PROVIDER = {
  id: 'provider-1',
  userId: USER.id,
  providerKey: EMAIL,
  verified: true as boolean | null,
  user: USER,
};
const REGISTER = { email: EMAIL, password: 'MatKhau123', name: USER.name };

describe('AuthService', () => {
  const usersService = {
    findById: jest.fn(),
    findLocalProvider: jest.fn(),
    findLocalProviderForLogin: jest.fn(),
    findLocalProviderWithPassword: jest.fn(),
    createReader: jest.fn(),
    markLocalVerified: jest.fn(),
    updateLocalPassword: jest.fn(),
    resetLocalPassword: jest.fn(),
    findGoogleProvider: jest.fn(),
    createGoogleReader: jest.fn(),
  };
  const googleOAuthService = { getProfile: jest.fn() };
  const oneTimeTokenService = {
    create: jest.fn(),
    peek: jest.fn(),
    consume: jest.fn(),
  };
  const refreshTokenService = {
    create: jest.fn(),
    findUserId: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn() };
  const mailQueueService = {
    enqueueVerificationEmail: jest.fn(),
    enqueuePasswordResetEmail: jest.fn(),
    enqueuePasswordChangedEmail: jest.fn(),
  };
  const service = new AuthService(
    usersService as unknown as UsersService,
    oneTimeTokenService as unknown as OneTimeTokenService,
    refreshTokenService as unknown as RefreshTokenService,
    jwtService as unknown as JwtService,
    googleOAuthService as unknown as GoogleOAuthService,
    mailQueueService as unknown as MailQueueService,
  );
  const flushPromises = () => new Promise(setImmediate);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    usersService.findLocalProvider.mockResolvedValue(null);
    usersService.createReader.mockResolvedValue(USER);
    oneTimeTokenService.create.mockResolvedValue('token-1');
  });

  describe('register', () => {
    it('creates a reader with a hashed password and queues the email', async () => {
      await expect(service.register(REGISTER)).resolves.toBeUndefined();

      const [created] = usersService.createReader.mock.calls[0] as [
        { email: string; passwordHash: string; name: string },
      ];

      expect(created).toMatchObject({ email: EMAIL, name: USER.name });
      await expect(
        verifyPassword(created.passwordHash, REGISTER.password),
      ).resolves.toBe(true);
      expect(mailQueueService.enqueueVerificationEmail).toHaveBeenCalledWith(
        USER.id,
        EMAIL,
      );
      // Token do worker tạo lúc gửi, API không tạo
      expect(oneTimeTokenService.create).not.toHaveBeenCalled();
    });

    it.each([true, false])(
      'rejects an email that already exists (verified: %s)',
      async (verified) => {
        usersService.findLocalProvider.mockResolvedValue({
          ...PROVIDER,
          verified,
        });

        await expect(service.register(REGISTER)).rejects.toMatchObject({
          code: 2000,
        });
        expect(usersService.createReader).not.toHaveBeenCalled();
      },
    );

    it('rejects when a concurrent request takes the email first', async () => {
      usersService.createReader.mockRejectedValue(
        new QueryFailedError('INSERT', [], {
          code: '23505',
        } as unknown as Error),
      );

      await expect(service.register(REGISTER)).rejects.toMatchObject({
        code: 2000,
      });
    });

    it('does not hide other database errors', async () => {
      const failure = new Error('connection lost');
      usersService.createReader.mockRejectedValue(failure);

      await expect(service.register(REGISTER)).rejects.toBe(failure);
    });

    it('still succeeds when the email cannot be queued', async () => {
      const failure = new Error('Redis: down');
      mailQueueService.enqueueVerificationEmail.mockRejectedValue(failure);

      await expect(service.register(REGISTER)).resolves.toBeUndefined();
      expect(Logger.prototype.error).toHaveBeenCalledWith(failure);
    });
  });

  describe('verifyEmail', () => {
    const VERIFY = { uid: USER.id, token: 'token-1' };

    it('marks the local login verified, then deletes the token', async () => {
      oneTimeTokenService.peek.mockResolvedValue(true);
      usersService.markLocalVerified.mockResolvedValue(true);

      await service.verifyEmail(VERIFY);

      expect(oneTimeTokenService.peek).toHaveBeenCalledWith(
        OneTimeTokenPurpose.VERIFY_EMAIL,
        USER.id,
        'token-1',
      );
      expect(usersService.markLocalVerified).toHaveBeenCalledWith(USER.id);
      expect(oneTimeTokenService.consume).toHaveBeenCalledWith(
        OneTimeTokenPurpose.VERIFY_EMAIL,
        USER.id,
        'token-1',
      );
      expect(
        usersService.markLocalVerified.mock.invocationCallOrder[0],
      ).toBeLessThan(oneTimeTokenService.consume.mock.invocationCallOrder[0]);
    });

    it('rejects an invalid or used token and deletes nothing', async () => {
      oneTimeTokenService.peek.mockResolvedValue(false);

      await expect(
        service.verifyEmail({ uid: USER.id, token: 'bad' }),
      ).rejects.toMatchObject({ code: 2004 });
      expect(usersService.markLocalVerified).not.toHaveBeenCalled();
      expect(oneTimeTokenService.consume).not.toHaveBeenCalled();
    });

    it('rejects when the user no longer has a local login', async () => {
      oneTimeTokenService.peek.mockResolvedValue(true);
      usersService.markLocalVerified.mockResolvedValue(false);

      await expect(service.verifyEmail(VERIFY)).rejects.toMatchObject({
        code: 2004,
      });
      expect(oneTimeTokenService.consume).not.toHaveBeenCalled();
    });

    it('keeps the token when the database update fails', async () => {
      const failure = new Error('connection lost');
      oneTimeTokenService.peek.mockResolvedValue(true);
      usersService.markLocalVerified.mockRejectedValue(failure);

      await expect(service.verifyEmail(VERIFY)).rejects.toBe(failure);
      expect(oneTimeTokenService.consume).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('sends a new link to an unverified login', async () => {
      usersService.findLocalProvider.mockResolvedValue({
        ...PROVIDER,
        verified: false,
      });

      await service.resendVerification(EMAIL);
      await flushPromises();

      expect(mailQueueService.enqueueVerificationEmail).toHaveBeenCalledWith(
        USER.id,
        EMAIL,
      );
    });

    it('does nothing for an unknown email, without an error', async () => {
      await expect(
        service.resendVerification('nobody@example.com'),
      ).resolves.toBeUndefined();
      await flushPromises();

      expect(mailQueueService.enqueueVerificationEmail).not.toHaveBeenCalled();
    });

    it('does nothing for a verified login', async () => {
      usersService.findLocalProvider.mockResolvedValue(PROVIDER);

      await service.resendVerification(EMAIL);
      await flushPromises();

      expect(mailQueueService.enqueueVerificationEmail).not.toHaveBeenCalled();
    });

    it('does nothing for a locked account, without an error', async () => {
      usersService.findLocalProvider.mockResolvedValue({
        ...PROVIDER,
        verified: false,
        user: LOCKED_USER,
      });

      await expect(service.resendVerification(EMAIL)).resolves.toBeUndefined();
      await flushPromises();

      expect(mailQueueService.enqueueVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('sessions', () => {
    const PASSWORD = 'mat-khau-dai';
    const LOGIN = { email: EMAIL, password: PASSWORD };
    const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1' };
    let passwordHash: string;

    beforeAll(async () => {
      passwordHash = await hashPassword(PASSWORD);
    });

    beforeEach(() => {
      jwtService.signAsync.mockResolvedValue(TOKENS.accessToken);
      refreshTokenService.create.mockResolvedValue(TOKENS.refreshToken);
    });

    const mockLoginProvider = (override: object = {}) =>
      usersService.findLocalProviderForLogin.mockResolvedValue({
        ...PROVIDER,
        passwordHash,
        ...override,
      });

    describe('login', () => {
      it('signs the role into the JWT and issues a refresh token', async () => {
        mockLoginProvider();

        await expect(service.login(LOGIN)).resolves.toEqual(TOKENS);

        expect(usersService.findLocalProviderForLogin).toHaveBeenCalledWith(
          EMAIL,
        );
        expect(jwtService.signAsync).toHaveBeenCalledWith({
          sub: USER.id,
          role: 'reader',
        });
        expect(refreshTokenService.create).toHaveBeenCalledWith(USER.id);
      });

      it('rejects an unknown email', async () => {
        usersService.findLocalProviderForLogin.mockResolvedValue(null);

        await expect(service.login(LOGIN)).rejects.toMatchObject({
          code: 2001,
        });
      });

      it('rejects a wrong password without issuing tokens', async () => {
        mockLoginProvider();

        await expect(
          service.login({ ...LOGIN, password: 'mat-khau-sai' }),
        ).rejects.toMatchObject({ code: 2001 });
        expect(refreshTokenService.create).not.toHaveBeenCalled();
      });

      it('rejects a login without a password', async () => {
        mockLoginProvider({ passwordHash: null });

        await expect(service.login(LOGIN)).rejects.toMatchObject({
          code: 2001,
        });
      });

      it('rejects an unverified email only after the password is right', async () => {
        mockLoginProvider({ verified: false });

        await expect(service.login(LOGIN)).rejects.toMatchObject({
          code: 2002,
        });
        await expect(
          service.login({ ...LOGIN, password: 'mat-khau-sai' }),
        ).rejects.toMatchObject({ code: 2001 });
      });

      it('rejects a locked account only after the password is right', async () => {
        mockLoginProvider({ user: LOCKED_USER });

        await expect(service.login(LOGIN)).rejects.toMatchObject({
          code: 2003,
        });
        await expect(
          service.login({ ...LOGIN, password: 'mat-khau-sai' }),
        ).rejects.toMatchObject({ code: 2001 });
      });

      it('reports a locked account before an unverified email', async () => {
        mockLoginProvider({ user: LOCKED_USER, verified: false });

        await expect(service.login(LOGIN)).rejects.toMatchObject({
          code: 2003,
        });
      });
    });

    describe('loginWithGoogle', () => {
      const PROFILE = {
        sub: 'google-sub-1',
        email: EMAIL,
        name: 'Wing Google',
        picture: 'https://example.com/a.png',
      };

      beforeEach(() => {
        googleOAuthService.getProfile.mockResolvedValue(PROFILE);
        usersService.findGoogleProvider.mockResolvedValue(null);
      });

      it('logs in a user already linked to the Google account', async () => {
        usersService.findGoogleProvider.mockResolvedValue({ user: USER });

        await expect(service.loginWithGoogle('code-1')).resolves.toEqual(
          TOKENS,
        );
        expect(googleOAuthService.getProfile).toHaveBeenCalledWith('code-1');
        expect(usersService.findGoogleProvider).toHaveBeenCalledWith(
          PROFILE.sub,
        );
        expect(jwtService.signAsync).toHaveBeenCalledWith({
          sub: USER.id,
          role: 'reader',
        });
        expect(usersService.createGoogleReader).not.toHaveBeenCalled();
      });

      it('creates a new reader even when a local account has the same email', async () => {
        usersService.findLocalProvider.mockResolvedValue(PROVIDER);
        usersService.createGoogleReader.mockResolvedValue({
          ...USER,
          id: 'user-2',
        });

        await expect(service.loginWithGoogle('code-1')).resolves.toEqual(
          TOKENS,
        );
        expect(usersService.createGoogleReader).toHaveBeenCalledWith({
          sub: PROFILE.sub,
          email: EMAIL,
          name: PROFILE.name,
          avatarUrl: PROFILE.picture,
        });
        expect(usersService.findLocalProvider).not.toHaveBeenCalled();
        expect(refreshTokenService.create).toHaveBeenCalledWith('user-2');
      });

      it('falls back to the email name and trims long names', async () => {
        usersService.createGoogleReader.mockResolvedValue(USER);
        googleOAuthService.getProfile.mockResolvedValueOnce({
          ...PROFILE,
          name: undefined,
          picture: undefined,
        });

        await service.loginWithGoogle('code-1');

        expect(usersService.createGoogleReader).toHaveBeenLastCalledWith(
          expect.objectContaining({ name: 'a', avatarUrl: null }),
        );

        googleOAuthService.getProfile.mockResolvedValueOnce({
          ...PROFILE,
          name: 'x'.repeat(150),
        });

        await service.loginWithGoogle('code-1');

        expect(usersService.createGoogleReader).toHaveBeenLastCalledWith(
          expect.objectContaining({ name: 'x'.repeat(100) }),
        );
      });

      it('rejects a locked account already linked to Google', async () => {
        usersService.findGoogleProvider.mockResolvedValue({
          user: LOCKED_USER,
        });

        await expect(service.loginWithGoogle('code-1')).rejects.toMatchObject({
          code: 2003,
        });
        expect(refreshTokenService.create).not.toHaveBeenCalled();
      });

      it('fails when two callbacks create the same Google account', async () => {
        usersService.createGoogleReader.mockRejectedValue(
          new QueryFailedError('INSERT', [], {
            code: '23505',
          } as unknown as Error),
        );

        await expect(service.loginWithGoogle('code-1')).rejects.toMatchObject({
          code: 2007,
        });
      });

      it('passes on a failed Google exchange', async () => {
        googleOAuthService.getProfile.mockRejectedValue(
          Object.assign(new Error('bad'), { code: 2007 }),
        );

        await expect(service.loginWithGoogle('code-1')).rejects.toMatchObject({
          code: 2007,
        });
        expect(usersService.findGoogleProvider).not.toHaveBeenCalled();
      });
    });

    describe('refresh', () => {
      it('signs a new access token with the latest role and keeps the refresh token', async () => {
        refreshTokenService.findUserId.mockResolvedValue(USER.id);
        usersService.findById.mockResolvedValue({
          ...USER,
          role: 'publisher',
        });

        await expect(service.refresh('current')).resolves.toEqual({
          accessToken: TOKENS.accessToken,
        });

        expect(refreshTokenService.findUserId).toHaveBeenCalledWith('current');
        expect(jwtService.signAsync).toHaveBeenCalledWith({
          sub: USER.id,
          role: 'publisher',
        });
        expect(refreshTokenService.create).not.toHaveBeenCalled();
        expect(refreshTokenService.revoke).not.toHaveBeenCalled();
      });

      it('rejects a missing cookie', async () => {
        await expect(service.refresh(undefined)).rejects.toMatchObject({
          code: 1001,
        });
        expect(refreshTokenService.findUserId).not.toHaveBeenCalled();
      });

      it('rejects an invalid or expired token', async () => {
        refreshTokenService.findUserId.mockResolvedValue(null);

        await expect(service.refresh('expired')).rejects.toMatchObject({
          code: 1001,
        });
      });

      it('rejects a user that no longer exists', async () => {
        refreshTokenService.findUserId.mockResolvedValue(USER.id);
        usersService.findById.mockResolvedValue(null);

        await expect(service.refresh('current')).rejects.toMatchObject({
          code: 1001,
        });
      });

      it('rejects a locked user without signing a token', async () => {
        refreshTokenService.findUserId.mockResolvedValue(USER.id);
        usersService.findById.mockResolvedValue(LOCKED_USER);

        await expect(service.refresh('current')).rejects.toMatchObject({
          code: 2003,
        });
        expect(jwtService.signAsync).not.toHaveBeenCalled();
      });
    });

    describe('logout', () => {
      it('deletes the current refresh token', async () => {
        await service.logout('current');

        expect(refreshTokenService.revoke).toHaveBeenCalledWith('current');
      });

      it('succeeds without a cookie', async () => {
        await expect(service.logout(undefined)).resolves.toBeUndefined();
        expect(refreshTokenService.revoke).not.toHaveBeenCalled();
      });
    });

    describe('getProfile', () => {
      it('returns the profile without sensitive fields', async () => {
        usersService.findById.mockResolvedValue(USER);

        await expect(service.getProfile(USER.id)).resolves.toEqual({
          id: USER.id,
          name: USER.name,
          notificationEmail: EMAIL,
          avatarUrl: null,
          bio: null,
          role: 'reader',
        });
      });

      it('rejects a user that no longer exists', async () => {
        usersService.findById.mockResolvedValue(null);

        await expect(service.getProfile(USER.id)).rejects.toMatchObject({
          code: 1001,
        });
      });
    });
  });

  describe('passwords', () => {
    const CURRENT = 'mat-khau-cu';
    const NEW = 'mat-khau-moi';
    const updatedHash = () =>
      (usersService.updateLocalPassword.mock.calls[0] as [string, string])[1];

    describe('forgotPassword', () => {
      it('queues the reset email without creating a token itself', async () => {
        usersService.findLocalProvider.mockResolvedValue(PROVIDER);

        await service.forgotPassword(EMAIL);
        await flushPromises();

        expect(mailQueueService.enqueuePasswordResetEmail).toHaveBeenCalledWith(
          USER.id,
          EMAIL,
        );
        expect(oneTimeTokenService.create).not.toHaveBeenCalled();
      });

      it('does nothing for an unknown email, without an error', async () => {
        await expect(
          service.forgotPassword('nobody@example.com'),
        ).resolves.toBeUndefined();
        await flushPromises();

        expect(
          mailQueueService.enqueuePasswordResetEmail,
        ).not.toHaveBeenCalled();
      });

      it('also emails an unverified login', async () => {
        usersService.findLocalProvider.mockResolvedValue({
          ...PROVIDER,
          verified: false,
        });

        await service.forgotPassword(EMAIL);
        await flushPromises();

        expect(mailQueueService.enqueuePasswordResetEmail).toHaveBeenCalledWith(
          USER.id,
          EMAIL,
        );
      });

      it('does nothing for a locked account, without an error', async () => {
        usersService.findLocalProvider.mockResolvedValue({
          ...PROVIDER,
          user: LOCKED_USER,
        });

        await expect(service.forgotPassword(EMAIL)).resolves.toBeUndefined();
        await flushPromises();

        expect(
          mailQueueService.enqueuePasswordResetEmail,
        ).not.toHaveBeenCalled();
      });

      it('logs a failed enqueue instead of throwing', async () => {
        const failure = new Error('Redis: down');
        usersService.findLocalProvider.mockResolvedValue(PROVIDER);
        mailQueueService.enqueuePasswordResetEmail.mockRejectedValue(failure);

        await service.forgotPassword(EMAIL);
        await flushPromises();

        expect(Logger.prototype.error).toHaveBeenCalledWith(failure);
      });
    });

    describe('resetPassword', () => {
      const RESET = { uid: USER.id, token: 'token-1', newPassword: NEW };

      beforeEach(() => {
        oneTimeTokenService.consume.mockResolvedValue(true);
        usersService.resetLocalPassword.mockResolvedValue({
          status: 'reset',
          email: EMAIL,
        });
      });

      it('consumes the token, sets the password and emails the user', async () => {
        await service.resetPassword(RESET);

        expect(oneTimeTokenService.consume).toHaveBeenCalledWith(
          OneTimeTokenPurpose.RESET_PASSWORD,
          USER.id,
          'token-1',
        );
        const [userId, passwordHash] = usersService.resetLocalPassword.mock
          .calls[0] as [string, string];

        expect(userId).toBe(USER.id);
        await expect(verifyPassword(passwordHash, NEW)).resolves.toBe(true);
        expect(
          mailQueueService.enqueuePasswordChangedEmail,
        ).toHaveBeenCalledWith(USER.id, EMAIL);
        expect(oneTimeTokenService.peek).not.toHaveBeenCalled();
      });

      it('accepts the current password as the new one', async () => {
        await expect(service.resetPassword(RESET)).resolves.toBeUndefined();
        expect(
          usersService.findLocalProviderWithPassword,
        ).not.toHaveBeenCalled();
      });

      it('rejects an invalid, expired or used token and changes nothing', async () => {
        oneTimeTokenService.consume.mockResolvedValue(false);

        await expect(service.resetPassword(RESET)).rejects.toMatchObject({
          code: 2004,
        });
        expect(usersService.resetLocalPassword).not.toHaveBeenCalled();
        expect(
          mailQueueService.enqueuePasswordChangedEmail,
        ).not.toHaveBeenCalled();
      });

      it('rejects when the user no longer has a local login', async () => {
        usersService.resetLocalPassword.mockResolvedValue({
          status: 'no-local-login',
        });

        await expect(service.resetPassword(RESET)).rejects.toMatchObject({
          code: 2004,
        });
        expect(
          mailQueueService.enqueuePasswordChangedEmail,
        ).not.toHaveBeenCalled();
      });

      it('rejects a locked account only after the token is valid', async () => {
        usersService.resetLocalPassword.mockResolvedValue({ status: 'locked' });

        await expect(service.resetPassword(RESET)).rejects.toMatchObject({
          code: 2003,
        });
        expect(oneTimeTokenService.consume).toHaveBeenCalled();
        expect(
          mailQueueService.enqueuePasswordChangedEmail,
        ).not.toHaveBeenCalled();
      });

      it('keeps the new password when the email cannot be queued', async () => {
        const failure = new Error('Redis: down');
        mailQueueService.enqueuePasswordChangedEmail.mockRejectedValue(failure);

        await expect(service.resetPassword(RESET)).resolves.toBeUndefined();
        expect(Logger.prototype.error).toHaveBeenCalledWith(failure);
      });
    });

    describe('changePassword', () => {
      const mockProviderWithPassword = async (password: string) =>
        usersService.findLocalProviderWithPassword.mockResolvedValue({
          ...PROVIDER,
          passwordHash: await hashPassword(password),
        });

      it('sets the new password and revokes all sessions', async () => {
        await mockProviderWithPassword(CURRENT);

        await service.changePassword(USER.id, {
          currentPassword: CURRENT,
          newPassword: NEW,
        });

        expect(usersService.findLocalProviderWithPassword).toHaveBeenCalledWith(
          USER.id,
        );
        await expect(verifyPassword(updatedHash(), NEW)).resolves.toBe(true);
        expect(refreshTokenService.revokeAll).toHaveBeenCalledWith(USER.id);
      });

      it('rejects a wrong current password and changes nothing', async () => {
        await mockProviderWithPassword(CURRENT);

        await expect(
          service.changePassword(USER.id, {
            currentPassword: 'mat-khau-sai',
            newPassword: NEW,
          }),
        ).rejects.toMatchObject({ code: 2005 });
        expect(usersService.updateLocalPassword).not.toHaveBeenCalled();
        expect(refreshTokenService.revokeAll).not.toHaveBeenCalled();
      });

      it('rejects a new password equal to the current one before any lookup', async () => {
        await expect(
          service.changePassword(USER.id, {
            currentPassword: CURRENT,
            newPassword: CURRENT,
          }),
        ).rejects.toMatchObject({ code: 2008 });
        expect(
          usersService.findLocalProviderWithPassword,
        ).not.toHaveBeenCalled();
        expect(usersService.updateLocalPassword).not.toHaveBeenCalled();
      });

      it.each([
        ['a login without a password', { ...PROVIDER, passwordHash: null }],
        ['an account without a local login', null],
      ])('asks %s to use forgot password', async (_case, provider) => {
        usersService.findLocalProviderWithPassword.mockResolvedValue(provider);

        await expect(
          service.changePassword(USER.id, {
            currentPassword: CURRENT,
            newPassword: NEW,
          }),
        ).rejects.toMatchObject({ code: 2006 });
      });
    });
  });
});
