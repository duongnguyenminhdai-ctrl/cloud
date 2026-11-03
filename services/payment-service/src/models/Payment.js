const mongoose = require('mongoose');

// Schema Thanh toán (Payment)
const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: [true, 'orderId không được để trống'],
      index: true
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền thanh toán (amount) không được để trống'],
      min: [0, 'Số tiền phải lớn hơn hoặc bằng 0']
    },
    status: {
      type: String,
      default: 'SUCCESS'
    },
    paymentMethod: {
      type: String,
      default: 'VNPAY'
    },
    transactionId: {
      type: String,
      default: () => 'TXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
    },
    vnpayData: {
      type: Object,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Payment', paymentSchema);
