const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER || 'nguyenminhdaiduongtest1@gmail.com';
const EMAIL_PASS = process.env.EMAIL_APP_PASS || process.env.EMAIL_APP_PASSWORD || 'nlqn ezsz ggjt wmnj';

// Google Apps Script Webhook URL (Gửi mail qua HTTPS cổng 443, vượt qua 100% tường lửa chặn SMTP của Render Cloud)
const GOOGLE_SCRIPT_WEBHOOK_URL =
  process.env.GOOGLE_SCRIPT_WEBHOOK_URL ||
  'https://script.google.com/macros/s/AKfycbyUtcbl17f-PSv0JglBaL5O-fOyPEV6d1Hf2sUHwxpbLe3HtXTu-V-HA2FrdBdjRHYF/exec';
const GOOGLE_SCRIPT_SECRET = process.env.GOOGLE_SCRIPT_SECRET || 'foodfast_otp_secret_key_2026';

// Khởi tạo Transporter Gmail SMTP dự phòng với cổng 465 (SSL)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 4000,
  greetingTimeout: 4000,
  socketTimeout: 5000
});

/**
 * Sinh ngẫu nhiên chuỗi OTP 6 chữ số (100000 - 999999)
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Gửi email chứa mã xác thực OTP qua Gmail
 * @param {string} email - Địa chỉ email người nhận
 * @param {string} otp - Mã OTP 6 chữ số
 * @param {'REGISTER' | 'FORGOT_PASSWORD'} type - Loại mục đích gửi
 */
async function sendOTPEmail(email, otp, type = 'REGISTER') {
  let subject = '';
  let title = '';
  let description = '';
  let badgeText = '';

  if (type === 'REGISTER') {
    subject = 'Mã xác thực đăng ký tài khoản FoodFast';
    title = 'Xác thực tài khoản mới';
    description = 'Cảm ơn bạn đã lựa chọn FoodFast! Vui lòng nhập mã OTP bên dưới để hoàn tất việc đăng ký tài khoản của bạn:';
    badgeText = 'ĐĂNG KÝ TÀI KHOẢN';
  } else if (type === 'FORGOT_PASSWORD') {
    subject = 'Mã khôi phục mật khẩu FoodFast';
    title = 'Yêu cầu đặt lại mật khẩu';
    description = 'Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn. Vui lòng nhập mã OTP bên dưới để đặt lại mật khẩu mới:';
    badgeText = 'KHÔI PHỤC MẬT KHẨU';
  } else {
    subject = 'Mã xác thực FoodFast';
    title = 'Xác thực bảo mật';
    description = 'Mã xác thực dùng cho thao tác của bạn trên FoodFast:';
    badgeText = 'XÁC THỰC BẢO MẬT';
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; color: #1f2937; }
        .container { max-width: 540px; margin: 30px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6; }
        .header { background: linear-gradient(135deg, #ea580c, #f59e0b); padding: 32px 24px; text-align: center; color: #ffffff; }
        .logo { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
        .badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 8px; }
        .content { padding: 36px 30px; text-align: center; }
        .title { font-size: 20px; font-weight: 800; color: #111827; margin-top: 0; margin-bottom: 12px; }
        .description { font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 28px; }
        .otp-box { background: #fff7ed; border: 2px dashed #fb923c; border-radius: 16px; padding: 18px 24px; display: inline-block; margin-bottom: 24px; }
        .otp-code { font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #ea580c; font-family: 'Courier New', Courier, monospace; margin: 0; }
        .warning { font-size: 12px; color: #dc2626; font-weight: 600; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; padding: 10px 14px; margin-bottom: 20px; display: inline-block; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">🍔 FoodFast Delivery</h1>
          <span class="badge">${badgeText}</span>
        </div>
        <div class="content">
          <h2 class="title">${title}</h2>
          <p class="description">${description}</p>
          <div class="otp-box">
            <p class="otp-code">${otp}</p>
          </div>
          <br>
          <div class="warning">
            ⚠️ Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai!
          </div>
          <p style="font-size: 12px; color: #6b7280; margin: 0;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
        </div>
        <div class="footer">
          <p style="margin: 0;">FoodFast Cloud Delivery • Hệ thống đặt món trực tuyến an toàn</p>
          <p style="margin: 4px 0 0 0;">Email gửi tự động từ dịch vụ Auth Service.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"FoodFast Delivery" <${EMAIL_USER}>`,
    to: email,
    subject,
    html: htmlContent
  };

  // 1. Ưu tiên gửi qua Google Apps Script Webhook (Chạy HTTPS cổng 443, Render không bao giờ chặn)
  if (GOOGLE_SCRIPT_WEBHOOK_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: GOOGLE_SCRIPT_SECRET,
          email: email.trim(),
          subject: subject,
          html: htmlContent,
          otp: otp,
          type: type
        }),
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json().catch(() => ({ success: true }));
        if (result && result.success !== false) {
          console.log(`[Mailer] 📧 [Google Webhook HTTPS] Đã gửi mã OTP [${otp}] tới [${email}] (Loại: ${type})`);
          return { success: true, via: 'google_apps_script' };
        }
      }
    } catch (webhookErr) {
      console.warn(`[Mailer] ⚠️ Gửi qua Google Apps Script Webhook thất bại, chuyển sang SMTP dự phòng:`, webhookErr.message);
    }
  }

  // 2. Dự phòng: Gửi qua Nodemailer SMTP nếu Webhook gặp sự cố
  try {
    const info = await Promise.race([
      transporter.sendMail(mailOptions),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP_TIMEOUT: Cloud firewall blocked outbound SMTP connection')), 4500)
      )
    ]);
    console.log(`[Mailer] 📧 [SMTP 465] Đã gửi mã OTP [${otp}] tới [${email}] (Loại: ${type}) - MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId, via: 'smtp' };
  } catch (err) {
    console.warn(`[Mailer] ⚠️ Không thể kết nối SMTP để gửi email tới [${email}]: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  transporter,
  generateOTP,
  sendOTPEmail
};

