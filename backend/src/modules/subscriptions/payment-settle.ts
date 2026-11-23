import { DataSource } from 'typeorm';
import { PaymentStatus } from '../../utils/enums/payment-status.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { Payment } from './entities/payment.entity';
import {
  confirmPaymentSuccess,
  lockPayment,
  resignPayments,
} from './payment-success';
import { sepay } from './sepay-checkout';

/** order_status bên SePay; null = SePay chưa có đơn (NXB chưa chọn phương thức thanh toán) */
async function sepayOrderStatus(orderCode: string): Promise<string | null> {
  try {
    const { data } = await sepay.order.retrieve(orderCode);
    return data.data.order_status;
  } catch (error) {
    if (
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return null;
    }
    throw sepayUnavailable(error);
  }
}

/** 503 cho người gọi, giữ lỗi gốc của SePay trong cause cho job ghi log / mail */
function sepayUnavailable(error: unknown): AppException {
  return new AppException(
    ERRORS.SERVICE_UNAVAILABLE,
    undefined,
    undefined,
    error,
  );
}

/**
 * Chốt một đơn pending, dùng chung cho API hủy và job đơn quá hạn. Gọi SePay
 * ngoài transaction.
 * - SePay đã nhận tiền (CAPTURED): xác nhận thành công (IPN về trước thì không làm gì).
 * - Chưa trả: hủy bên SePay để form / QR cũ không trả được nữa, rồi đánh failed.
 *   SePay chưa có đơn (null) hoặc đã CANCELLED thì không cần hủy, chỉ đánh failed.
 * Trả trạng thái cuối của đơn. SePay lỗi thì ném SERVICE_UNAVAILABLE, đơn giữ pending.
 * onConfirmed: gọi sau commit khi chính lần này xác nhận đơn (gửi mail biên nhận).
 * Lưu ý: SePay vẫn cho hủy đơn đã CAPTURED, nên nếu NXB trả đúng lúc giữa retrieve
 * và cancel thì đơn bị đánh failed, IPN về sau sẽ log để xử lý tay (chấp nhận).
 */
export async function settlePendingPayment(
  dataSource: DataSource,
  payment: Pick<Payment, 'id' | 'orderCode'>,
  onConfirmed?: (paymentId: string) => Promise<void>,
): Promise<PaymentStatus.SUCCESS | PaymentStatus.FAILED> {
  const status = await sepayOrderStatus(payment.orderCode);

  if (status === 'CAPTURED') {
    const confirmed = await dataSource.transaction((manager) =>
      confirmPaymentSuccess(manager, payment.id),
    );

    if (confirmed) {
      await onConfirmed?.(payment.id);
    }

    return PaymentStatus.SUCCESS;
  }

  if (status !== null && status !== 'CANCELLED') {
    try {
      await sepay.order.cancel(payment.orderCode);
    } catch (error) {
      throw sepayUnavailable(error);
    }
  }

  return dataSource.transaction(async (manager) => {
    const { payment: locked } = await lockPayment(manager, { id: payment.id });

    if (!locked || locked.status !== PaymentStatus.PENDING) {
      return locked?.status === PaymentStatus.SUCCESS
        ? PaymentStatus.SUCCESS
        : PaymentStatus.FAILED;
    }

    await manager.update(Payment, payment.id, { status: PaymentStatus.FAILED });
    await resignPayments(manager, [payment.id]);

    return PaymentStatus.FAILED;
  });
}
