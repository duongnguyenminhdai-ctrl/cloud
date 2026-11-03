const mongoose = require('mongoose');

// Schema từng món ăn trong thực đơn (menuItems)
const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên món ăn không được để trống'],
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Giá món ăn không được để trống'],
      min: [0, 'Giá món ăn phải lớn hơn hoặc bằng 0']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    image: {
      type: String,
      default: ''
    },
    isAvailable: {
      type: Boolean,
      default: true
    }
  },
  { _id: true }
);

// Schema Nhà hàng (Restaurant)
const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên nhà hàng không được để trống'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Địa chỉ nhà hàng không được để trống'],
      trim: true
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 1.0,
      max: 5.0
    },
    image: {
      type: String,
      default: ''
    },
    menuItems: [menuItemSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Restaurant', restaurantSchema);
