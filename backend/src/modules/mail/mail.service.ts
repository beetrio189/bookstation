import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '../../config';
import { AccountType } from './mail-queue.constants';

// Link trong email mang cả uid lẫn token: Redis lưu token theo uid
const buildLink = (path: string, userId: string, token: string) =>
  `${env.feUrl}/${path}?${new URLSearchParams({ uid: userId, token }).toString()}`;

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  publisher: 'nhà xuất bản',
  moderator: 'kiểm duyệt viên',
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

interface MailMessage {
  to: string;
  subject: string;
  html: string;
  devNote: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend = env.resendApiKey
    ? new Resend(env.resendApiKey)
    : null;

  async sendVerificationEmail(
    to: string,
    userId: string,
    token: string,
  ): Promise<void> {
    const link = buildLink('verify-email', userId, token);
    const forgotPasswordLink = `${env.feUrl}/forgot-password`;

    await this.send({
      to,
      subject: 'Xác nhận tài khoản BookStation',
      html: `
        <p>Chào bạn,</p>
        <p>Bấm vào liên kết dưới đây để xác nhận tài khoản BookStation. Liên kết có hiệu lực trong 24 giờ.</p>
        <p><a href="${link}">Xác nhận tài khoản</a></p>
        <p>Nếu bạn không chắc chắn rằng email này do bạn gửi, hãy truy cập <a href="${forgotPasswordLink}">Quên mật khẩu</a> để tránh rủi ro bị chiếm tài khoản.</p>
      `,
      devNote: link,
    });
  }

  async sendPasswordResetEmail(
    to: string,
    userId: string,
    token: string,
  ): Promise<void> {
    const link = buildLink('reset-password', userId, token);

    await this.send({
      to,
      subject: 'Đặt lại mật khẩu BookStation',
      html: `
        <p>Chào bạn,</p>
        <p>Bấm vào liên kết dưới đây để đặt lại mật khẩu BookStation. Liên kết có hiệu lực trong 24 giờ.</p>
        <p><a href="${link}">Đặt lại mật khẩu</a></p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email.</p>
      `,
      devNote: link,
    });
  }

  async sendPasswordChangedEmail(to: string, changedAt: Date): Promise<void> {
    const forgotPasswordLink = `${env.feUrl}/forgot-password`;
    const time = changedAt.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    await this.send({
      to,
      subject: 'Mật khẩu BookStation vừa được thay đổi',
      html: `
        <p>Chào bạn,</p>
        <p>Mật khẩu tài khoản BookStation của bạn vừa được thay đổi lúc ${time} (giờ Việt Nam). Mọi thiết bị đã bị đăng xuất.</p>
        <p>Nếu không phải bạn, hãy dùng chức năng <a href="${forgotPasswordLink}">Quên mật khẩu</a> ngay và liên hệ bookstationadmin@gmail.com.</p>
      `,
      devNote: `mật khẩu vừa được thay đổi lúc ${time}`,
    });
  }

  /**
   * Tài khoản do hệ thống cấp (NXB do kiểm duyệt viên/admin tạo, kiểm duyệt viên do
   * admin tạo): gửi email đăng nhập + mật khẩu, nhắc đổi mật khẩu ngay (chỉ nhắc).
   */
  sendAccountCredentialsEmail(
    to: string,
    accountType: AccountType,
    password: string,
  ): Promise<void> {
    const label = ACCOUNT_TYPE_LABELS[accountType];

    return this.sendCredentials(to, accountType, password, {
      subject: 'Tài khoản BookStation của bạn đã được tạo',
      intro: `Tài khoản ${label} BookStation của bạn đã được tạo.`,
      afterLogin: 'đăng nhập lần đầu',
      notRequested: 'Nếu bạn không yêu cầu tạo tài khoản',
    });
  }

  sendAccountPasswordResetEmail(
    to: string,
    accountType: AccountType,
    password: string,
  ): Promise<void> {
    const label = ACCOUNT_TYPE_LABELS[accountType];

    return this.sendCredentials(to, accountType, password, {
      subject: 'Mật khẩu BookStation của bạn đã được đặt lại',
      intro: `Mật khẩu tài khoản ${label} BookStation của bạn đã được đặt lại. Mật khẩu cũ không còn dùng được.`,
      afterLogin: 'đăng nhập',
      notRequested: 'Nếu bạn không yêu cầu đặt lại mật khẩu',
    });
  }

  private async sendCredentials(
    to: string,
    accountType: AccountType,
    password: string,
    text: {
      subject: string;
      intro: string;
      afterLogin: string;
      notRequested: string;
    },
  ): Promise<void> {
    const loginLink = `${env.feUrl}/login`;

    await this.send({
      to,
      subject: text.subject,
      html: `
        <p>Chào bạn,</p>
        <p>${text.intro}</p>
        <p>Email đăng nhập: <b>${escapeHtml(to)}</b><br>Mật khẩu: <b>${escapeHtml(password)}</b></p>
        <p><a href="${loginLink}">Đăng nhập BookStation</a></p>
        <p><b>Vì lý do bảo mật, hãy đổi mật khẩu ngay sau khi ${text.afterLogin}</b> và xóa email này.</p>
        <p>${text.notRequested}, hãy liên hệ bookstationadmin@gmail.com.</p>
      `,
      // Chỉ in ra log khi chạy dev không có key Resend; production bắt buộc có key
      devNote: `${text.subject}: tài khoản ${accountType}, mật khẩu ${password}`,
    });
  }

  private async send({ to, subject, html, devNote }: MailMessage) {
    if (!this.resend) {
      this.logger.log(`Email to ${to}: ${devNote}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: env.mailFrom as string,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend: ${error.message}`);
    }
  }
}
