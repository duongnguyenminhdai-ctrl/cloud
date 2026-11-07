const mongoose = require('mongoose');

// Schema Giao hàng (Delivery)
const deliverySchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: [true, 'orderId không được để trống'],
      index: true
    },
    driverName: {
      type: String,
      default: null,
      trim: true
    },
    driverInfo: {
      name: { type: String, default: null },
      vehicle: { type: String, default: null },
      phone: { type: String, default: null }
    },
    status: {
      type: String,
      enum: ['FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING', 'DELIVERED', 'CANCELLED'],
      default: 'FINDING_DRIVER'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Delivery', deliverySchema);
