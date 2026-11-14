import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from '../../src/modules/auth/one-time-token.service';
import {
  MailJob,
  MailJobData,
} from '../../src/modules/mail/mail-queue.constants';
import { MailService } from '../../src/modules/mail/mail.service';
import { MailProcessor } from '../../src/worker/mail.processor';

const job = (name: string, data: MailJobData) =>
  ({
    id: '1',
    name,
    data,
    attemptsMade: 1,
  }) as unknown as Job<MailJobData>;

describe('MailProcessor', () => {
  const oneTimeTokenService = { create: jest.fn() };
  const mailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendPasswordChangedEmail: jest.fn(),
  };
  const processor = new MailProcessor(
    oneTimeTokenService as unknown as OneTimeTokenService,
    mailService as unknown as MailService,
  );
  const DATA = { userId: 'user-1', email: 'a@example.com' };

  beforeEach(() => {
    jest.resetAllMocks();
    oneTimeTokenService.create.mockResolvedValue('token-1');
  });

  it('creates a 24h token and sends the verification email', async () => {
    await processor.process(job(MailJob.VERIFY_EMAIL, DATA));

    expect(oneTimeTokenService.create).toHaveBeenCalledWith(
      OneTimeTokenPurpose.VERIFY_EMAIL,
      'user-1',
      86400,
    );
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
      'a@example.com',
      'user-1',
      'token-1',
    );
  });

  it('creates a 24h reset token and sends the password reset email', async () => {
    await processor.process(job(MailJob.RESET_PASSWORD, DATA));

    expect(oneTimeTokenService.create).toHaveBeenCalledWith(
      OneTimeTokenPurpose.RESET_PASSWORD,
      'user-1',
      86400,
    );
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'a@example.com',
      'user-1',
      'token-1',
    );
  });

  it('sends the password changed email without a token', async () => {
    await processor.process(
      job(MailJob.PASSWORD_CHANGED, {
        ...DATA,
        changedAt: '2026-11-14T03:00:00.000Z',
      } as MailJobData),
    );

    expect(mailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
      'a@example.com',
      new Date('2026-11-14T03:00:00.000Z'),
    );
    expect(oneTimeTokenService.create).not.toHaveBeenCalled();
  });

  it('throws so BullMQ retries when the email cannot be sent', async () => {
    const failure = new Error('Resend: down');
    mailService.sendVerificationEmail.mockRejectedValue(failure);

    await expect(
      processor.process(job(MailJob.VERIFY_EMAIL, DATA)),
    ).rejects.toBe(failure);
  });

  it('rejects an unknown job', async () => {
    await expect(processor.process(job('unknown', DATA))).rejects.toThrow(
      'unknown',
    );
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('logs a sent email by user id, without the address', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    processor.onCompleted(job(MailJob.VERIFY_EMAIL, DATA));

    expect(log).toHaveBeenCalledWith(expect.stringContaining('user-1'));
    expect(log).not.toHaveBeenCalledWith(
      expect.stringContaining('a@example.com'),
    );
  });

  it('logs a failed attempt', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    processor.onFailed(job(MailJob.VERIFY_EMAIL, DATA), new Error('down'));

    expect(error).toHaveBeenCalledWith(expect.stringContaining('down'));
  });
});
