const crypto = require('crypto');
const qs = require('qs');
const moment = require('moment');

/**
 * Hàm sắp xếp object theo thứ tự bảng chữ cái các thuộc tính (chuẩn VNPay)
 */
function sortObject(obj) {
  const sorted = {};
  const str = [];
  let key;
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
}

/**
 * Tạo URL thanh toán VNPay Sandbox
 */
function createVNPayUrl(req, { orderId, amount, orderInfo, bankCode }) {
  process.env.TZ = 'Asia/Ho_Chi_Minh';
  const date = new Date();
  const createDate = moment(date).format('YYYYMMDDHHmmss');

  let ipAddr =
    req.headers['x-forwarded-for'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    '127.0.0.1';

  if (ipAddr && ipAddr.includes(',')) {
    ipAddr = ipAddr.split(',')[0].trim();
  }
  if (ipAddr === '::1' || ipAddr === '::ffff:127.0.0.1') {
    ipAddr = '127.0.0.1';
  }

  const tmnCode = process.env.VNP_TMN_CODE;
  const secretKey = process.env.VNP_HASH_SECRET;
  let vnpUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  const returnUrl = process.env.VNP_RETURN_URL || 'http://localhost:8080/api/v1/payments/vnpay-return';

  const locale = 'vn';
  const currCode = 'VND';

  const vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: locale,
    vnp_CurrCode: currCode,
    vnp_TxnRef: orderId.toString(),
    vnp_OrderInfo: orderInfo || `Thanh toan don hang ${orderId}`,
    vnp_OrderType: 'other',
    vnp_Amount: Math.round(Number(amount) * 100), // VNPay yêu cầu nhân 100
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate
  };

  if (bankCode) {
    vnp_Params['vnp_BankCode'] = bankCode;
  }

  const sortedParams = sortObject(vnp_Params);
  const signData = qs.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  sortedParams['vnp_SecureHash'] = signed;
  vnpUrl += '?' + qs.stringify(sortedParams, { encode: false });

  return vnpUrl;
}

/**
 * Kiểm tra tính hợp lệ của chữ ký phản hồi từ VNPay (Return URL)
 */
function verifyVNPayReturn(queryParams) {
  const vnp_Params = { ...queryParams };
  const secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  const sortedParams = sortObject(vnp_Params);
  const secretKey = process.env.VNP_HASH_SECRET;
  const signData = qs.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  const isValid = secureHash === signed;

  return {
    isValid,
    orderId: vnp_Params['vnp_TxnRef'],
    amount: Number(vnp_Params['vnp_Amount']) / 100,
    responseCode: vnp_Params['vnp_ResponseCode'],
    transactionNo: vnp_Params['vnp_TransactionNo'],
    bankCode: vnp_Params['vnp_BankCode'],
    payDate: vnp_Params['vnp_PayDate'],
    orderInfo: vnp_Params['vnp_OrderInfo'],
    rawParams: vnp_Params
  };
}

module.exports = {
  createVNPayUrl,
  verifyVNPayReturn,
  sortObject
};

