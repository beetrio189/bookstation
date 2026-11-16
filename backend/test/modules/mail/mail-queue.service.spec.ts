import { Queue } from 'bullmq';
import { MailJob } from '../../../src/modules/mail/mail-queue.constants';
import { MailQueueService } from '../../../src/modules/mail/mail-queue.service';

describe('MailQueueService', () => {
  it('queues a verification email without a token', async () => {
    const queue = { add: jest.fn() };

    await new MailQueueService(
      queue as unknown as Queue,
    ).enqueueVerificationEmail('user-1', 'a@example.com');

    expect(queue.add).toHaveBeenCalledWith(MailJob.VERIFY_EMAIL, {
      userId: 'user-1',
      email: 'a@example.com',
    });
  });

  it('queues a password reset email without a token', async () => {
    const queue = { add: jest.fn() };

    await new MailQueueService(
      queue as unknown as Queue,
    ).enqueuePasswordResetEmail('user-1', 'a@example.com');

    expect(queue.add).toHaveBeenCalledWith(MailJob.RESET_PASSWORD, {
      userId: 'user-1',
      email: 'a@example.com',
    });
  });

  it('queues account credentials without a password', async () => {
    const queue = { add: jest.fn() };

    await new MailQueueService(
      queue as unknown as Queue,
    ).enqueueAccountCredentialsEmail('user-1', 'a@example.com', 'moderator');

    expect(queue.add).toHaveBeenCalledWith(MailJob.ACCOUNT_CREDENTIALS, {
      userId: 'user-1',
      email: 'a@example.com',
      accountType: 'moderator',
    });
  });

  it('queues an admin password reset with the same data, without a password', async () => {
    const queue = { add: jest.fn() };

    await new MailQueueService(
      queue as unknown as Queue,
    ).enqueueAccountPasswordResetEmail('user-1', 'a@example.com', 'moderator');

    expect(queue.add).toHaveBeenCalledWith(MailJob.ACCOUNT_PASSWORD_RESET, {
      userId: 'user-1',
      email: 'a@example.com',
      accountType: 'moderator',
    });
  });

  it('queues a password changed email', async () => {
    const queue = { add: jest.fn() };

    await new MailQueueService(
      queue as unknown as Queue,
    ).enqueuePasswordChangedEmail('user-1', 'a@example.com');

    expect(queue.add).toHaveBeenCalledWith(MailJob.PASSWORD_CHANGED, {
      userId: 'user-1',
      email: 'a@example.com',
      changedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
    });
  });
});
