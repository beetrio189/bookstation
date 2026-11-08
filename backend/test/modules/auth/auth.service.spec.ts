import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';
import { hashPassword, verifyPassword } from '../../../src/utils/password';
import { MailService } from '../../../src/modules/mail/mail.service';
import { UsersService } from '../../../src/modules/users/users.service';
import { AuthService } from '../../../src/modules/auth/auth.service';
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
const REGISTER = { email: EMAIL, password: 'mat-khau-dai', name: USER.name };

describe('AuthService', () => {
  const usersService = {
    findById: jest.fn(),
    findLocalProvider: jest.fn(),
    findLocalProviderForLogin: jest.fn(),
    findLocalProviderWithPassword: jest.fn(),
    createReader: jest.fn(),
    markLocalVerified: jest.fn(),
    updateLocalPassword: jest.fn(),
  };
  const mailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };
  const oneTimeTokenService = { create: jest.fn(), consume: jest.fn() };
  const refreshTokenService = {
    create: jest.fn(),
    consume: jest.fn(),
    revokeAll: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn() };
  const service = new AuthService(
    usersService as unknown as UsersService,
    mailService as unknown as MailService,
    oneTimeTokenService as unknown as OneTimeTokenService,
    refreshTokenService as unknown as RefreshTokenService,
    jwtService as unknown as JwtService,
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
    it('creates a reader with a hashed password and emails a 24h token', async () => {
      await expect(service.register(REGISTER)).resolves.toEqual({
        id: USER.id,
        email: EMAIL,
        name: USER.name,
      });

      const [created] = usersService.createReader.mock.calls[0] as [
        { email: string; passwordHash: string; name: string },
      ];

      expect(created).toMatchObject({ email: EMAIL, name: USER.name });
      await expect(
        verifyPassword(created.passwordHash, REGISTER.password),
      ).resolves.toBe(true);
      expect(oneTimeTokenService.create).toHaveBeenCalledWith(
        OneTimeTokenPurpose.VERIFY_EMAIL,
        USER.id,
        86400,
      );
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        EMAIL,
        'token-1',
      );
    });

    it('rejects an email that already exists', async () => {
      usersService.findLocalProvider.mockResolvedValue(PROVIDER);

      await expect(service.register(REGISTER)).rejects.toMatchObject({
        code: 2000,
      });
      expect(usersService.createReader).not.toHaveBeenCalled();
    });

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

    it('still succeeds when the email cannot be sent', async () => {
      const failure = new Error('Resend: down');
      mailService.sendVerificationEmail.mockRejectedValue(failure);

      await expect(service.register(REGISTER)).resolves.toMatchObject({
        id: USER.id,
      });
      expect(Logger.prototype.error).toHaveBeenCalledWith(failure);
    });
  });

  describe('verifyEmail', () => {
    it('marks the local login verified', async () => {
      oneTimeTokenService.consume.mockResolvedValue(USER.id);

      await service.verifyEmail('token-1');

      expect(oneTimeTokenService.consume).toHaveBeenCalledWith(
        OneTimeTokenPurpose.VERIFY_EMAIL,
        'token-1',
      );
      expect(usersService.markLocalVerified).toHaveBeenCalledWith(USER.id);
    });

    it('rejects an invalid or used token', async () => {
      oneTimeTokenService.consume.mockResolvedValue(null);

      await expect(service.verifyEmail('bad')).rejects.toMatchObject({
        code: 2004,
      });
      expect(usersService.markLocalVerified).not.toHaveBeenCalled();
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

      expect(oneTimeTokenService.create).toHaveBeenCalledWith(
        OneTimeTokenPurpose.VERIFY_EMAIL,
        USER.id,
        86400,
      );
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        EMAIL,
        'token-1',
      );
    });

    it('does nothing for an unknown email, without an error', async () => {
      await expect(
        service.resendVerification('nobody@example.com'),
      ).resolves.toBeUndefined();
      await flushPromises();

      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('does nothing for a verified login', async () => {
      usersService.findLocalProvider.mockResolvedValue(PROVIDER);

      await service.resendVerification(EMAIL);
      await flushPromises();

      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
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
          notificationEmail: EMAIL,
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

      it('rejects a password that matches only in its first 72 bytes', async () => {
        const password = 'a'.repeat(72);
        mockLoginProvider({ passwordHash: await hashPassword(password) });

        await expect(
          service.login({ ...LOGIN, password: `${password}b` }),
        ).rejects.toMatchObject({ code: 2001 });
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

    describe('refresh', () => {
      it('consumes the old token and issues new ones with the latest role', async () => {
        refreshTokenService.consume.mockResolvedValue(USER.id);
        usersService.findById.mockResolvedValue({
          ...USER,
          role: 'publisher',
        });

        await expect(service.refresh('old')).resolves.toEqual(TOKENS);

        expect(refreshTokenService.consume).toHaveBeenCalledWith('old');
        expect(jwtService.signAsync).toHaveBeenCalledWith({
          sub: USER.id,
          notificationEmail: EMAIL,
          role: 'publisher',
        });
      });

      it('rejects a missing cookie', async () => {
        await expect(service.refresh(undefined)).rejects.toMatchObject({
          code: 1001,
        });
        expect(refreshTokenService.consume).not.toHaveBeenCalled();
      });

      it('rejects an invalid or used token', async () => {
        refreshTokenService.consume.mockResolvedValue(null);

        await expect(service.refresh('used')).rejects.toMatchObject({
          code: 1001,
        });
      });

      it('rejects a user that no longer exists', async () => {
        refreshTokenService.consume.mockResolvedValue(USER.id);
        usersService.findById.mockResolvedValue(null);

        await expect(service.refresh('old')).rejects.toMatchObject({
          code: 1001,
        });
      });

      it('rejects a locked user without issuing tokens', async () => {
        refreshTokenService.consume.mockResolvedValue(USER.id);
        usersService.findById.mockResolvedValue(LOCKED_USER);

        await expect(service.refresh('old')).rejects.toMatchObject({
          code: 2003,
        });
        expect(refreshTokenService.create).not.toHaveBeenCalled();
      });
    });

    describe('logout', () => {
      it('deletes the current refresh token', async () => {
        await service.logout('current');

        expect(refreshTokenService.consume).toHaveBeenCalledWith('current');
      });

      it('succeeds without a cookie', async () => {
        await expect(service.logout(undefined)).resolves.toBeUndefined();
        expect(refreshTokenService.consume).not.toHaveBeenCalled();
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
      it('emails a 30-minute token', async () => {
        usersService.findLocalProvider.mockResolvedValue(PROVIDER);

        await service.forgotPassword(EMAIL);
        await flushPromises();

        expect(oneTimeTokenService.create).toHaveBeenCalledWith(
          OneTimeTokenPurpose.RESET_PASSWORD,
          USER.id,
          1800,
        );
        expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
          EMAIL,
          'token-1',
        );
      });

      it('does nothing for an unknown email, without an error', async () => {
        await expect(
          service.forgotPassword('nobody@example.com'),
        ).resolves.toBeUndefined();
        await flushPromises();

        expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it('does nothing for an unverified email, without an error', async () => {
        usersService.findLocalProvider.mockResolvedValue({
          ...PROVIDER,
          verified: false,
        });

        await expect(service.forgotPassword(EMAIL)).resolves.toBeUndefined();
        await flushPromises();

        expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it('does nothing for a locked account, without an error', async () => {
        usersService.findLocalProvider.mockResolvedValue({
          ...PROVIDER,
          user: LOCKED_USER,
        });

        await expect(service.forgotPassword(EMAIL)).resolves.toBeUndefined();
        await flushPromises();

        expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it('logs a failed email instead of throwing', async () => {
        const failure = new Error('Resend: down');
        usersService.findLocalProvider.mockResolvedValue(PROVIDER);
        mailService.sendPasswordResetEmail.mockRejectedValue(failure);

        await service.forgotPassword(EMAIL);
        await flushPromises();

        expect(Logger.prototype.error).toHaveBeenCalledWith(failure);
      });
    });

    describe('resetPassword', () => {
      it('sets the password and revokes all sessions', async () => {
        oneTimeTokenService.consume.mockResolvedValue(USER.id);

        await service.resetPassword({ token: 'token-1', newPassword: NEW });

        expect(oneTimeTokenService.consume).toHaveBeenCalledWith(
          OneTimeTokenPurpose.RESET_PASSWORD,
          'token-1',
        );
        expect(usersService.updateLocalPassword.mock.calls[0][0]).toBe(USER.id);
        await expect(verifyPassword(updatedHash(), NEW)).resolves.toBe(true);
        expect(refreshTokenService.revokeAll).toHaveBeenCalledWith(USER.id);
      });

      it('rejects an invalid or used token and changes nothing', async () => {
        oneTimeTokenService.consume.mockResolvedValue(null);

        await expect(
          service.resetPassword({ token: 'bad', newPassword: NEW }),
        ).rejects.toMatchObject({ code: 2004 });
        expect(usersService.updateLocalPassword).not.toHaveBeenCalled();
        expect(refreshTokenService.revokeAll).not.toHaveBeenCalled();
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

      it('rejects a current password that matches only in its first 72 bytes', async () => {
        const password = 'a'.repeat(72);
        await mockProviderWithPassword(password);

        await expect(
          service.changePassword(USER.id, {
            currentPassword: `${password}b`,
            newPassword: NEW,
          }),
        ).rejects.toMatchObject({ code: 2005 });
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
