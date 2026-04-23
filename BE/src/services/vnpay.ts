import { VNPay } from 'vnpay/vnpay';
import { HashAlgorithm, ProductCode } from 'vnpay/enums';
import { VNPAY_GATEWAY_SANDBOX_HOST } from 'vnpay/constants';
import { dateFormat, ignoreLogger } from 'vnpay/utils';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Khởi tạo VNPay SDK ────────────────────────────────────────────────────────
const vnpay = new VNPay({
  tmnCode:       process.env.VNP_TMN_CODE    ?? '',
  secureSecret:  process.env.VNP_HASH_SECRET ?? '',
  vnpayHost:     process.env.VNP_HOST ?? VNPAY_GATEWAY_SANDBOX_HOST,
  testMode:      true,
  hashAlgorithm: HashAlgorithm.SHA512,
  enableLog:     false,
  loggerFn:      ignoreLogger,
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
  amount: number;
  ipAddr: string;
  expireAt?: Date | null;
}): string {
  const returnUrl = process.env.VNP_RETURN_URL ?? 'http://localhost:3000/payment/vnpay-return';
  const now = new Date();
  const expireDate = params.expireAt && !Number.isNaN(params.expireAt.getTime())
    ? params.expireAt
    : null;

  return vnpay.buildPaymentUrl({
    vnp_Amount:    params.amount,                          // SDK tự nhân 100
    vnp_IpAddr:    normalizeIp(params.ipAddr),
    vnp_ReturnUrl: returnUrl,
    vnp_TxnRef:    String(params.bookingId),
    vnp_OrderInfo: `Thanh toan don hang ${params.bookingId}`,
    vnp_OrderType: ProductCode.Other,
    vnp_Locale:    'vn' as any,
    vnp_CreateDate: dateFormat(now),
    ...(expireDate ? { vnp_ExpireDate: dateFormat(expireDate) } : {}),
  });
}

// ── Xác minh chữ ký return URL / IPN ─────────────────────────────────────────
export function verifyReturnUrl(query: Record<string, string>) {
  return vnpay.verifyReturnUrl(query as any);
}

export function verifyIpnCall(query: Record<string, string>) {
  return vnpay.verifyIpnCall(query as any);
}
