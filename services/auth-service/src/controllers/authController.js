const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { generateOTP, sendOTPEmail } = require('../utils/mailer');
const { checkAndSetRateLimit, saveOTP, getOTP, deleteOTP } = require('../utils/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Hàm sinh JWT Token
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// 1. Gửi mã OTP qua Gmail (POST /api/v1/auth/otp/send)
exports.sendOTP = async (req, res) => {
  try {
    const { email, type = 'REGISTER' } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp địa chỉ email hợp lệ'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const validTypes = ['REGISTER', 'FORGOT_PASSWORD'];
    const otpType = validTypes.includes(type) ? type : 'REGISTER';

    // Nếu đăng ký: kiểm tra email đã tồn tại chưa
    if (otpType === 'REGISTER') {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.'
        });
      }
    }

    // Nếu quên mật khẩu: kiểm tra email có tồn tại không
    if (otpType === 'FORGOT_PASSWORD') {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'Email này chưa được đăng ký tài khoản trong hệ thống.'
        });
      }
    }

    // Kiểm tra Rate limit trong Redis (Tối đa 1 lần / 60 giây)
    const rateCheck = await checkAndSetRateLimit(otpType, cleanEmail, 60);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Vui lòng chờ ${rateCheck.remaining} giây trước khi yêu cầu gửi lại mã OTP.`,
        remaining: rateCheck.remaining
      });
    }

    // Sinh OTP 6 chữ số ngẫu nhiên
    const otp = generateOTP();

    // Lưu vào Redis với TTL = 300 giây (5 phút)
    await saveOTP(otpType, cleanEmail, otp, 300);

    // Gửi email qua Nodemailer Gmail
    await sendOTPEmail(cleanEmail, otp, otpType);

    return res.status(200).json({
      success: true,
      message: `Mã OTP đã được gửi thành công tới ${cleanEmail}. Mã có hiệu lực trong 5 phút.`,
      email: cleanEmail,
      type: otpType
    });
  } catch (error) {
    console.error('[authController] ❌ Lỗi gửi mã OTP:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể gửi email OTP lúc này: ' + error.message
    });
  }
};

// 2. Xác thực mã OTP (POST /api/v1/auth/otp/verify)
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp, type = 'REGISTER' } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email và mã OTP 6 số'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const storedOTP = await getOTP(type, cleanEmail);

    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng bấm gửi lại mã mới.'
      });
    }

    if (storedOTP !== otp.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Xác thực mã OTP thành công!'
    });
  } catch (error) {
    console.error('[authController] ❌ Lỗi xác thực OTP:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác thực OTP: ' + error.message
    });
  }
};

// 3. Đăng ký tài khoản mới kèm xác thực OTP (POST /api/v1/auth/register)
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, otp } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ: name, email, password'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mã OTP 6 số đã được gửi tới email của bạn.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Kiểm tra OTP trong Redis
    const storedOTP = await getOTP('REGISTER', cleanEmail);
    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn hoặc chưa được gửi. Vui lòng nhấn gửi mã OTP.'
      });
    }

    if (storedOTP !== otp.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không chính xác. Vui lòng kiểm tra lại hòm thư.'
      });
    }

    // Kiểm tra trùng email trong MongoDB
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email này đã được sử dụng. Vui lòng chọn email khác.'
      });
    }

    // Tạo người dùng mới
    const userRole = role && ['CUSTOMER', 'RESTAURANT_OWNER', 'USER', 'ADMIN'].includes(role) ? role : 'USER';
    const newUser = await User.create({
      name,
      email: cleanEmail,
      password,
      role: userRole
    });

    // Xóa OTP sau khi đăng ký thành công
    await deleteOTP('REGISTER', cleanEmail);

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        has_store: newUser.has_store || false,
        store_id: newUser.store_id || null
      }
    });
  } catch (error) {
    console.error('[authController] ❌ Lỗi đăng ký:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng ký tài khoản: ' + error.message
    });
  }
};

// 4. Đặt lại mật khẩu (POST /api/v1/auth/reset-password)
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email, mã OTP và mật khẩu mới'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có tối thiểu 6 ký tự'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Kiểm tra OTP trong Redis
    const storedOTP = await getOTP('FORGOT_PASSWORD', cleanEmail);
    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn hoặc chưa được gửi. Vui lòng gửi lại mã OTP.'
      });
    }

    if (storedOTP !== otp.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.'
      });
    }

    // Tìm kiếm user
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản với email này.'
      });
    }

    // Cập nhật mật khẩu mới (hook pre-save tự động hash bcrypt)
    user.password = newPassword;
    await user.save();

    // Xóa OTP sau khi đổi mật khẩu thành công
    await deleteOTP('FORGOT_PASSWORD', cleanEmail);

    console.log(`[authController] 🔑 Đã đổi mật khẩu thành công cho tài khoản [${cleanEmail}]`);

    return res.status(200).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.'
    });
  } catch (error) {
    console.error('[authController] ❌ Lỗi đặt lại mật khẩu:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đặt lại mật khẩu: ' + error.message
    });
  }
};

// 5. Đăng nhập và nhận JWT Token (POST /api/v1/auth/login)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email và mật khẩu'
      });
    }

    // Tìm kiếm người dùng theo email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác'
      });
    }

    // Kiểm tra tài khoản có bị khóa không
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.'
      });
    }

    // Kiểm tra mật khẩu mã hóa bcrypt
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác'
      });
    }

    // Sinh JWT Token chứa thông tin userId và role
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || '',
        has_store: user.has_store || false,
        store_id: user.store_id || null,
        phone: user.phone || '',
        birthYear: user.birthYear || null,
        address: user.address || ''
      }
    });
  } catch (error) {
    console.error('[authController] ❌ Lỗi đăng nhập:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng nhập: ' + error.message
    });
  }
};

// 6. Xác thực và kiểm tra tính hợp lệ của Token (GET /api/v1/auth/verify)
exports.verify = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng trong token không tồn tại'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Token hợp lệ',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || '',
        has_store: user.has_store || false,
        store_id: user.store_id || null,
        phone: user.phone || '',
        birthYear: user.birthYear || null,
        address: user.address || ''
      }
    });
  } catch (error) {
    console.error('[authController] ❌ Lỗi kiểm tra token:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác thực token: ' + error.message
    });
  }
};

// =============================================================================
// GOOGLE OAUTH 2.0 AUTHENTICATION
// =============================================================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '706124961536-m0cegjnn45imfdo5ejpcseaafkdnjg8m.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/api/v1/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

// 7. Chuyển hướng người dùng tới Google OAuth 2.0 (GET /api/v1/auth/google)
exports.googleAuthRedirect = async (req, res) => {
  try {
    const state = req.query.from || '/';
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state: state
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.redirect(googleAuthUrl);
  } catch (error) {
    console.error('[authController] ❌ Lỗi tạo URL Google OAuth:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khởi tạo đăng nhập Google: ' + error.message
    });
  }
};

// 8. Tiếp nhận Callback từ Google OAuth 2.0 (GET /api/v1/auth/google/callback)
exports.googleAuthCallback = async (req, res) => {
  try {
    const { code, error, state } = req.query;

    if (error) {
      console.error('[authController] ❌ Google OAuth trả về lỗi:', error);
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Đăng nhập Google bị hủy hoặc thất bại.')}`);
    }

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Không nhận được authorization code từ Google.')}`);
    }

    if (!GOOGLE_CLIENT_SECRET) {
      console.warn('[authController] ⚠️ GOOGLE_CLIENT_SECRET chưa được cung cấp!');
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Chưa cấu hình GOOGLE_CLIENT_SECRET trên server. Vui lòng cung cấp Client Secret để hoàn tất.')}`);
    }

    // 8.1 Gửi yêu cầu đổi code lấy token từ Google OAuth Token Endpoint
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[authController] ❌ Lỗi trao đổi token với Google:', tokenData);
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(tokenData.error_description || 'Không thể xác thực mã ủy quyền với Google')}`);
    }

    // 8.2 Lấy thông tin cá nhân của người dùng từ Google
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const googleUser = await userinfoResponse.json();

    if (!googleUser || !googleUser.email) {
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Không thể đọc thông tin tài khoản Google.')}`);
    }

    const { sub: googleId, email, name, picture } = googleUser;
    const cleanEmail = email.toLowerCase().trim();

    // 8.3 Kiểm tra xem người dùng đã có trong auth_db chưa
    let user = await User.findOne({ $or: [{ googleId }, { email: cleanEmail }] });

    if (user) {
      let modified = false;
      if (!user.googleId) {
        user.googleId = googleId;
        modified = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        modified = true;
      }
      if (user.authProvider !== 'GOOGLE') {
        user.authProvider = 'GOOGLE';
        modified = true;
      }
      if (modified) {
        await user.save();
      }
      console.log(`[authController] 🔑 Đăng nhập tài khoản Google có sẵn: ${cleanEmail}`);
    } else {
      user = await User.create({
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        googleId,
        avatar: picture || '',
        authProvider: 'GOOGLE',
        role: 'CUSTOMER'
      });
      console.log(`[authController] 🆕 Đã tạo tài khoản mới từ Google: ${cleanEmail}`);
    }

    // 8.4 Sinh JWT Token nội bộ
    const token = generateToken(user);

    // 8.5 Chuyển hướng người dùng về trang Frontend kèm thông tin đăng nhập
    const targetUrl = new URL(`${FRONTEND_URL}/login`);
    targetUrl.searchParams.set('token', token);
    targetUrl.searchParams.set('name', user.name);
    targetUrl.searchParams.set('email', user.email);
    targetUrl.searchParams.set('role', user.role);
    targetUrl.searchParams.set('authSuccess', 'true');

    return res.redirect(targetUrl.toString());
  } catch (error) {
    console.error('[authController] ❌ Lỗi callback Google OAuth:', error.message);
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Lỗi hệ thống khi đăng nhập Google: ' + error.message)}`);
  }
};

