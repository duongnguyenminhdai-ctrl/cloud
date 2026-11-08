const mongoose = require('mongoose');

// Schema Giao hàng (Delivery) theo mô hình Evolutionary Architecture
const deliverySchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'order_id không được để trống'],
      index: true
    },
    // Đồng bộ trường orderId (String) để hỗ trợ truy vấn tương thích ngược
    orderId: {
      type: String,
      index: true
    },
    driver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    driver_name: {
      type: String,
      default: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
      trim: true
    },
    driver_phone: {
      type: String,
      default: '0908 123 456',
      trim: true
    },
    driver_vehicle: {
      type: String,
      default: 'Honda Wave Alpha • 59-X1 888.88',
      trim: true
    },
    // driverInfo để tương thích giao diện frontend & unit tests hiện hữu
    driverInfo: {
      name: { type: String, default: 'Trần Văn Vận Chuyển (Đối tác Cloud)' },
      vehicle: { type: String, default: 'Honda Wave Alpha • 59-X1 888.88' },
      phone: { type: String, default: '0908 123 456' }
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'FINDING_DRIVER',
        'DRIVER_ASSIGNED',
        'PICKED_UP',
        'DELIVERING',
        'COMPLETED',
        'DELIVERED', // Tương đương COMPLETED để tương thích hoàn toàn dữ liệu cũ
        'CANCELLED'
      ],
      default: 'PENDING'
    },
    pickup_address: {
      address: { type: String, default: 'Nhà hàng FoodFast Đối tác' },
      lat: { type: Number, default: 10.7769 },
      lng: { type: Number, default: 106.7009 }
    },
    dropoff_address: {
      address: { type: String, default: 'Địa chỉ giao hàng' },
      lat: { type: Number, default: 10.7769 },
      lng: { type: Number, default: 106.7009 }
    },
    current_location: {
      lat: { type: Number, default: 10.7769 },
      lng: { type: Number, default: 106.7009 }
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual properties chuẩn hóa
deliverySchema.virtual('id').get(function () {
  return this._id ? this._id.toString() : null;
});

deliverySchema.virtual('driverName').get(function () {
  return this.driver_name;
}).set(function (val) {
  this.driver_name = val;
});

deliverySchema.virtual('createdAt').get(function () {
  return this.created_at;
});

deliverySchema.virtual('updatedAt').get(function () {
  return this.updated_at;
});

// Middleware tự động đồng bộ giữa order_id & orderId, driverInfo & driver_name/phone/vehicle
deliverySchema.pre('validate', function (next) {
  if (this.orderId && !this.order_id) {
    this.order_id = this.orderId;
  } else if (this.order_id && !this.orderId) {
    this.orderId = this.order_id.toString();
  }

  // Tự động đồng bộ driver_name / vehicle / phone sang driverInfo
  if (this.driver_name) {
    this.driverInfo = {
      name: this.driver_name,
      vehicle: this.driver_vehicle || 'Honda Wave Alpha • 59-X1 888.88',
      phone: this.driver_phone || '0908 123 456'
    };
  }

  next();
});

module.exports = mongoose.model('Delivery', deliverySchema);
