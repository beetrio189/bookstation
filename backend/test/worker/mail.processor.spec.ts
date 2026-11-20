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
import { UsersService } from '../../src/modules/users/users.service';
import {
  PASSWORD_PATTERN,
  PASSWORD_STRENGTH_PATTERN,
  verifyPassword,
} from '../../src/utils/password';
import { MailProcessor } from '../../src/worker/mail.processor';
import { PlanNoticeService } from '../../src/worker/plan-notice.service';

// attemptsMade = số lần đã lỗi trước lần chạy này; cấu hình thật là 3 lần
const job = (name: string, data: MailJobData, attemptsMade = 1) =>
  ({
    id: '1',
    name,
    data,
    attemptsMade,
    opts: { attempts: 3 },
  }) as unknown as Job<MailJobData>;

describe('MailProcessor', () => {
  const oneTimeTokenService = { create: jest.fn() };
  const mailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendPasswordChangedEmail: jest.fn(),
    sendAccountCredentialsEmail: jest.fn(),
    sendAccountPasswordResetEmail: jest.fn(),
    sendPublisherSuspendedEmail: jest.fn(),
    sendAccountDeletedEmail: jest.fn(),
    sendPublisherUnsuspendedEmail: jest.fn(),
    sendPlanUpdatedEmail: jest.fn(),
    sendPlanDeletedEmail: jest.fn(),
  };
  const usersService = {
    setLocalPasswordHash: jest.fn(),
    clearLocalPasswordHash: jest.fn(),
  };
  const planNoticeService = { fanOutPlanUpdated: jest.fn() };
  const processor = new MailProcessor(
    oneTimeTokenService as unknown as OneTimeTokenService,
    mailService as unknown as MailService,
    usersService as unknown as UsersService,
    planNoticeService as unknown as PlanNoticeService,
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

  describe('account credentials', () => {
    const CREDENTIALS = { ...DATA, accountType: 'moderator' } as MailJobData;

    it('saves the hash of a new strong password, then emails that password', async () => {
      usersService.setLocalPasswordHash.mockResolvedValue(true);

      await processor.process(job(MailJob.ACCOUNT_CREDENTIALS, CREDENTIALS));

      const [userId, passwordHash] = usersService.setLocalPasswordHash.mock
        .calls[0] as [string, string];
      const [to, accountType, password] = mailService
        .sendAccountCredentialsEmail.mock.calls[0] as [string, string, string];

      expect(userId).toBe('user-1');
      expect(to).toBe('a@example.com');
      expect(accountType).toBe('moderator');
      expect(password).toMatch(PASSWORD_PATTERN);
      expect(password).toMatch(PASSWORD_STRENGTH_PATTERN);
      await expect(verifyPassword(passwordHash, password)).resolves.toBe(true);
      // Mật khẩu không nằm trong dữ liệu job (Redis)
      expect(JSON.stringify(CREDENTIALS)).not.toContain(password);
    });

    it('uses a new password on every retry', async () => {
      usersService.setLocalPasswordHash.mockResolvedValue(true);
      mailService.sendAccountCredentialsEmail.mockRejectedValueOnce(
        new Error('Resend: down'),
      );

      await expect(
        processor.process(job(MailJob.ACCOUNT_CREDENTIALS, CREDENTIALS)),
      ).rejects.toThrow('down');
      await processor.process(job(MailJob.ACCOUNT_CREDENTIALS, CREDENTIALS));

      const [first, second] =
        mailService.sendAccountCredentialsEmail.mock.calls.map(
          ([, , password]) => password as string,
        );

      expect(first).not.toBe(second);
      expect(usersService.setLocalPasswordHash).toHaveBeenCalledTimes(2);
      // Chưa phải lần thử cuối: giữ mật khẩu, chờ chạy lại
      expect(usersService.clearLocalPasswordHash).not.toHaveBeenCalled();
    });

    it.each([MailJob.ACCOUNT_CREDENTIALS, MailJob.ACCOUNT_PASSWORD_RESET])(
      'clears its own password when the last attempt of %s fails',
      async (name) => {
        usersService.setLocalPasswordHash.mockResolvedValue(true);
        const failure = new Error('Resend: down');
        mailService.sendAccountCredentialsEmail.mockRejectedValue(failure);
        mailService.sendAccountPasswordResetEmail.mockRejectedValue(failure);

        await expect(processor.process(job(name, CREDENTIALS, 2))).rejects.toBe(
          failure,
        );

        const [, savedHash] = usersService.setLocalPasswordHash.mock
          .calls[0] as [string, string];

        // Xóa đúng hash vừa đặt, để không đụng mật khẩu của job khác
        expect(usersService.clearLocalPasswordHash).toHaveBeenCalledWith(
          'user-1',
          savedHash,
        );
      },
    );

    it('skips the email when the account no longer exists', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      usersService.setLocalPasswordHash.mockResolvedValue(false);

      await processor.process(job(MailJob.ACCOUNT_CREDENTIALS, CREDENTIALS));

      expect(mailService.sendAccountCredentialsEmail).not.toHaveBeenCalled();
    });

    it('sets and emails a new password with the reset wording after an admin reset', async () => {
      usersService.setLocalPasswordHash.mockResolvedValue(true);

      await processor.process(job(MailJob.ACCOUNT_PASSWORD_RESET, CREDENTIALS));

      const [, passwordHash] = usersService.setLocalPasswordHash.mock
        .calls[0] as [string, string];
      const [to, accountType, password] = mailService
        .sendAccountPasswordResetEmail.mock.calls[0] as [
        string,
        string,
        string,
      ];

      expect(to).toBe('a@example.com');
      expect(accountType).toBe('moderator');
      await expect(verifyPassword(passwordHash, password)).resolves.toBe(true);
      expect(mailService.sendAccountCredentialsEmail).not.toHaveBeenCalled();
    });

    it('passes the reason of the reset to the email', async () => {
      usersService.setLocalPasswordHash.mockResolvedValue(true);

      await processor.process(
        job(MailJob.ACCOUNT_PASSWORD_RESET, {
          ...CREDENTIALS,
          reason: 'NXB báo mất mail',
        } as MailJobData),
      );

      expect(mailService.sendAccountPasswordResetEmail.mock.calls[0][3]).toBe(
        'NXB báo mất mail',
      );
    });

    it('skips the reset email when the account no longer exists', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      usersService.setLocalPasswordHash.mockResolvedValue(false);

      await processor.process(job(MailJob.ACCOUNT_PASSWORD_RESET, CREDENTIALS));

      expect(mailService.sendAccountPasswordResetEmail).not.toHaveBeenCalled();
    });
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

  it.each([
    [MailJob.PUBLISHER_SUSPENDED, 'sendPublisherSuspendedEmail'],
    [MailJob.PUBLISHER_UNSUSPENDED, 'sendPublisherUnsuspendedEmail'],
  ] as const)(
    'sends the %s email with the name and reason, no password',
    async (name, method) => {
      await processor.process(
        job(name, {
          ...DATA,
          publisherName: 'Kim Đồng',
          reason: 'Lý do',
        } as MailJobData),
      );

      expect(mailService[method]).toHaveBeenCalledWith(
        'a@example.com',
        'Kim Đồng',
        'Lý do',
      );
      expect(usersService.setLocalPasswordHash).not.toHaveBeenCalled();
    },
  );

  it('sends the account deleted email without touching the (deleted) user', async () => {
    await processor.process(
      job(MailJob.ACCOUNT_DELETED, {
        ...DATA,
        accountType: 'moderator',
      } as MailJobData),
    );

    expect(mailService.sendAccountDeletedEmail).toHaveBeenCalledWith(
      'a@example.com',
      'moderator',
    );
    expect(usersService.setLocalPasswordHash).not.toHaveBeenCalled();
  });

  describe('plan notices', () => {
    const PLAN = {
      name: 'Basic Plus',
      price: 600000,
      bookLimit: 100000,
      editorLimit: 2,
    };

    it('fans out a plan update by id only (the plan is read again from the database)', async () => {
      await processor.process(
        job(MailJob.PLAN_UPDATED, {
          planId: 'plan-1',
        } as unknown as MailJobData),
      );

      expect(planNoticeService.fanOutPlanUpdated).toHaveBeenCalledWith(
        'plan-1',
      );
    });

    it('emails a subscriber with the old plan name and the end of the period', async () => {
      await processor.process(
        job(MailJob.PLAN_UPDATED_NOTICE, {
          ...DATA,
          plan: PLAN,
          isFree: false,
          oldPlanName: 'basic',
          periodEndsAt: '2027-05-01T00:00:00.000Z',
        } as MailJobData),
      );

      expect(mailService.sendPlanUpdatedEmail).toHaveBeenCalledWith(
        'a@example.com',
        PLAN,
        {
          planName: 'basic',
          periodEndsAt: new Date('2027-05-01T00:00:00.000Z'),
        },
      );
    });

    it('emails a Free publisher without a current period', async () => {
      await processor.process(
        job(MailJob.PLAN_UPDATED_NOTICE, {
          ...DATA,
          plan: { ...PLAN, price: 0 },
          isFree: true,
        } as MailJobData),
      );

      expect(mailService.sendPlanUpdatedEmail).toHaveBeenCalledWith(
        'a@example.com',
        { ...PLAN, price: 0 },
        undefined,
      );
    });

    it('emails a subscriber that the plan was deleted', async () => {
      await processor.process(
        job(MailJob.PLAN_DELETED_NOTICE, {
          ...DATA,
          planName: 'basic',
          periodEndsAt: '2027-05-01T00:00:00.000Z',
        } as MailJobData),
      );

      expect(mailService.sendPlanDeletedEmail).toHaveBeenCalledWith(
        'a@example.com',
        'basic',
        new Date('2027-05-01T00:00:00.000Z'),
      );
    });

    it('logs the fan-out job without a user id', () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      processor.onCompleted(
        job(MailJob.PLAN_UPDATED, {
          planId: 'plan-1',
        } as unknown as MailJobData),
      );

      expect(log).toHaveBeenCalledWith('Job plan-updated (1) xong');
    });
  });
});
