import { VNPay } from 'vnpay/vnpay';
import { HashAlgorithm, ProductCode, VnpLocale } from 'vnpay/enums';
import { VNPAY_GATEWAY_SANDBOX_HOST } from 'vnpay/constants';
import { dateFormat, ignoreLogger } from 'vnpay/utils';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Khởi tạo VNPay SDK (theo chuẩn lehuygiang28/vnpay mới nhất) ────────────
const vnpay = new VNPay({
  // ⚡ Cấu hình bắt buộc
  tmnCode:       process.env.VNP_TMN_CODE    ?? '',
  secureSecret:  process.env.VNP_HASH_SECRET ?? '',
  vnpayHost:     VNPAY_GATEWAY_SANDBOX_HOST, // Luôn ưu tiên sandbox theo email cấp
  
  // 🔧 Cấu hình tùy chọn
  testMode:      true,
  hashAlgorithm: HashAlgorithm.SHA512,
  enableLog:     true, // Bật log để dễ theo dõi lỗi cấu hình (nếu có)
  loggerFn:      ignoreLogger,
  
  // 🔧 Cấu hình Endpoint chính xác theo email cấp
  endpoints: {
      paymentEndpoint: 'paymentv2/vpcpay.html',
      queryDrRefundEndpoint: 'merchant_webapi/api/transaction',
      getBankListEndpoint: 'qrpayauth/api/merchant/get_bank_list',
  },
});

// ── Helper: fix IPv6 localhost → IPv4 ────────────────────────────────────────
export function normalizeIp(ip: string): string {
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

// ── Tạo URL thanh toán ────────────────────────────────────────────────────────
export function createPaymentUrl(params: {
  bookingId: number | string;
  txnRef: string;
  amount: number;
  ipAddr: string;
  expireAt?: Date | null;
}): string {
  const returnUrl = process.env.VNP_RETURN_URL ?? 'http://localhost:3000/payment/vnpay-return';

  return vnpay.buildPaymentUrl({
    vnp_Amount:    params.amount,                          // SDK tự nhân 100
    vnp_IpAddr:    normalizeIp(params.ipAddr),
    vnp_TxnRef:    params.txnRef,
    vnp_OrderInfo: `Thanh toan don hang ${params.bookingId}`,
    vnp_OrderType: ProductCode.Other,
    vnp_ReturnUrl: returnUrl,
    vnp_Locale:    VnpLocale.VN, // Dùng enum chuẩn từ thư viện
  });
}

// ── Xác minh chữ ký return URL / IPN ─────────────────────────────────────────
export function verifyReturnUrl(query: Record<string, string>) {
  return vnpay.verifyReturnUrl(query as any);
}

export function verifyIpnCall(query: Record<string, string>) {
  return vnpay.verifyIpnCall(query as any);
}
