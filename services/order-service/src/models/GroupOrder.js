const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: null
    },
    displayName: {
      type: String,
      required: [true, 'displayName không được để trống'],
      trim: true
    },
    avatar: {
      type: String,
      default: null
    },
    isHost: {
      type: Boolean,
      default: false
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const groupItemSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      required: [true, 'memberId không được để trống']
    },
    memberName: {
      type: String,
      required: [true, 'memberName không được để trống']
    },
    menuItemId: {
      type: String,
      required: [true, 'menuItemId không được để trống']
    },
    name: {
      type: String,
      required: [true, 'name không được để trống']
    },
    price: {
      type: Number,
      required: [true, 'price không được để trống'],
      min: [0, 'Giá không được âm']
    },
    quantity: {
      type: Number,
      required: [true, 'quantity không được để trống'],
      min: [1, 'Số lượng tối thiểu là 1'],
      default: 1
    },
    options: {
      type: Array,
      default: []
    },
    note: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    }
  },
  { _id: true, timestamps: true }
);

const groupOrderSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: [true, 'roomCode không được để trống'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    hostId: {
      type: String,
      required: [true, 'hostId không được để trống'],
      index: true
    },
    hostName: {
      type: String,
      required: [true, 'hostName không được để trống']
    },
    restaurantId: {
      type: String,
      required: [true, 'restaurantId không được để trống'],
      index: true
    },
    restaurantName: {
      type: String,
      default: ''
    },
    restaurantImage: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['OPEN', 'LOCKED', 'ORDERED', 'CANCELLED'],
      default: 'OPEN',
      index: true
    },
    members: {
      type: [memberSchema],
      default: []
    },
    items: {
      type: [groupItemSchema],
      default: []
    },
    shippingFee: {
      type: Number,
      default: 16000
    },
    deliveryAddress: {
      type: String,
      default: ''
    },
    note: {
      type: String,
      default: ''
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    }
  },
  { timestamps: true }
);

// TTL index: tự động dọn dẹp các phòng nhóm cũ sau 24 giờ
groupOrderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('GroupOrder', groupOrderSchema);
