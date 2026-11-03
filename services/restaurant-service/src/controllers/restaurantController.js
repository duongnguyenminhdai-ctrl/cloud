const Restaurant = require('../models/Restaurant');
const { getCache, setCache, invalidateRestaurantCache, TTL } = require('../../redis');

// 1. Lấy danh sách tất cả nhà hàng (kèm Cache Redis 'restaurants:all')
exports.getAllRestaurants = async (req, res) => {
  try {
    const CACHE_KEY = 'restaurants:all';

    // 1.1 Kiểm tra dữ liệu trong Redis Cache trước
    const cachedData = await getCache(CACHE_KEY);
    if (cachedData) {
      console.log(`[restaurantController] ⚡ [Cache Hit] Lấy danh sách ${cachedData.length} quán ăn từ Redis`);
      return res.status(200).json({
        success: true,
        source: 'cache',
        count: cachedData.length,
        data: cachedData
      });
    }

    // 1.2 Cache Miss: Truy vấn từ MongoDB Atlas
    console.log(`[restaurantController] 🔍 [Cache Miss] Truy vấn danh sách quán từ MongoDB Atlas...`);
    const restaurants = await Restaurant.find().sort({ createdAt: -1 });

    // 1.3 Lưu vào Redis Cache với TTL = 3600 giây (1 tiếng)
    await setCache(CACHE_KEY, restaurants, TTL);

    return res.status(200).json({
      success: true,
      source: 'database',
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    console.error('[restaurantController] ❌ Lỗi lấy danh sách quán:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách nhà hàng: ' + error.message
    });
  }
};

// 2. Lấy thông tin chi tiết một nhà hàng và menu theo ID (kèm Cache Redis 'menu:<id>')
exports.getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const CACHE_KEY = `menu:${id}`;

    // 2.1 Kiểm tra Cache trong Redis
    const cachedRestaurant = await getCache(CACHE_KEY);
    if (cachedRestaurant) {
      console.log(`[restaurantController] ⚡ [Cache Hit] Lấy chi tiết quán & menu [${id}] từ Redis`);
      return res.status(200).json({
        success: true,
        source: 'cache',
        data: cachedRestaurant
      });
    }

    // 2.2 Cache Miss: Truy vấn từ MongoDB Atlas
    console.log(`[restaurantController] 🔍 [Cache Miss] Truy vấn quán [${id}] từ MongoDB Atlas...`);
    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy nhà hàng với ID: ${id}`
      });
    }

    // 2.3 Lưu vào Redis Cache với TTL = 3600s
    await setCache(CACHE_KEY, restaurant, TTL);

    return res.status(200).json({
      success: true,
      source: 'database',
      data: restaurant
    });
  } catch (error) {
    console.error('[restaurantController] ❌ Lỗi lấy chi tiết quán:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết nhà hàng: ' + error.message
    });
  }
};

// 3. Tạo mới nhà hàng kèm thực đơn (menuItems) + Tự động xóa cache (Cache Invalidation)
exports.createRestaurant = async (req, res) => {
  try {
    const { name, address, phone, rating, menuItems } = req.body;

    if (!name || !address || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ: name, address, phone'
      });
    }

    const newRestaurant = new Restaurant({
      name,
      address,
      phone,
      rating: rating || 5.0,
      menuItems: menuItems || []
    });

    const savedRestaurant = await newRestaurant.save();

    // Cache Invalidation: Xóa cache danh sách để người dùng thấy quán mới
    await invalidateRestaurantCache(savedRestaurant._id.toString());

    return res.status(201).json({
      success: true,
      message: 'Tạo nhà hàng thành công! Đã tự động cập nhật cache.',
      data: savedRestaurant
    });
  } catch (error) {
    console.error('[restaurantController] ❌ Lỗi tạo nhà hàng:', error.message);
    return res.status(400).json({
      success: false,
      message: 'Không thể tạo nhà hàng: ' + error.message
    });
  }
};

// 4. Cập nhật thông tin quán ăn / menu (PUT) + Tự động xóa cache
exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedRestaurant) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy nhà hàng với ID: ${id}`
      });
    }

    // Cache Invalidation: Xóa cả cache danh sách và cache menu của quán này
    await invalidateRestaurantCache(id);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật nhà hàng thành công! Đã invalidate cache Redis.',
      data: updatedRestaurant
    });
  } catch (error) {
    console.error('[restaurantController] ❌ Lỗi cập nhật quán:', error.message);
    return res.status(400).json({
      success: false,
      message: 'Không thể cập nhật nhà hàng: ' + error.message
    });
  }
};
