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
    const restaurants = await Restaurant.find({
      $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }]
    }).sort({ createdAt: -1 });

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

// =============================================================================
// CỬA HÀNG CỦA TÔI (MY STORE & SELLER ONBOARDING)
// =============================================================================

// 5. Kiểm tra trạng thái cửa hàng của người dùng hiện tại
exports.getStoreStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });

    if (!store) {
      return res.status(200).json({
        success: true,
        has_store: false,
        store_status: 'NOT_REGISTERED',
        store_id: null,
        store: null
      });
    }

    return res.status(200).json({
      success: true,
      has_store: true,
      store_status: store.status,
      store_id: store._id.toString(),
      store
    });
  } catch (error) {
    console.error('[restaurantController] ❌ Lỗi kiểm tra trạng thái quán:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi kiểm tra trạng thái cửa hàng: ' + error.message
    });
  }
};

// 6. Đăng ký cửa hàng người bán mới (Shopee Onboarding Process)
exports.registerStore = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Kiểm tra xem người dùng đã từng đăng ký store chưa
    const existingStore = await Restaurant.findOne({ ownerId: userId });
    if (existingStore) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã gửi hồ sơ đăng ký cửa hàng trước đó. Trạng thái hiện tại: ' + existingStore.status,
        store: existingStore
      });
    }

    const {
      name,
      brandName,
      specialtyDish,
      areaStreet,
      city,
      district,
      ward,
      streetAddress,
      phone,
      address,
      merchantType,
      representativeName,
      repEmail,
      repPhone,
      repAltPhone,
      citizenId,
      citizenIdDate,
      citizenIdPlace,
      citizenIdFront,
      citizenIdBack,
      businessLicenseImage,
      taxCode,
      taxImage,
      relatedDocuments,
      bankName,
      bankAccountNumber,
      bankAccountHolder,
      bankBranch,
      operatingHours,
      serviceTypes,
      cuisineTypes,
      featuredDishes,
      parkingFee,
      menuImages,
      growthPackage,
      packagePrice,
      image,
      coverImage
    } = req.body;

    // Tạo tên quán đầy đủ theo format chuẩn Shopee
    let fullStoreName = name;
    if (!fullStoreName && brandName) {
      const parts = [brandName, specialtyDish, areaStreet].filter(Boolean);
      fullStoreName = parts.join(' - ');
    }
    if (!fullStoreName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp tên cửa hàng / quán ăn.'
      });
    }

    // Tạo địa chỉ đầy đủ
    let fullAddress = address;
    if (!fullAddress && (streetAddress || district || city)) {
      const addrParts = [streetAddress, ward, district, city].filter(Boolean);
      fullAddress = addrParts.join(', ');
    }
    if (!fullAddress) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp địa chỉ cửa hàng.'
      });
    }

    const newStore = new Restaurant({
      ownerId: userId,
      name: fullStoreName,
      brandName: brandName || fullStoreName,
      specialtyDish: specialtyDish || '',
      areaStreet: areaStreet || '',
      city: city || 'TP. Hồ Chí Minh',
      district: district || '',
      ward: ward || '',
      streetAddress: streetAddress || '',
      address: fullAddress,
      phone: phone || repPhone || '',
      status: 'PENDING',
      image: image || citizenIdFront || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
      coverImage: coverImage || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
      merchantType: merchantType || 'INDIVIDUAL',
      representativeName: representativeName || req.user.name || '',
      repEmail: repEmail || req.user.email || '',
      repPhone: repPhone || phone || '',
      repAltPhone: repAltPhone || '',
      citizenId: citizenId || '',
      citizenIdDate: citizenIdDate || '',
      citizenIdPlace: citizenIdPlace || '',
      citizenIdFront: citizenIdFront || '',
      citizenIdBack: citizenIdBack || '',
      businessLicenseImage: businessLicenseImage || '',
      taxCode: taxCode || '',
      taxImage: taxImage || '',
      relatedDocuments: relatedDocuments || [],
      bankName: bankName || '',
      bankAccountNumber: bankAccountNumber || '',
      bankAccountHolder: bankAccountHolder || representativeName || req.user.name || '',
      bankBranch: bankBranch || '',
      operatingHours: operatingHours || undefined,
      serviceTypes: serviceTypes || ['Quán ăn'],
      cuisineTypes: cuisineTypes || ['Món Việt'],
      featuredDishes: featuredDishes || [],
      parkingFee: parkingFee || 'Miễn phí',
      menuImages: menuImages || [],
      growthPackage: growthPackage || 'FREE',
      packagePrice: packagePrice || 0,
      paymentStatus: (packagePrice > 0) ? 'PAID' : 'FREE'
    });

    const savedStore = await newStore.save();

    return res.status(201).json({
      success: true,
      message: 'Gửi hồ sơ đăng ký quán thành công! Hồ sơ đang được Quản trị viên xét duyệt.',
      data: savedStore
    });
  } catch (error) {
    console.error('[restaurantController] ❌ Lỗi đăng ký cửa hàng:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng ký cửa hàng: ' + error.message
    });
  }
};

