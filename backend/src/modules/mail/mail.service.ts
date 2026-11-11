import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '../../config';

// Link trong email mang cả uid lẫn token: Redis lưu token theo uid
const buildLink = (path: string, userId: string, token: string) =>
  `${env.feUrl}/${path}?${new URLSearchParams({ uid: userId, token }).toString()}`;

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

    await this.send({
      to,
      subject: 'Xác nhận tài khoản BookStation',
      html: `
        <p>Chào bạn,</p>
        <p>Bấm vào liên kết dưới đây để xác nhận tài khoản BookStation. Liên kết có hiệu lực trong 24 giờ.</p>
        <p><a href="${link}">Xác nhận tài khoản</a></p>
        <p>Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email.</p>
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
        <p>Bấm vào liên kết dưới đây để đặt lại mật khẩu BookStation. Liên kết có hiệu lực trong 30 phút.</p>
        <p><a href="${link}">Đặt lại mật khẩu</a></p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email.</p>
      `,
      devNote: link,
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
