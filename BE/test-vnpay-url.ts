import { createPaymentUrl } from './src/services/vnpay.js';

const url = createPaymentUrl({
  bookingId: 999,
  amount: 100000,
  ipAddr: '127.0.0.1'
});

console.log("Payment URL:", url);
