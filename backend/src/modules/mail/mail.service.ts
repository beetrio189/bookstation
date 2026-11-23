import { Injectable, Logger } from '@nestjs/common';
import escapeHtml from 'escape-html';
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

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

const formatDate = (value: Date) =>
  value.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

const describePlan = ({ name, price, bookLimit, editorLimit }: PlanSnapshot) =>
  `<b>${escapeHtml(name)}</b>: tối đa ${formatNumber(bookLimit)} cuốn sách, ` +
  `${formatNumber(editorLimit)} biên tập viên, giá ` +
  (price === 0 ? 'miễn phí' : `${formatNumber(price)} đ`);

export interface PaymentReceipt {
  orderCode: string;
  publisherName: string;
  planName: string;
  durationMonths: number;
  bookLimit: number;
  editorLimit: number;
  price: number;
  creditUsed: number;
  periodStartsAt: Date;
  periodEndsAt: Date;
  oldPlanName: string | null;
  oldDurationMonths: number | null;
  creditReturned: number | null;
}

const formatDateTime = (value: Date) =>
  value.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const receiptRow = (label: string, value: string, bold = false) =>
  `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;color:#555">${label}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;text-align:right;${bold ? 'font-weight:bold;font-size:16px' : ''}">${value}</td>
  </tr>`;

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

  /**
   * Biên nhận thanh toán gói cho chủ NXB (không phải hóa đơn VAT). Đơn CR… (trả hết
   * bằng credit) cũng gửi. Đổi gói thì thêm dòng gói cũ kết thúc và credit hoàn lại.
   */
  async sendPaymentReceiptEmail(
    to: string,
    receipt: PaymentReceipt,
  ): Promise<void> {
    const total = receipt.price - receipt.creditUsed;
    const plansLink = `${env.feUrl}/publisher/plans`;
    const planName = `${escapeHtml(receipt.planName)} ${receipt.durationMonths} tháng`;
    const method = receipt.orderCode.startsWith('CR')
      ? 'Trả bằng credit'
      : 'Chuyển khoản qua SePay';
    const oldPlan = receipt.oldPlanName
      ? `<p>Gói cũ (${escapeHtml(receipt.oldPlanName)}${
          receipt.oldDurationMonths ? ` ${receipt.oldDurationMonths} tháng` : ''
        }) đã kết thúc${
          receipt.creditReturned
            ? `, phần chưa dùng được hoàn ${formatNumber(receipt.creditReturned)} đ vào credit`
            : ''
        }.</p>`
      : '';

    await this.send({
      to,
      subject: `Biên nhận thanh toán gói BookStation – ${receipt.orderCode}`,
      html: `
        <p>Chào bạn,</p>
        <p>BookStation đã nhận thanh toán gói hội viên của <b>${escapeHtml(receipt.publisherName)}</b>. Gói mới đã được kích hoạt.</p>
        <table style="border-collapse:collapse;width:100%;max-width:560px;font-size:15px">
          ${receiptRow('Mã đơn', receipt.orderCode)}
          ${receiptRow('Thời gian thanh toán', formatDateTime(new Date(receipt.periodStartsAt)))}
          ${receiptRow('Nhà xuất bản', escapeHtml(receipt.publisherName))}
          ${receiptRow('Gói', `${planName}<br><span style="color:#777;font-size:13px">Tối đa ${formatNumber(receipt.bookLimit)} sách · ${formatNumber(receipt.editorLimit)} biên tập viên</span>`)}
          ${receiptRow('Thời hạn', `${formatDate(new Date(receipt.periodStartsAt))} – ${formatDate(new Date(receipt.periodEndsAt))}`)}
          ${receiptRow('Giá gốc', `${formatNumber(receipt.price)} đ`)}
          ${receiptRow('Credit sử dụng', `− ${formatNumber(receipt.creditUsed)} đ`)}
          ${receiptRow('Tổng thanh toán', `${formatNumber(total)} đ`, true)}
          ${receiptRow('Hình thức', method)}
        </table>
        ${oldPlan}
        <p>Xem gói hiện tại ở trang <a href="${plansLink}">Gói hội viên</a>. Nếu có thắc mắc, hãy liên hệ bookstationadmin@gmail.com.</p>
        <p style="color:#777;font-size:13px">Đây là biên nhận thanh toán, không phải hóa đơn giá trị gia tăng.</p>
      `,
      devNote: `biên nhận đơn ${receipt.orderCode}: ${receipt.planName} ${receipt.durationMonths} tháng, ${total} đ`,
    });
  }

  /**
   * Báo admin / KDV: job chốt đơn quá hạn không chốt được đơn nào nhiều lượt liên
   * tiếp (thường do SePay sập hoặc secret sai). Mỗi đợt lỗi chỉ gửi một lần.
   */
  async sendPaymentSettleAlertEmail(
    to: string,
    alert: {
      failingSince: Date;
      failedRuns: number;
      overdueCount: number;
      lastError: string;
    },
  ): Promise<void> {
    const since = alert.failingSince.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    await this.send({
      to,
      subject: '[BookStation] Không chốt được đơn thanh toán quá hạn',
      html: `
        <p>Chào bạn,</p>
        <p>Job chốt đơn thanh toán quá hạn không chốt được đơn nào trong nhiều lượt liên tiếp. Các đơn vẫn đang chờ, chưa bị đánh thất bại.</p>
        <ul>
          <li>Bắt đầu lỗi từ: ${since} (giờ Việt Nam)</li>
          <li>Số lượt lỗi liên tiếp: ${alert.failedRuns}</li>
          <li>Số đơn chờ đã quá hạn: ${formatNumber(alert.overdueCount)}</li>
          <li>Lỗi gần nhất: ${escapeHtml(alert.lastError)}</li>
        </ul>
        <p>Hãy kiểm tra trạng thái SePay, SEPAY_MERCHANT_ID / SEPAY_SECRET_KEY trong .env và log của api.</p>
      `,
      devNote: `job chốt đơn lỗi ${alert.failedRuns} lượt liên tiếp, lỗi gần nhất: ${alert.lastError}`,
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
