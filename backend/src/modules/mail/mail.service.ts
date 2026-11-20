import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '../../config';
import { AccountType, PlanSnapshot } from './mail-queue.constants';

const buildLink = (path: string, userId: string, token: string) =>
  `${env.feUrl}/${path}?${new URLSearchParams({ uid: userId, token }).toString()}`;

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  publisher: 'nhà xuất bản',
  editor: 'biên tập viên',
  moderator: 'kiểm duyệt viên',
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

const formatDate = (value: Date) =>
  value.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

const describePlan = ({ name, price, bookLimit, editorLimit }: PlanSnapshot) =>
  `<b>${escapeHtml(name)}</b>: tối đa ${formatNumber(bookLimit)} cuốn sách, ` +
  `${formatNumber(editorLimit)} biên tập viên, giá ` +
  (price === 0 ? 'miễn phí' : `${formatNumber(price)} đ`);

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
    reason?: string,
  ): Promise<void> {
    const label = ACCOUNT_TYPE_LABELS[accountType];

    return this.sendCredentials(to, accountType, password, {
      subject: 'Mật khẩu BookStation của bạn đã được đặt lại',
      intro: `Mật khẩu tài khoản ${label} BookStation của bạn đã được đặt lại. Mật khẩu cũ không còn dùng được.`,
      afterLogin: 'đăng nhập',
      notRequested: 'Nếu bạn không yêu cầu đặt lại mật khẩu',
      reason,
    });
  }

  // Tài khoản bị admin xóa hẳn: không còn đăng nhập được. Không kèm lý do
  async sendAccountDeletedEmail(
    to: string,
    accountType: AccountType,
  ): Promise<void> {
    const label = ACCOUNT_TYPE_LABELS[accountType];

    await this.send({
      to,
      subject: `Tài khoản ${label} BookStation của bạn đã bị xóa`,
      html: `
        <p>Chào bạn,</p>
        <p>Tài khoản ${label} BookStation gắn với email <b>${escapeHtml(to)}</b> đã bị quản trị viên xóa. Bạn không còn đăng nhập được bằng tài khoản này.</p>
        <p>Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ bookstationadmin@gmail.com.</p>
      `,
      devNote: `tài khoản ${accountType} đã bị xóa`,
    });
  }

  /**
   * Báo NXB bị đình chỉ: tài khoản NXB và mọi biên tập viên bị khóa, sách vẫn
   * hiện, khảo sát tạm ẩn với độc giả. Lý do (escape HTML) ở cuối.
   */
  async sendPublisherSuspendedEmail(
    to: string,
    publisherName: string,
    reason: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Nhà xuất bản của bạn đã bị đình chỉ trên BookStation',
      html: `
        <p>Chào bạn,</p>
        <p>Nhà xuất bản <b>${escapeHtml(publisherName)}</b> đã bị đình chỉ trên BookStation. Tài khoản nhà xuất bản và mọi biên tập viên đã bị khóa và đăng xuất khỏi mọi thiết bị.</p>
        <p>Sách của nhà xuất bản vẫn hiển thị với độc giả; khảo sát tạm ẩn cho đến khi được mở khóa.</p>
        <p>Nếu có thắc mắc, hãy liên hệ bookstationadmin@gmail.com.</p>
        <p>Lý do: ${escapeHtml(reason)}</p>
      `,
      devNote: `nhà xuất bản ${publisherName} bị đình chỉ, lý do: ${reason}`,
    });
  }

  async sendPublisherUnsuspendedEmail(
    to: string,
    publisherName: string,
    reason: string,
  ): Promise<void> {
    const loginLink = `${env.feUrl}/login`;

    await this.send({
      to,
      subject: 'Nhà xuất bản của bạn đã được mở khóa trên BookStation',
      html: `
        <p>Chào bạn,</p>
        <p>Nhà xuất bản <b>${escapeHtml(publisherName)}</b> đã được mở khóa trên BookStation. Tài khoản nhà xuất bản và các biên tập viên đã đăng nhập lại được, khảo sát hiển thị lại với độc giả.</p>
        <p><a href="${loginLink}">Đăng nhập BookStation</a></p>
        <p>Nếu có thắc mắc, hãy liên hệ bookstationadmin@gmail.com.</p>
        <p>Lý do: ${escapeHtml(reason)}</p>
      `,
      devNote: `nhà xuất bản ${publisherName} được mở khóa, lý do: ${reason}`,
    });
  }

  /**
   * Admin đổi giá / hạn mức gói. Gói trả phí: báo gói NXB đang dùng (tên lúc mua)
   * đã được thay đổi, hạn mức hiện tại giữ đến hết kỳ. Gói Free: báo hạn mức mới.
   */
  async sendPlanUpdatedEmail(
    to: string,
    plan: PlanSnapshot,
    current?: { planName: string; periodEndsAt: Date },
  ): Promise<void> {
    const body = current
      ? `<p>Gói <b>${escapeHtml(current.planName)}</b> mà nhà xuất bản của bạn đang dùng đã được thay đổi thành gói ${describePlan(plan)}.</p>
        <p>Hạn mức gói hiện tại của bạn vẫn được giữ nguyên đến hết kỳ (ngày ${formatDate(current.periodEndsAt)}).</p>`
      : `<p>Chúng tôi vừa thay đổi gói ${describePlan(plan)}.</p>`;

    await this.send({
      to,
      subject: 'Gói hội viên BookStation đã được thay đổi',
      html: `
        <p>Chào bạn,</p>
        ${body}
        <p>Nếu có thắc mắc, hãy liên hệ bookstationadmin@gmail.com.</p>
      `,
      devNote: `gói ${plan.name} đã thay đổi (giá ${plan.price}, ${plan.bookLimit} sách, ${plan.editorLimit} biên tập viên)`,
    });
  }

  async sendPlanDeletedEmail(
    to: string,
    planName: string,
    periodEndsAt: Date,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Gói hội viên BookStation của bạn đã ngừng cung cấp',
      html: `
        <p>Chào bạn,</p>
        <p>Gói <b>${escapeHtml(planName)}</b> mà nhà xuất bản của bạn đang dùng đã ngừng cung cấp trên BookStation.</p>
        <p>Hạn mức gói hiện tại của bạn vẫn được giữ nguyên đến hết kỳ (ngày ${formatDate(periodEndsAt)}). Sau đó bạn có thể chọn mua gói khác.</p>
        <p>Nếu có thắc mắc, hãy liên hệ bookstationadmin@gmail.com.</p>
      `,
      devNote: `gói ${planName} đã ngừng cung cấp`,
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
      // Ghi chú do admin/KDV nhập: escape HTML, đặt ở cuối
      reason?: string;
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
        ${text.reason ? `<p>Lý do: ${escapeHtml(text.reason)}</p>` : ''}
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
