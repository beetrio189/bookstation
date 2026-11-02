import { Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { verifyPassword } from '../../utils/password';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from './one-time-token.service';

const USER = {
  id: 'user-1',
  email: 'a@example.com',
  displayName: 'Wing',
  emailVerifiedAt: null as Date | null,
};
const REGISTER = {
  email: USER.email,
  password: 'mat-khau-dai',
  displayName: USER.displayName,
};

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    createReader: jest.fn(),
    markEmailVerified: jest.fn(),
  };
  const mailService = { sendVerificationEmail: jest.fn() };
  const oneTimeTokenService = { create: jest.fn(), consume: jest.fn() };
  const service = new AuthService(
    usersService as unknown as UsersService,
    mailService as unknown as MailService,
    oneTimeTokenService as unknown as OneTimeTokenService,
  );
  const flushPromises = () => new Promise(setImmediate);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    usersService.findByEmail.mockResolvedValue(null);
    usersService.createReader.mockResolvedValue(USER);
    oneTimeTokenService.create.mockResolvedValue('token-1');
  });

  describe('register', () => {
    it('creates a reader with a hashed password and emails a 24h token', async () => {
      await expect(service.register(REGISTER)).resolves.toEqual({
        id: USER.id,
        email: USER.email,
        displayName: USER.displayName,
      });

      const [created] = usersService.createReader.mock.calls[0] as [
        { passwordHash: string },
      ];

      await expect(
        verifyPassword(created.passwordHash, REGISTER.password),
      ).resolves.toBe(true);
      expect(oneTimeTokenService.create).toHaveBeenCalledWith(
        OneTimeTokenPurpose.VERIFY_EMAIL,
        USER.id,
        86400,
      );
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        USER.email,
        'token-1',
      );
    });

    it('rejects an email that already exists', async () => {
      usersService.findByEmail.mockResolvedValue(USER);

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
    it('marks the email verified', async () => {
      oneTimeTokenService.consume.mockResolvedValue(USER.id);

      await service.verifyEmail('token-1');

      expect(oneTimeTokenService.consume).toHaveBeenCalledWith(
        OneTimeTokenPurpose.VERIFY_EMAIL,
        'token-1',
      );
      expect(usersService.markEmailVerified).toHaveBeenCalledWith(USER.id);
    });

    it('rejects an invalid or used token', async () => {
      oneTimeTokenService.consume.mockResolvedValue(null);

      await expect(service.verifyEmail('bad')).rejects.toMatchObject({
        code: 2004,
      });
      expect(usersService.markEmailVerified).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('sends a new link to an unverified user', async () => {
      usersService.findByEmail.mockResolvedValue(USER);

      await service.resendVerification(USER.email);
      await flushPromises();

      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        USER.email,
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

    it('does nothing for a verified user', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...USER,
        emailVerifiedAt: new Date(),
      });

      await service.resendVerification(USER.email);
      await flushPromises();

      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });
});