// 7. Lấy thông tin quán của người dùng hiện tại
exports.getMyStore = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Bạn chưa có cửa hàng nào được tạo.'
      });
    }
    return res.status(200).json({
      success: true,
      data: store
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy thông tin quán: ' + error.message });
  }
};

// 8. Cập nhật thông tin quán của người dùng hiện tại
exports.updateMyStore = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng của bạn.' });
    }

    const allowedUpdates = [
      'name', 'phone', 'address', 'image', 'coverImage',
      'operatingHours', 'parkingFee', 'serviceTypes', 'cuisineTypes', 'featuredDishes'
    ];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        store[field] = req.body[field];
      }
    });

    const updated = await store.save();
    await invalidateRestaurantCache(updated._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin cửa hàng thành công!',
      data: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật quán: ' + error.message });
  }
};

// 9. Thêm món ăn vào thực đơn quán của tôi
exports.addMenuItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng của bạn.' });
    }

    const { name, price, description, image } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Tên món và giá món không được để trống.' });
    }

    store.menuItems.push({
      name,
      price: Number(price),
      description: description || '',
      image: image || '',
      isAvailable: true
    });

    await store.save();
    await invalidateRestaurantCache(store._id.toString());

    return res.status(201).json({
      success: true,
      message: 'Thêm món mới thành công!',
      data: store.menuItems
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi thêm món: ' + error.message });
  }
};

// 10. Sửa món ăn trong thực đơn quán
exports.updateMenuItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.params;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    const item = store.menuItems.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });
    }

    const { name, price, description, image, isAvailable } = req.body;
    if (name) item.name = name;
    if (price !== undefined) item.price = Number(price);
    if (description !== undefined) item.description = description;
    if (image !== undefined) item.image = image;
    if (isAvailable !== undefined) item.isAvailable = isAvailable;

    await store.save();
    await invalidateRestaurantCache(store._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Cập nhật món ăn thành công!',
      data: item
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi sửa món: ' + error.message });
  }
};

// 11. Xóa món ăn khỏi thực đơn quán
exports.deleteMenuItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.params;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    store.menuItems.pull({ _id: itemId });
    await store.save();
    await invalidateRestaurantCache(store._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Đã xóa món ăn khỏi thực đơn!'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa món: ' + error.message });
  }
};

// =============================================================================
// QUẢN TRỊ VIÊN - QUẢN LÝ QUÁN & PHÊ DUYỆT (ADMIN STORE MANAGEMENT)
// =============================================================================

// 12. Admin lấy danh sách quán: phân trang, tìm kiếm, lọc theo status, sắp xếp
exports.adminGetRestaurants = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const { search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { representativeName: { $regex: search, $options: 'i' } },
        { repEmail: { $regex: search, $options: 'i' } }
      ];
    }
    if (status && status !== 'ALL') {
      query.status = status;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [stores, total] = await Promise.all([
      Restaurant.find(query).sort(sort).skip(skip).limit(limit),
      Restaurant.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: stores,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách quán admin: ' + error.message });
  }
};

// 13. Admin phê duyệt quán (status -> ACTIVE)
exports.adminApproveRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Restaurant.findById(id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    store.status = 'ACTIVE';
    store.rejectedReason = '';
    store.reviewedAt = new Date();
    store.reviewedBy = (req.user && req.user.email) ? req.user.email : 'Admin';

    await store.save();
    await invalidateRestaurantCache(id);

    return res.status(200).json({
      success: true,
      message: `Đã phê duyệt quán [${store.name}] thành công! Quán đã sẵn sàng nhận đơn.`,
      data: store
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi duyệt quán: ' + error.message });
  }
};

// 14. Admin từ chối duyệt quán (status -> REJECTED)
exports.adminRejectRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const store = await Restaurant.findById(id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    store.status = 'REJECTED';
    store.rejectedReason = reason || 'Thông tin giấy tờ hoặc địa chỉ quán chưa đầy đủ, vui lòng bổ sung.';
    store.reviewedAt = new Date();
    store.reviewedBy = (req.user && req.user.email) ? req.user.email : 'Admin';

    await store.save();
    await invalidateRestaurantCache(id);

    return res.status(200).json({
      success: true,
      message: `Đã từ chối duyệt quán [${store.name}].`,
      data: store
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi từ chối duyệt quán: ' + error.message });
  }
};

// 15. Admin xóa quán
exports.adminDeleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Restaurant.findByIdAndDelete(id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng cần xóa.' });
    }

    await invalidateRestaurantCache(id);

    return res.status(200).json({
      success: true,
      message: `Đã xóa quán [${store.name}] thành công!`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa quán: ' + error.message });
  }
};