// 9. Xác thực qua Google Credential ID Token (Google Identity Services GIS - POST /api/v1/auth/google/credential)
exports.googleCredentialLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã Google Credential Token'
      });
    }

    // Xác thực ID Token trực tiếp với Google Tokeninfo Endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const payload = await verifyRes.json();

    if (!verifyRes.ok || payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(400).json({
        success: false,
        message: 'Google Credential Token không hợp lệ hoặc không khớp Client ID'
      });
    }

    const { sub: googleId, email, name, picture } = payload;
    const cleanEmail = email.toLowerCase().trim();

    let user = await User.findOne({ $or: [{ googleId }, { email: cleanEmail }] });
    if (user) {
      let modified = false;
      if (!user.googleId) {
        user.googleId = googleId;
        modified = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    } else {
      user = await User.create({
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        googleId,
        avatar: picture || '',
        authProvider: 'GOOGLE',
        role: 'CUSTOMER'
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập Google thành công!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || ''
      }
    });
  } catch (error) {
    console.error('[authController] ❌ Lỗi googleCredentialLogin:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác thực Google Credential: ' + error.message
    });
  }
};

// =============================================================================
// QUẢN TRỊ VIÊN (ADMIN DASHBOARD CONTROLLERS)
// =============================================================================

