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
    status: {
      type: String,
      default: 'FINDING_DRIVER'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Delivery', deliverySchema);
