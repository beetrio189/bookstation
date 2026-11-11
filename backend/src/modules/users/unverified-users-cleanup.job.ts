import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from './users.service';

export const UNVERIFIED_ACCOUNT_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UnverifiedUsersCleanupJob {
  private readonly logger = new Logger(UnverifiedUsersCleanupJob.name);

  constructor(private readonly usersService: UsersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'Asia/Ho_Chi_Minh' })
  async run(now = new Date()): Promise<void> {
    const createdBefore = new Date(
      now.getTime() - UNVERIFIED_ACCOUNT_TTL_DAYS * DAY_MS,
    );

    try {
      const count =
        await this.usersService.deleteUnverifiedLocalUsers(createdBefore);

      this.logger.log(`Đã xóa ${count} tài khoản chưa xác minh`);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
