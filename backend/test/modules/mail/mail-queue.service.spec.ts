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

  it('queues the reason of an admin reset when there is one', async () => {
    const queue = { add: jest.fn() };

    await new MailQueueService(
      queue as unknown as Queue,
    ).enqueueAccountPasswordResetEmail(
      'user-1',
      'a@example.com',
      'publisher',
      'NXB báo mất mail',
    );

    expect(queue.add).toHaveBeenCalledWith(MailJob.ACCOUNT_PASSWORD_RESET, {
      userId: 'user-1',
      email: 'a@example.com',
      accountType: 'publisher',
      reason: 'NXB báo mất mail',
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

  it('queues a publisher status email with the name and reason', async () => {
    const queue = { add: jest.fn() };
    const data = {
      userId: 'user-1',
      email: 'nxb@example.com',
      publisherName: 'Kim Đồng',
      reason: 'Vi phạm',
    };

    await new MailQueueService(
      queue as unknown as Queue,
    ).enqueuePublisherStatusEmail(MailJob.PUBLISHER_SUSPENDED, data);

    expect(queue.add).toHaveBeenCalledWith(MailJob.PUBLISHER_SUSPENDED, data);
  });

  it('queues an account deleted email with the address (the user is gone)', async () => {
    const queue = { add: jest.fn() };

    await new MailQueueService(
      queue as unknown as Queue,
    ).enqueueAccountDeletedEmail('user-1', 'kdv@example.com', 'moderator');

    expect(queue.add).toHaveBeenCalledWith(MailJob.ACCOUNT_DELETED, {
      userId: 'user-1',
      email: 'kdv@example.com',
      accountType: 'moderator',
    });
  });
});
