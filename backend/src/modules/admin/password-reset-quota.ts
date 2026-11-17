import Redis from 'ioredis';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';

const LIMIT_PER_DAY = 3;
const WINDOW_SECONDS = 24 * 60 * 60;

const buildKey = (target: string) => `admin:password-reset-quota:${target}`;

/**
 * Giới hạn số lần admin/KDV đặt lại mật khẩu cho một tài khoản đích: 3 lần
 * mỗi 24 giờ, tính chung mọi IP và mọi người làm (chống KDV cố tình đăng
 * xuất NXB liên tục). Đếm trước khi làm; lần nào thất bại thì trả lại lượt.
 */
export class PasswordResetQuota {
  constructor(private readonly redis: Redis) {}

  async take(target: string): Promise<void> {
    const key = buildKey(target);
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, WINDOW_SECONDS);
    }

    if (count > LIMIT_PER_DAY) {
      throw new AppException(ERRORS.PASSWORD_RESET_LIMIT);
    }
  }

  async giveBack(target: string): Promise<void> {
    await this.redis.decr(buildKey(target));
  }
}
