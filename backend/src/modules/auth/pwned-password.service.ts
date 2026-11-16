import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';

// API Pwned Passwords của Have I Been Pwned: miễn phí, không cần key
const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 3000;
const HASH_PREFIX_LENGTH = 5;

@Injectable()
export class PwnedPasswordService {
  private readonly logger = new Logger(PwnedPasswordService.name);

  /**
   * Chặn mật khẩu xuất hiện nhiều hơn PWNED_PASSWORD_THRESHOLD lần trong dữ liệu rò rỉ.
   * HIBP lỗi hoặc quá chậm thì cho qua (chỉ ghi log), không chặn người dùng.
   */
  async assertNotPwned(password: string): Promise<void> {
    let count: number;

    try {
      count = await this.count(password);
    } catch (error) {
      this.logger.warn(
        `Không kiểm tra được mật khẩu rò rỉ, cho qua: ${String(error)}`,
      );
      return;
    }

    if (count > env.pwnedPasswordThreshold) {
      throw new AppException(
        ERRORS.PASSWORD_PWNED,
        `Mật khẩu này đã xuất hiện ${count.toLocaleString('vi-VN')} lần trong các vụ rò rỉ dữ liệu (theo HaveIBeenPwned), vui lòng chọn mật khẩu khác`,
      );
    }
  }

  // k-anonymity: chỉ gửi 5 ký tự đầu của SHA-1, so phần còn lại trên server mình
  private async count(password: string): Promise<number> {
    const hash = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = hash.slice(0, HASH_PREFIX_LENGTH);
    const suffix = hash.slice(HASH_PREFIX_LENGTH);

    const response = await fetch(`${RANGE_URL}${prefix}`, {
      // Add-Padding: thêm dòng giả để kích thước response không lộ prefix
      headers: { 'Add-Padding': 'true', 'User-Agent': 'BookStation' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`HIBP trả HTTP ${response.status}`);
    }

    // Mỗi dòng dạng "SUFFIX:COUNT"; dòng padding có COUNT = 0
    for (const line of (await response.text()).split('\n')) {
      const [lineSuffix, lineCount] = line.trim().split(':');

      if (lineSuffix === suffix) {
        return Number(lineCount);
      }
    }

    return 0;
  }
}
