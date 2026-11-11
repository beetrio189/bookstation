import { Logger } from '@nestjs/common';
import { UnverifiedUsersCleanupJob } from '../../../src/modules/users/unverified-users-cleanup.job';
import { UsersService } from '../../../src/modules/users/users.service';

describe('UnverifiedUsersCleanupJob', () => {
  const usersService = { deleteUnverifiedLocalUsers: jest.fn() };
  const job = new UnverifiedUsersCleanupJob(
    usersService as unknown as UsersService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  it('deletes accounts created more than 7 days ago', async () => {
    usersService.deleteUnverifiedLocalUsers.mockResolvedValue(3);

    await job.run(new Date('2026-11-10T03:00:00Z'));

    expect(usersService.deleteUnverifiedLocalUsers).toHaveBeenCalledWith(
      new Date('2026-11-03T03:00:00Z'),
    );
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'Đã xóa 3 tài khoản chưa xác minh',
    );
  });

  it('logs the error instead of throwing', async () => {
    const failure = new Error('connection lost');
    usersService.deleteUnverifiedLocalUsers.mockRejectedValue(failure);

    await expect(job.run()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(failure);
  });
});
