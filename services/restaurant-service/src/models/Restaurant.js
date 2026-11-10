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
    },
    categoryId: {
      type: String,
      default: ''
    },
    sellingHours: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        isAllDay: true,
        customDays: [],
        shifts: []
      })
    },
    linkedToppingGroupIds: {
      type: [String],
      default: []
    },
    // Cấu hình Kích cỡ, Tùy chọn đi kèm & Topping do chính người bán (Merchant/Shop) thiết lập
    customization: {
      hasCustomization: {
        type: Boolean,
        default: false
      },
      // Kích cỡ do quán quy định (Nếu quán chỉ có 1 size thì mảng này để trống hoặc có 1 phần tử)
      sizes: [
        {
          id: { type: String, default: '' },
          name: { type: String, required: true },
          price: { type: Number, default: 0 },
          isDefault: { type: Boolean, default: false }
        }
      ],
      // Các nhóm tùy chọn đi kèm (vd: Kích cỡ, Nước sốt, Mức đá, Mức đường, Độ cay, Topping...) do quán thiết lập
      optionGroups: [
        {
          id: { type: String, default: '' },
          name: { type: String, required: true },
          layout: {
            type: String,
            enum: ['VERTICAL', 'HORIZONTAL'],
            default: 'VERTICAL'
          },
          required: { type: Boolean, default: false },
          multiple: { type: Boolean, default: false },
          options: [{ type: String }],
          choices: [
            {
              id: { type: String, default: '' },
              name: { type: String, required: true },
              price: { type: Number, default: 0 },
              isDefault: { type: Boolean, default: false }
            }
          ],
          defaultOption: { type: String, default: '' }
        }
      ],
      // Các món/topping thêm do quán thiết lập kèm giá
      toppings: [
        {
          id: { type: String, default: '' },
          name: { type: String, required: true },
          price: { type: Number, required: true, default: 0 }
        }
      ],
      allowNotes: {
        type: Boolean,
        default: true
      },
      notePlaceholder: {
        type: String,
        default: 'Ghi chú cho quán (không hành, ít cay...)'
      }
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
      enum: ['NOT_REGISTERED', 'PENDING', 'ACTIVE', 'REJECTED', 'BANNED', 'LOCKED'],
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

    // 2. Thông tin người đại diện & Pháp lý
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
    // Hộ kinh doanh cá thể
    householdName: { type: String, default: '' },
    householdBusinessLicense: { type: String, default: '' }, // Giấy đăng ký Hộ kinh doanh cá thể (bản gốc)
    // Doanh nghiệp
    companyName: { type: String, default: '' },
    companyBusinessLicense: { type: String, default: '' }, // Giấy phép đăng ký kinh doanh công ty / chi nhánh
    powerOfAttorney: { type: String, default: '' }, // Giấy ủy quyền (nếu người ký không phải đại diện pháp luật)
    isLegalRepresentative: { type: Boolean, default: true },
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
    reviewedBy: { type: String, default: '' },

    // -------------------------------------------------------------------------
    // CÁC TRƯỜNG PHỤC VỤ VẬN HÀNH CHUẨN ĐỐI TÁC CHỦ QUÁN (FOODFAST PARTNER SPEC)
    // -------------------------------------------------------------------------
    // 7. Trạng thái hoạt động thời gian thực (Module 3)
    operatingStatus: {
      isOpen: { type: Boolean, default: true },
      isBusy: { type: Boolean, default: false },
      busyReason: { type: String, default: '' },
      busyUntil: { type: Date, default: null }
    },

    // 8. Lịch đóng/mở cửa thường ngày chi tiết (Module 3)
    weeklySchedule: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        mon: { isOpen: true, is24h: false, shifts: [{ open: '08:00', close: '22:00' }] },
        tue: { isOpen: true, is24h: false, shifts: [{ open: '08:00', close: '22:00' }] },
        wed: { isOpen: true, is24h: false, shifts: [{ open: '08:00', close: '22:00' }] },
        thu: { isOpen: true, is24h: false, shifts: [{ open: '08:00', close: '22:00' }] },
        fri: { isOpen: true, is24h: false, shifts: [{ open: '08:00', close: '22:00' }] },
        sat: { isOpen: true, is24h: true, shifts: [] },
        sun: { isOpen: true, is24h: true, shifts: [] }
      })
    },

    // 9. Lịch đóng/mở dịp đặc biệt (Ngày lễ, Tết, sự kiện)
    specialSchedules: [
      {
        date: { type: String, default: '' },
        status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'CLOSED' },
        is24h: { type: Boolean, default: false },
        shifts: [{ open: { type: String }, close: { type: String } }]
      }
    ],

    // 10. Danh mục món ăn & Thứ tự hiển thị (Module 2)
    categories: [
      {
        id: { type: String, default: '' },
        name: { type: String, required: true },
        order: { type: Number, default: 0 }
      }
    ],

    // 11. Thư viện Nhóm Topping & Tùy chọn độc lập của Quán (Module 2)
    toppingGroups: [
      {
        id: { type: String, default: '' },
        name: { type: String, required: true },
        isRequired: { type: Boolean, default: false },
        minChoices: { type: Number, default: 0 },
        maxChoices: { type: Number, default: 1 },
        layout: { type: String, enum: ['VERTICAL', 'HORIZONTAL'], default: 'VERTICAL' },
        toppings: [
          {
            id: { type: String, default: '' },
            name: { type: String, required: true },
            extraPrice: { type: Number, default: 0 },
            isAvailable: { type: Boolean, default: true }
          }
        ]
      }
    ],

    // 12. Quản lý Nhân viên của Quán (Module 4)
    staff: [
      {
        id: { type: String, default: '' },
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, default: '' },
        role: { type: String, enum: ['MANAGER', 'STAFF'], default: 'STAFF' },
        scope: { type: String, enum: ['ALL', 'SPECIFIC'], default: 'SPECIFIC' },
        status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
        createdAt: { type: Date, default: Date.now }
      }
    ],

    // 13. Ví đối tác & Quản lý Tài chính (Module 5)
    wallet: {
      availableBalance: { type: Number, default: 1368922 },
      pendingBalance: { type: Number, default: 327850 },
      walletPinHash: { type: String, default: '' },
      failedPinAttempts: { type: Number, default: 0 },
      pinLockedUntil: { type: Date, default: null },
      bankAccount: {
        bankName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        accountHolder: { type: String, default: '' },
        branch: { type: String, default: '' }
      }
    },

    // 14. Lịch sử Rút tiền thủ công (Module 5)
    payouts: [
      {
        id: { type: String, default: '' },
        code: { type: String, default: '' },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['PENDING', 'SUCCESS', 'REJECTED'], default: 'PENDING' },
        bankInfo: { type: mongoose.Schema.Types.Mixed },
        requestedAt: { type: Date, default: Date.now },
        completedAt: { type: Date, default: null }
      }
    ],

    // 15. Quán yêu thích (FoodFast Wishlist / Like system)
    likes: {
      type: [String],
      default: []
    },
    likeCount: {
      type: Number,
      default: 0
    },

    // 16. Thông tin kỷ luật & Khóa quán từ Quản trị viên (Ban & Lock Management)
    banInfo: {
      isBanned: { type: Boolean, default: false },
      bannedAt: { type: Date, default: null },
      banUntil: { type: Date, default: null },
      banDurationDays: { type: Number, default: 0 },
      banReason: { type: String, default: '' },
      bannedBy: { type: String, default: 'Admin' },
      unbannedAt: { type: Date, default: null }
    },

    // 17. Thông báo và Cảnh báo gửi tới Chủ quán từ Admin
    notifications: [
      {
        id: { type: String, default: '' },
        type: { type: String, enum: ['WARNING', 'BAN', 'UNBAN', 'SYSTEM', 'INFO'], default: 'INFO' },
        title: { type: String, required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        isRead: { type: Boolean, default: false },
        meta: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Restaurant', restaurantSchema);