// Khởi tạo Admin mặc định nếu chưa tồn tại
exports.seedAdminDefault = async () => {
  try {
    const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@foodfast.vn';
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123456';
    const existingAdmin = await User.findOne({ role: 'ADMIN' });
    if (!existingAdmin) {
      await User.create({
        name: 'Quản Trị Viên Hệ Thống',
        email: adminEmail,
        password: adminPassword,
        role: 'ADMIN',
        authProvider: 'LOCAL'
      });
      console.log(`[authService] 🛡️ Đã tạo tài khoản Admin mặc định: ${adminEmail} | ${adminPassword}`);
    }
  } catch (err) {
    console.warn('[authService] ⚠️ Khởi tạo admin:', err.message);
  }
};

// Đăng nhập dành riêng cho Quản trị viên (POST /api/v1/auth/admin/login)
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và mật khẩu' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc không có đặc quyền Quản trị viên (ADMIN).'
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Tài khoản quản trị đã bị vô hiệu hóa.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Mật khẩu quản trị viên không chính xác.' });
    }

    const token = generateToken(user);
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập Quản trị viên thành công!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        birthYear: user.birthYear || null,
        address: user.address || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi đăng nhập admin: ' + error.message });
  }
};

// Quản lý danh sách tài khoản: phân trang, tìm kiếm, lọc, sắp xếp (GET /api/v1/auth/admin/users)
exports.adminGetUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const { search, role, has_store, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (role && role !== 'ALL') {
      query.role = role;
    }
    if (has_store !== undefined && has_store !== '') {
      query.has_store = has_store === 'true';
    }
    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true';
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort(sort).skip(skip).limit(limit),
      User.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách tài khoản: ' + error.message });
  }
};

