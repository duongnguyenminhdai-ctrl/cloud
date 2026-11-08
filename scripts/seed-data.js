const mongoose = require('mongoose');
const dns = require('dns');
const path = require('path');
const bcrypt = require('bcryptjs');

// Khắc phục DNS SRV trên môi trường Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

// Nạp biến môi trường từ .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI_AUTH = process.env.MONGO_URI_AUTH;
const MONGO_URI_RESTAURANT = process.env.MONGO_URI_RESTAURANT;

// Schema User cho auth_db
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['CUSTOMER', 'RESTAURANT_OWNER'], default: 'CUSTOMER' }
  },
  { timestamps: true }
);

// Schema MenuItem & Restaurant cho restaurant_db
const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    isAvailable: { type: Boolean, default: true },
    // Cấu hình Kích cỡ, Nước sốt, Topping do quán quy định
    customization: {
      hasCustomization: { type: Boolean, default: false },
      sizes: [{ id: String, name: String, price: Number, isDefault: Boolean }],
      optionGroups: [{ id: String, name: String, required: Boolean, options: [String], defaultOption: String }],
      toppings: [{ id: String, name: String, price: Number }],
      allowNotes: { type: Boolean, default: true },
      notePlaceholder: { type: String, default: '' }
    }
  },
  { _id: true }
);

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, default: '' },
    rating: { type: Number, default: 5.0 },
    image: { type: String, default: '' },
    menuItems: [menuItemSchema]
  },
  { timestamps: true }
);

