const mongoose = require('mongoose');

// Schema Đơn hàng (Order)
const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: [true, 'customerId không được để trống'],
      trim: true
    },
    restaurantId: {
      type: String,
      default: null
    },
    items: {
      type: Array,
      required: [true, 'items không được để trống'],
      default: []
    },
    totalPrice: {
      type: Number,
      required: [true, 'totalPrice không được để trống'],
      min: [0, 'Tổng tiền phải lớn hơn hoặc bằng 0']
    },
    status: {
      type: String,
      default: 'PENDING'
    },
    driver_info: {
      name: { type: String, default: null },
      vehicle: { type: String, default: null },
      phone: { type: String, default: null }
    },
    paymentMethod: {
      type: String,
      default: 'VNPAY'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Order', orderSchema);