// Admin cập nhật tài khoản (PUT /api/v1/auth/admin/users/:id)
exports.adminUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, phone, isActive, has_store } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (name) user.name = name;
    if (role && ['USER', 'ADMIN', 'CUSTOMER'].includes(role)) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    if (has_store !== undefined) user.has_store = has_store;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật tài khoản thành công',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        has_store: user.has_store
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật người dùng: ' + error.message });
  }
};

// Admin xóa tài khoản (DELETE /api/v1/auth/admin/users/:id)
exports.adminDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user && req.user.userId === id) {
      return res.status(400).json({ success: false, message: 'Không thể tự xóa tài khoản quản trị đang đăng nhập.' });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản cần xóa.' });
    }

    return res.status(200).json({
      success: true,
      message: `Đã xóa tài khoản [${user.email}] thành công.`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa tài khoản: ' + error.message });
  }
};

// Admin tạo tài khoản người dùng hoặc admin mới (POST /api/v1/auth/admin/users)
exports.adminCreateUser = async (req, res) => {
  try {
    const { name, email, password, role = 'USER', phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp: name, email, password' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email đã tồn tại trong hệ thống' });
    }
    const user = await User.create({
      name,
      email: cleanEmail,
      password,
      role: ['USER', 'ADMIN', 'CUSTOMER'].includes(role) ? role : 'USER',
      phone: phone || ''
    });
    return res.status(201).json({
      success: true,
      message: 'Tạo tài khoản mới thành công!',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tạo tài khoản: ' + error.message });
  }
};

// Admin đổi mật khẩu tài khoản hiện tại (PUT /api/v1/auth/admin/change-password)
exports.adminChangePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    }

    const user = await User.findById(req.user.userId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản quản trị' });
    }

    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu tài khoản quản trị thành công!'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi đổi mật khẩu: ' + error.message });
  }
};

// =============================================================================
// QUẢN LÝ THÔNG TIN TÀI KHOẢN & ĐỔI MẬT KHẨU (USER PROFILE & SECURITY)
// =============================================================================

// Lấy thông tin tài khoản người dùng hiện tại (GET /api/v1/auth/profile)
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng' });
    }
    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        birthYear: user.birthYear || null,
        address: user.address || '',
        role: user.role,
        avatar: user.avatar || '',
        authProvider: user.authProvider || 'LOCAL',
        has_store: user.has_store || false,
        store_id: user.store_id || null,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy thông tin tài khoản: ' + error.message });
  }
};

// Cập nhật thông tin liên hệ (tên, năm sinh, địa chỉ, sđt) (PUT /api/v1/auth/profile)
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, birthYear, address, avatar } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng' });
    }

    if (name && name.trim()) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (birthYear !== undefined) {
      const parsedYear = Number(birthYear);
      user.birthYear = !isNaN(parsedYear) && parsedYear >= 1920 && parsedYear <= new Date().getFullYear() ? parsedYear : null;
    }
    if (address !== undefined) user.address = address.trim();
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin tài khoản thành công!',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        birthYear: user.birthYear || null,
        address: user.address || '',
        role: user.role,
        avatar: user.avatar || '',
        authProvider: user.authProvider || 'LOCAL',
        has_store: user.has_store || false,
        store_id: user.store_id || null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật tài khoản: ' + error.message });
  }
};

// Đổi mật khẩu tài khoản hiện tại (PUT /api/v1/auth/change-password)
exports.changeUserPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    }

    const user = await User.findById(req.user.userId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng' });
    }

    // Nếu tài khoản Google chưa có mật khẩu
    if (user.authProvider === 'GOOGLE' && !user.password) {
      user.password = newPassword;
      await user.save();
      return res.status(200).json({
        success: true,
        message: 'Đã thiết lập mật khẩu mới cho tài khoản thành công!'
      });
    }

    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công!'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi đổi mật khẩu: ' + error.message });
  }
};