async function seedData() {
  console.log('\n=============================================================');
  console.log('🌱 BẮT ĐẦU KHỞI TẠO DỮ LIỆU MẪU CHO HỆ THỐNG CLOUD DELIVERY');
  console.log('=============================================================\n');

  // --------------------------------------------------------------------------
  // 1. SEED AUTH_DB (Tài khoản khách hàng & chủ quán)
  // --------------------------------------------------------------------------
  console.log('🔐 [1/2] Đang kết nối tới auth_db trên MongoDB Atlas...');
  const authConn = await mongoose.createConnection(MONGO_URI_AUTH, {
    serverSelectionTimeoutMS: 20000
  }).asPromise();
  const UserModel = authConn.model('User', userSchema, 'users');

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('123456', salt);

  const sampleUsers = [
    {
      name: 'Nguyễn Văn Khách',
      email: 'khachhang@test.com',
      password: hashedPassword,
      role: 'CUSTOMER'
    },
    {
      name: 'Trần Văn Chủ Quán',
      email: 'chuquan@test.com',
      password: hashedPassword,
      role: 'RESTAURANT_OWNER'
    }
  ];

  for (const u of sampleUsers) {
    const existing = await UserModel.findOne({ email: u.email });
    if (!existing) {
      await UserModel.create(u);
      console.log(`   ✅ Đã tạo tài khoản: ${u.email} (Mật khẩu: 123456 | Vai trò: ${u.role})`);
    } else {
      await UserModel.updateOne({ email: u.email }, { password: hashedPassword, role: u.role });
      console.log(`   ℹ️ Đã cập nhật tài khoản sẵn có: ${u.email} (Mật khẩu: 123456)`);
    }
  }

  await authConn.close();
  console.log('   🎉 Hoàn tất seed dữ liệu cho auth_db!\n');

  // --------------------------------------------------------------------------
  // 2. SEED RESTAURANT_DB (3 Quán ăn kèm thực đơn phong phú)
  // --------------------------------------------------------------------------
  console.log('🍔 [2/2] Đang kết nối tới restaurant_db trên MongoDB Atlas...');
  const restaurantConn = await mongoose.createConnection(MONGO_URI_RESTAURANT, {
    serverSelectionTimeoutMS: 20000
  }).asPromise();
  const RestaurantModel = restaurantConn.model('Restaurant', restaurantSchema, 'restaurants');

  const sampleRestaurants = [
    {
      name: 'Cơm Tấm Sài Gòn - Sườn Bì Chả',
      address: '135 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
      phone: '0908123456',
      rating: 4.9,
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      menuItems: [
        {
          name: 'Cơm Tấm Sườn Bì Chả Đặc Biệt',
          price: 65000,
          description: 'Sườn nướng than hoa thơm lừng đậm đà, bì thơm sợi giòn, chả trứng hấp nóng hổi.',
          image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: true,
            sizes: [
              { id: 'std', name: 'Phần Tiêu chuẩn', price: 0, isDefault: true },
              { id: 'extra', name: 'Phần Đặc biệt (Thêm sườn & cơm)', price: 15000 }
            ],
            optionGroups: [],
            toppings: [
              { id: 'top_egg', name: 'Trứng ốp la lòng đào', price: 7000 },
              { id: 'top_cha', name: 'Chả trứng hấp thêm', price: 12000 },
              { id: 'top_bi', name: 'Bì heo thơm trộn thính', price: 10000 }
            ],
            allowNotes: true,
            notePlaceholder: 'Ví dụ: không mỡ hành, ớt để riêng...'
          }
        },
        {
          name: 'Cơm Tấm Đùi Gà Nướng Mật Ong',
          price: 55000,
          description: 'Đùi gà góc tư ướp sốt mật ong rừng nướng vàng ruộm, da giòn thịt mềm mọng nước.',
          image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: true,
            sizes: [
              { id: 'std', name: 'Phần Tiêu chuẩn', price: 0, isDefault: true },
              { id: 'extra', name: 'Phần Thêm Cơm & Canh', price: 10000 }
            ],
            optionGroups: [],
            toppings: [
              { id: 'top_egg', name: 'Trứng ốp la lòng đào', price: 7000 }
            ],
            allowNotes: true,
            notePlaceholder: 'Ví dụ: nhiều mỡ hành, nước mắm ngọt...'
          }
        },
        {
          name: 'Canh Khổ Qua Dồn Thịt Băm',
          price: 25000,
          description: 'Canh giải nhiệt ngọt lành, khổ qua tươi dồn thịt heo băm đậm đà gia vị truyền thống.',
          image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: false,
            sizes: [], // Quán chỉ có 1 size duy nhất, không chọn size
            optionGroups: [],
            toppings: [],
            allowNotes: true,
            notePlaceholder: 'Ví dụ: không hành ngò, nhiều tiêu...'
          }
        },
        {
          name: 'Chả Trứng Hấp Gọi Thêm',
          price: 15000,
          description: 'Miếng chả trứng thịt mộc nhĩ nướng mặt vàng ươm, béo ngậy.',
          image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: false,
            sizes: [],
            optionGroups: [],
            toppings: [],
            allowNotes: true
          }
        },
        {
          name: 'Trà Đá Hoa Lài Thơm Mát',
          price: 5000,
          description: 'Trà lài ướp hoa tươi thanh lọc cơ thể, giải khát sảng khoái.',
          image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: false,
            sizes: [], // Chỉ 1 ly tiêu chuẩn
            optionGroups: [],
            toppings: [],
            allowNotes: true,
            notePlaceholder: 'Ví dụ: nhiều đá, ít đá...'
          }
        }
      ]
    },
    {
      name: 'Trà Sữa Phúc Long & Cà Phê',
      address: '42 Ngô Đức Kế, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      phone: '0909888999',
      rating: 4.8,
      image: 'https://images.unsplash.com/photo-1558857563-b37cf5c8f85f?auto=format&fit=crop&w=800&q=80',
      menuItems: [
        {
          name: 'Trà Sữa Ô Long Phúc Long',
          price: 55000,
          description: 'Hương vị trà Ô Long đậm đà đặc trưng kết hợp cùng sữa tươi béo ngậy chuẩn vị.',
          image: 'https://images.unsplash.com/photo-1558857563-b37cf5c8f85f?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: true,
            optionGroups: [
              {
                id: 'opt_size',
                name: 'Kích cỡ (Size)',
                layout: 'VERTICAL',
                required: true,
                multiple: false,
                choices: [
                  { id: 'M', name: 'Size Vừa (M)', price: 0, isDefault: true },
                  { id: 'L', name: 'Size Lớn (L)', price: 10000, isDefault: false }
                ]
              },
              {
                id: 'opt_sugar',
                name: 'Mức ngọt (Đường)',
                layout: 'HORIZONTAL',
                required: true,
                multiple: false,
                choices: [
                  { id: 'sg_100', name: '100% Đường', price: 0, isDefault: false },
                  { id: 'sg_70', name: '70% Đường (Chuẩn)', price: 0, isDefault: true },
                  { id: 'sg_50', name: '50% Đường', price: 0, isDefault: false },
                  { id: 'sg_30', name: '30% Đường', price: 0, isDefault: false },
                  { id: 'sg_0', name: 'Không đường', price: 0, isDefault: false }
                ]
              },
              {
                id: 'opt_ice',
                name: 'Mức lạnh (Đá)',
                layout: 'HORIZONTAL',
                required: true,
                multiple: false,
                choices: [
                  { id: 'ice_100', name: '100% Đá', price: 0, isDefault: false },
                  { id: 'ice_70', name: '70% Đá (Chuẩn)', price: 0, isDefault: true },
                  { id: 'ice_50', name: '50% Đá', price: 0, isDefault: false },
                  { id: 'ice_less', name: 'Ít đá', price: 0, isDefault: false },
                  { id: 'ice_none', name: 'Không đá', price: 0, isDefault: false }
                ]
              },
              {
                id: 'opt_toppings',
                name: 'Topping gọi thêm',
                layout: 'VERTICAL',
                required: false,
                multiple: true,
                choices: [
                  { id: 'top_boba', name: 'Trân châu đường đen dẻo', price: 8000, isDefault: false },
                  { id: 'top_cheese', name: 'Thạch phô mai tươi', price: 10000, isDefault: false },
                  { id: 'top_pudding', name: 'Pudding trứng béo ngậy', price: 8000, isDefault: false }
                ]
              }
            ],
            allowNotes: true,
            notePlaceholder: 'Ví dụ: lấy thêm ống hút to...'
          }
        },
        {
          name: 'Trà Đào Đá Xay Macchiato',
          price: 60000,
          description: 'Miếng đào giòn ngọt tự nhiên hòa quyện cùng lớp kem Macchiato bồng bềnh béo mịn.',
          image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: true,
            sizes: [
              { id: 'M', name: 'Size Vừa (M)', price: 0, isDefault: true },
              { id: 'L', name: 'Size Lớn (L)', price: 10000 }
            ],
            optionGroups: [
              {
                id: 'sugar',
                name: 'Độ ngọt (Mức đường)',
                required: true,
                options: ['100% Đường', '70% Đường (Chuẩn)', '50% Đường', 'Không đường'],
                defaultOption: '70% Đường (Chuẩn)'
              }
            ],
            toppings: [
              { id: 'top_macchiato', name: 'Thêm lớp kem Macchiato', price: 12000 }
            ],
            allowNotes: true
          }
        },
        {
          name: 'Trà Hoa Hồng Kem Sữa',
          price: 52000,
          description: 'Hương hoa hồng nồng nàn quyến rũ, thanh mát ngọt dịu dễ chịu.',
          image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: true,
            sizes: [
              { id: 'M', name: 'Size Vừa (M)', price: 0, isDefault: true },
              { id: 'L', name: 'Size Lớn (L)', price: 10000 }
            ],
            optionGroups: [],
            toppings: [
              { id: 'top_boba', name: 'Trân châu trắng 3Q', price: 8000 }
            ],
            allowNotes: true
          }
        },
        {
          name: 'Cà Phê Phin Sữa Đá Đậm Đà',
          price: 38000,
          description: 'Hạt cà phê Robusta tuyển chọn từ cao nguyên Buôn Ma Thuột rang xay mộc.',
          image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: false,
            sizes: [], // Quán bán 1 cỡ ly truyền thống
            optionGroups: [],
            toppings: [],
            allowNotes: true,
            notePlaceholder: 'Ví dụ: nhiều sữa, cà phê đậm...'
          }
        },
        {
          name: 'Bánh Croissant Phô Mai Nướng',
          price: 32000,
          description: 'Bánh sừng bò ngàn lớp thơm bơ giòn rụm kẹp phô mai cheddar tan chảy.',
          image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: false,
            sizes: [], // 1 chiếc bánh chuẩn
            optionGroups: [],
            toppings: [],
            allowNotes: true,
            notePlaceholder: 'Ví dụ: làm nóng giòn trước khi giao...'
          }
        }
      ]
    },
    {
      name: 'FastFood Kitchen - Burger & Pizza',
      address: '246 Hai Bà Trưng, Phường Tân Định, Quận 1, TP. Hồ Chí Minh',
      phone: '0912345678',
      rating: 4.7,
      image: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=800&q=80',
      menuItems: [
        {
          name: 'Burger Bò Phô Mai Kép (Double Cheeseburger)',
          price: 79000,
          description: '2 tầng bò Úc nướng lửa hồng, 2 lát phô mai Mỹ béo ngậy kèm sốt burger đặc biệt.',
          image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: true,
            optionGroups: [
              {
                id: 'opt_size',
                name: 'Kích cỡ (Size)',
                layout: 'VERTICAL',
                required: true,
                multiple: false,
                choices: [
                  { id: 'std', name: 'Khẩu phần Tiêu chuẩn', price: 0, isDefault: true },
                  { id: 'double', name: 'Double Size (Gấp đôi nhân)', price: 15000, isDefault: false }
                ]
              },
              {
                id: 'opt_sauce',
                name: 'Nước sốt đi kèm',
                layout: 'VERTICAL',
                required: true,
                multiple: false,
                choices: [
                  { id: 'sc_cheese', name: 'Sốt Phô mai đặc biệt (Chuẩn)', price: 0, isDefault: true },
                  { id: 'sc_spicy', name: 'Sốt Cay Gochujang Hàn Quốc', price: 0, isDefault: false },
                  { id: 'sc_bbq', name: 'Sốt Tiêu đen nướng BBQ', price: 0, isDefault: false },
                  { id: 'sc_mayo', name: 'Sốt Mayonnaise tương cà', price: 0, isDefault: false }
                ]
              },
              {
                id: 'opt_toppings',
                name: 'Topping thêm',
                layout: 'VERTICAL',
                required: false,
                multiple: true,
                choices: [
                  { id: 'top_egg', name: 'Trứng ốp la lòng đào', price: 10000, isDefault: false },
                  { id: 'top_cheddar', name: 'Phô mai Cheddar tan chảy', price: 12000, isDefault: false },
                  { id: 'top_bacon', name: 'Thịt xông khói áp chảo giòn', price: 12000, isDefault: false }
                ]
              }
            ],
            allowNotes: true,
            notePlaceholder: 'Ví dụ: không lấy dưa chuột muối, nước sốt để riêng...'
          }
        },
        {
          name: 'Pizza Hải Sản Sốt Pesto (Size 20cm)',
          price: 129000,
          description: 'Tôm mực tươi rói, phô mai Mozzarella kéo sợi hòa cùng sốt húng tây Pesto xanh thơm lừng.',
          image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: true,
            sizes: [
              { id: 's20', name: 'Size Nhỏ (20cm)', price: 0, isDefault: true },
              { id: 's25', name: 'Size Vừa (25cm)', price: 40000 },
              { id: 's30', name: 'Size Lớn (30cm)', price: 80000 }
            ],
            optionGroups: [],
            toppings: [
              { id: 'top_crust', name: 'Viền phô mai xúc xích kéo sợi', price: 25000 },
              { id: 'top_extra_cheese', name: 'Gấp đôi phô mai Mozzarella', price: 18000 }
            ],
            allowNotes: true,
            notePlaceholder: 'Ví dụ: cắt 6 miếng, nướng giòn...'
          }
        },
        {
          name: 'Gà Rán Giòn Cay Sốt Hàn Quốc',
          price: 45000,
          description: 'Gà tươi ướp sốt cay ngọt Gochujang rắc mè rang thơm bùi, vỏ ngoài giòn rụm.',
          image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: true,
            sizes: [
              { id: 'p1', name: 'Phần 1 miếng gà', price: 0, isDefault: true },
              { id: 'p2', name: 'Phần 2 miếng gà', price: 40000 }
            ],
            optionGroups: [
              {
                id: 'spice',
                name: 'Mức cay sốt gà',
                required: true,
                options: ['Cay ngọt Gochujang (Chuẩn)', 'Siêu cay cấp độ 2', 'Không cay sốt mật ong'],
                defaultOption: 'Cay ngọt Gochujang (Chuẩn)'
              }
            ],
            toppings: [
              { id: 'top_cheese_dip', name: 'Sốt chấm phô mai béo ngậy', price: 10000 }
            ],
            allowNotes: true
          }
        },
        {
          name: 'Khoai Tây Chiên Lắc Rong Biển',
          price: 35000,
          description: 'Khoai tây cọng lớn nhập khẩu Bỉ lắc cùng rong biển sấy và phô mai mặn ngọt.',
          image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: true,
            sizes: [], // QUÁN CHỈ BÁN 1 SIZE DUY NHẤT (Không chọn size)
            optionGroups: [
              {
                id: 'sauce',
                name: 'Sốt chấm ăn kèm',
                required: true,
                options: ['Tương cà chua Heinz', 'Tương ớt cay Cholimex', 'Sốt Mayonnaise béo'],
                defaultOption: 'Tương cà chua Heinz'
              }
            ],
            toppings: [],
            allowNotes: true
          }
        },
        {
          name: 'Coca-Cola Tươi Mát Lạnh 500ml',
          price: 18000,
          description: 'Nước ngọt có gas ướp lạnh sảng khoái.',
          image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
          isAvailable: true,
          customization: {
            hasCustomization: false,
            sizes: [], // 1 SIZE DUY NHẤT (CHAI 500ML) - KHÔNG CHỌN SIZE
            optionGroups: [], // KHÔNG NƯỚC SỐT
            toppings: [], // KHÔNG TOPPING
            allowNotes: true,
            notePlaceholder: 'Ví dụ: ướp thật lạnh, lấy ống hút...'
          }
        }
      ]
    }
  ];

  // Xóa dữ liệu cũ nếu muốn làm sạch hoặc cập nhật dữ liệu mới
  for (const r of sampleRestaurants) {
    const existing = await RestaurantModel.findOne({ name: r.name });
    if (!existing) {
      await RestaurantModel.create(r);
      console.log(`   ✅ Đã thêm quán mới: "${r.name}" (${r.menuItems.length} món ăn)`);
    } else {
      await RestaurantModel.updateOne(
        { _id: existing._id },
        {
          address: r.address,
          phone: r.phone,
          rating: r.rating,
          image: r.image,
          menuItems: r.menuItems
        }
      );
      console.log(`   ℹ️ Đã cập nhật quán: "${r.name}" (${r.menuItems.length} món ăn)`);
    }
  }

  await restaurantConn.close();
  console.log('   🎉 Hoàn tất seed dữ liệu cho restaurant_db!\n');

  console.log('=============================================================');
  console.log('✨ TẤT CẢ DỮ LIỆU ĐÃ ĐƯỢC NẠP SẴN SÀNG LÊN MONGODB ATLAS!');
  console.log('👉 Đăng nhập test:');
  console.log('   - Khách hàng: khachhang@test.com / 123456');
  console.log('   - Chủ quán:   chuquan@test.com / 123456');
  console.log('👉 Truy cập Web tại: http://localhost:8080');
  console.log('=============================================================\n');
}

seedData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Lỗi khi seed dữ liệu:', err.message);
    process.exit(1);
  });

