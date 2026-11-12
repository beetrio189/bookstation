import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RefreshTokenService } from '../../src/modules/auth/refresh-token.service';
import { MaintenanceJob } from '../../src/modules/maintenance/maintenance-queue.constants';
import { MaintenanceProcessor } from '../../src/worker/maintenance.processor';

const job = (name: string) => ({ id: '1', name }) as unknown as Job;

describe('MaintenanceProcessor', () => {
  const refreshTokenService = { deleteExpired: jest.fn() };
  const processor = new MaintenanceProcessor(
    refreshTokenService as unknown as RefreshTokenService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  it('deletes expired refresh tokens', async () => {
    refreshTokenService.deleteExpired.mockResolvedValue(3);

    await processor.process(job(MaintenanceJob.DELETE_EXPIRED_REFRESH_TOKENS));

    expect(refreshTokenService.deleteExpired).toHaveBeenCalled();
  });

  it('throws so BullMQ retries when the database fails', async () => {
    const failure = new Error('db down');
    refreshTokenService.deleteExpired.mockRejectedValue(failure);

    await expect(
      processor.process(job(MaintenanceJob.DELETE_EXPIRED_REFRESH_TOKENS)),
    ).rejects.toBe(failure);
  });

  it('rejects an unknown job', async () => {
    await expect(processor.process(job('unknown'))).rejects.toThrow(
      'Không có xử lý cho job unknown',
    );
  });
});
