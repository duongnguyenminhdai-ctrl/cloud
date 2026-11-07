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

// Schema Nhà hàng (Restaurant / Store)
const restaurantSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Tên nhà hàng không được để trống'],
      trim: true
    },
    status: {
      type: String,
      enum: ['NOT_REGISTERED', 'PENDING', 'ACTIVE', 'REJECTED'],
      default: 'PENDING'
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
    completed_orders: {
      type: Number,
      default: 25,
      min: 0
    },
    review_count: {
      type: Number,
      default: 5,
      min: 0
    },
    // Vị trí địa lý và thời gian chuẩn bị món (OSRM Routing)
    latitude: {
      type: Number,
      default: 10.7769
    },
    longitude: {
      type: Number,
      default: 106.7009
    },
    prep_time: {
      type: Number,
      default: 15
    },
    image: {
      type: String,
      default: ''
    },
    coverImage: {
      type: String,
      default: ''
    },
    menuItems: [menuItemSchema],

    // 1. Phân vùng địa lý & Tỉnh/Thành phố (Chuẩn 63 tỉnh thành)
    city_code: {
      type: String,
      default: 'hcm',
      index: true,
      lowercase: true,
      trim: true
    },
    city_name: {
      type: String,
      default: 'TP. Hồ Chí Minh',
      trim: true
    },
    address_detail: {
      type: String,
      default: '',
      trim: true
    },

    // Thông tin quán cơ bản
    brandName: { type: String, default: '' },
    specialtyDish: { type: String, default: '' },
    areaStreet: { type: String, default: '' },
    city: { type: String, default: 'TP. Hồ Chí Minh' },
    district: { type: String, default: '' },
    ward: { type: String, default: '' },
    streetAddress: { type: String, default: '' },

    // 2. Thông tin người đại diện
    merchantType: {
      type: String,
      enum: ['INDIVIDUAL', 'HOUSEHOLD', 'ENTERPRISE'],
      default: 'INDIVIDUAL'
    },
    representativeName: { type: String, default: '' },
    repEmail: { type: String, default: '' },
    repPhone: { type: String, default: '' },
    repAltPhone: { type: String, default: '' },
    citizenId: { type: String, default: '' },
    citizenIdDate: { type: String, default: '' },
    citizenIdPlace: { type: String, default: '' },
    citizenIdFront: { type: String, default: '' },
    citizenIdBack: { type: String, default: '' },
    businessLicenseImage: { type: String, default: '' },
    taxCode: { type: String, default: '' },
    taxImage: { type: String, default: '' },
    relatedDocuments: { type: [String], default: [] },

    // 3. Thông tin ngân hàng
    bankName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    bankAccountHolder: { type: String, default: '' },
    bankBranch: { type: String, default: '' },

    // 4. Thông tin chi tiết quán
    operatingHours: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        mon: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
        tue: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
        wed: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
        thu: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
        fri: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
        sat: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
        sun: { isOpen: true, openTime: '08:00', closeTime: '22:00' }
      })
    },
    serviceTypes: { type: [String], default: [] },
    cuisineTypes: { type: [String], default: [] },
    featuredDishes: { type: [String], default: [] },
    parkingFee: { type: String, default: 'Miễn phí' },
    menuImages: { type: [String], default: [] },

    // 5. Gói tăng trưởng
    growthPackage: {
      type: String,
      enum: ['FREE', 'GROWTH_1', 'GROWTH_3'],
      default: 'FREE'
    },
    packagePrice: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['FREE', 'UNPAID', 'PAID'],
      default: 'FREE'
    },

    // 6. Quản trị viên xét duyệt
    rejectedReason: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Restaurant', restaurantSchema);
