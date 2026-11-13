const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên người dùng'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email không đúng định dạng']
    },
    password: {
      type: String,
      required: function () {
        // Chỉ bắt buộc mật khẩu nếu không phải tài khoản đăng nhập qua Google OAuth
        return !this.googleId;
      },
      minlength: [6, 'Mật khẩu phải có tối thiểu 6 ký tự'],
      select: true
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true // Cho phép null/undefined đối với tài khoản email thường
    },
    avatar: {
      type: String,
      default: ''
    },
    authProvider: {
      type: String,
      enum: ['LOCAL', 'GOOGLE'],
      default: 'LOCAL'
    },
    phone: {
      type: String,
      default: '',
      trim: true
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    phoneVerifiedAt: {
      type: Date,
      default: null
    },
    firebasePhoneUid: {
      type: String,
      default: null
    },
    birthYear: {
      type: Number,
      default: null
    },
    address: {
      type: String,
      default: '',
      trim: true
    },
    role: {
      type: String,
      enum: {
        values: ['USER', 'ADMIN', 'CUSTOMER'],
        message: 'Role phải là USER hoặc ADMIN'
      },
      default: 'USER'
    },
    has_store: {
      type: Boolean,
      default: false
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    coins: {
      type: Number,
      default: 0,
      min: [0, 'Số xu không được âm']
    }
  },
  {
    timestamps: true
  }
);

// Tự động mã hóa mật khẩu trước khi lưu vào MongoDB Atlas (nếu có mật khẩu và có sửa đổi)
userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// So khớp mật khẩu nhập vào với hash trong database
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
