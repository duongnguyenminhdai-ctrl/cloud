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
    isAvailable: { type: Boolean, default: true }
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
          isAvailable: true
        },
        {
          name: 'Cơm Tấm Đùi Gà Nướng Mật Ong',
          price: 55000,
          description: 'Đùi gà góc tư ướp sốt mật ong rừng nướng vàng ruộm, da giòn thịt mềm mọng nước.',
          image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
        },
        {
          name: 'Canh Khổ Qua Dồn Thịt Băm',
          price: 25000,
          description: 'Canh giải nhiệt ngọt lành, khổ qua tươi dồn thịt heo băm đậm đà gia vị truyền thống.',
          image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
        },
        {
          name: 'Chả Trứng Hấp Gọi Thêm',
          price: 15000,
          description: 'Miếng chả trứng thịt mộc nhĩ nướng mặt vàng ươm, béo ngậy.',
          image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
        },
        {
          name: 'Trà Đá Hoa Lài Thơm Mát',
          price: 5000,
          description: 'Trà lài ướp hoa tươi thanh lọc cơ thể, giải khát sảng khoái.',
          image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
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
          isAvailable: true
        },
        {
          name: 'Trà Đào Đá Xay Macchiato',
          price: 60000,
          description: 'Miếng đào giòn ngọt tự nhiên hòa quyện cùng lớp kem Macchiato bồng bềnh béo mịn.',
          image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
        },
        {
          name: 'Trà Hoa Hồng Kem Sữa',
          price: 52000,
          description: 'Hương hoa hồng nồng nàn quyến rũ, thanh mát ngọt dịu dễ chịu.',
          image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
        },
        {
          name: 'Cà Phê Phin Sữa Đá Đậm Đà',
          price: 38000,
          description: 'Hạt cà phê Robusta tuyển chọn từ cao nguyên Buôn Ma Thuột rang xay mộc.',
          image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
        },
        {
          name: 'Bánh Croissant Phô Mai Nướng',
          price: 32000,
          description: 'Bánh sừng bò ngàn lớp thơm bơ giòn rụm kẹp phô mai cheddar tan chảy.',
          image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
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
          isAvailable: true
        },
        {
          name: 'Pizza Hải Sản Sốt Pesto (Size 20cm)',
          price: 129000,
          description: 'Tôm mực tươi rói, phô mai Mozzarella kéo sợi hòa cùng sốt húng tây Pesto xanh thơm lừng.',
          image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
        },
        {
          name: 'Gà Rán Giòn Cay Sốt Hàn Quốc',
          price: 45000,
          description: 'Gà tươi ướp sốt cay ngọt Gochujang rắc mè rang thơm bùi, vỏ ngoài giòn rụm.',
          image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
        },
        {
          name: 'Khoai Tây Chiên Lắc Rong Biển',
          price: 35000,
          description: 'Khoai tây cọng lớn nhập khẩu Bỉ lắc cùng rong biển sấy và phô mai mặn ngọt.',
          image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
        },
        {
          name: 'Coca-Cola Tươi Mát Lạnh 500ml',
          price: 18000,
          description: 'Nước ngọt có gas ướp lạnh sảng khoái.',
          image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
          isAvailable: true
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

