const Restaurant = require('../models/Restaurant');
const { getCache, setCache, invalidateRestaurantCache, TTL } = require('../../redis');

// 1. Lấy danh sách tất cả nhà hàng (kèm lọc theo Tỉnh/Thành phố & Cache Redis)
exports.getAllRestaurants = async (req, res) => {
  try {
    const city = (req.query.city || req.query.city_code || '').toLowerCase().trim();
    const isForceRefresh = req.query.refresh === 'true' || req.query.nocache === 'true';
    const CACHE_KEY = city ? `restaurants:city:${city}` : 'restaurants:all';

    // 1.1 Kiểm tra dữ liệu trong Redis Cache trước (Bỏ qua nếu force refresh)
    if (!isForceRefresh) {
      const cachedData = await getCache(CACHE_KEY);
      if (cachedData) {
        console.log(`[restaurantController] ⚡ [Cache Hit] Lấy danh sách ${cachedData.length} quán ăn từ Redis [${CACHE_KEY}]`);
        return res.status(200).json({
          success: true,
          source: 'cache',
          count: cachedData.length,
          city: city || 'all',
          data: cachedData
        });
      }
    }

    // 1.2 Cache Miss / Force Refresh: Truy vấn từ MongoDB Atlas
    console.log(`[restaurantController] 🔍 [${isForceRefresh ? 'Force Refresh' : 'Cache Miss'}] Truy vấn danh sách quán từ MongoDB Atlas (City: ${city || 'all'})...`);
    
    const query = {
      $and: [
        { $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }] }
      ]
    };

    if (city) {
      query.$and.push({
        $or: [
          { city_code: city },
          // Cho các store cũ tạo trước khi có city_code hoặc đăng ký bằng tên thành phố
          ...(city === 'hcm' ? [{ city_code: { $exists: false } }, { city: /Hồ Chí Minh|HCM|Thủ Đức/i }] : []),
          ...(city === 'hn' ? [{ city: /Hà Nội|Ha Noi/i }] : []),
          ...(city === 'dn' ? [{ city: /Đà Nẵng|Da Nang/i }] : [])
        ]
      });
    }

    const restaurants = await Restaurant.find(query).sort({ createdAt: -1 });

    // 1.3 Lưu vào Redis Cache với TTL = 3600 giây (1 tiếng)
    await setCache(CACHE_KEY, restaurants, TTL);

    return res.status(200).json({
      success: true,
      source: 'database',
      count: restaurants.length,
      city: city || 'all',
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
    const { name, address, phone, rating, menuItems, latitude, longitude, prep_time } = req.body;

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
      latitude: latitude !== undefined ? Number(latitude) : 10.7769,
      longitude: longitude !== undefined ? Number(longitude) : 106.7009,
      prep_time: prep_time !== undefined ? Number(prep_time) : 15,
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

// 6. Đăng ký cửa hàng người bán mới (FoodFast Onboarding Process)
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
      householdName,
      householdBusinessLicense,
      companyName,
      companyBusinessLicense,
      powerOfAttorney,
      isLegalRepresentative,
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
      coverImage,
      latitude,
      longitude,
      prep_time
    } = req.body;

    // Tạo tên quán đầy đủ theo format chuẩn FoodFast
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
      city: city || req.body.city_name || 'TP. Hồ Chí Minh',
      city_code: (req.body.city_code || req.body.cityCode || 'hcm').toLowerCase().trim(),
      city_name: req.body.city_name || req.body.cityName || city || 'TP. Hồ Chí Minh',
      district: district || '',
      ward: ward || '',
      streetAddress: streetAddress || '',
      address_detail: req.body.address_detail || streetAddress || '',
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
      householdName: householdName || '',
      householdBusinessLicense: householdBusinessLicense || '',
      companyName: companyName || '',
      companyBusinessLicense: companyBusinessLicense || '',
      powerOfAttorney: powerOfAttorney || '',
      isLegalRepresentative: isLegalRepresentative !== false,
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
      paymentStatus: (packagePrice > 0) ? 'PAID' : 'FREE',
      latitude: latitude !== undefined ? Number(latitude) : 10.7769,
      longitude: longitude !== undefined ? Number(longitude) : 106.7009,
      prep_time: prep_time !== undefined ? Number(prep_time) : 15
    });

    const savedStore = await newStore.save();
    await invalidateRestaurantCache(savedStore._id.toString());

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

    // Tự động kiểm tra hết hạn lệnh khóa quán
    if (store.status === 'BANNED' && store.banInfo?.banUntil && new Date() >= new Date(store.banInfo.banUntil)) {
      store.status = 'ACTIVE';
      if (!store.banInfo) store.banInfo = {};
      store.banInfo.isBanned = false;
      store.banInfo.unbannedAt = new Date();
      if (!Array.isArray(store.notifications)) store.notifications = [];
      store.notifications.unshift({
        id: `notif_${Date.now()}`,
        type: 'UNBAN',
        title: `Thông báo: Hết hạn tạm khóa quán [${store.name}]`,
        content: `Lệnh tạm khóa đối với cửa hàng của bạn đã kết thúc vào lúc ${new Date(store.banInfo.banUntil).toLocaleString('vi-VN')}. Quán đã được tự động kích hoạt mở lại hoạt động bình thường!`,
        createdAt: new Date(),
        isRead: false
      });
      await store.save();
      await invalidateRestaurantCache(store._id);
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
      'latitude', 'longitude', 'prep_time',
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

// 9. Thêm món ăn vào thực đơn quán của tôi (kèm cấu hình kích cỡ & tùy chọn do quán thiết lập)
exports.addMenuItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng của bạn.' });
    }

    const { name, price, description, image, customization, categoryId, sellingHours, linkedToppingGroupIds } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Tên món và giá món không được để trống.' });
    }

    const formattedCustomization = customization || {
      hasCustomization: false,
      sizes: [],
      optionGroups: [],
      toppings: [],
      allowNotes: true,
      notePlaceholder: 'Ghi chú cho quán (không hành, ít cay...)'
    };

    store.menuItems.push({
      name,
      price: Number(price),
      description: description || '',
      image: image || '',
      isAvailable: true,
      categoryId: categoryId || '',
      sellingHours: sellingHours || { isAllDay: true, customDays: [], shifts: [] },
      linkedToppingGroupIds: linkedToppingGroupIds || [],
      customization: formattedCustomization
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

// 10. Sửa món ăn trong thực đơn quán (cập nhật thông tin, kích cỡ, topping do quán quy định)
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

    const { name, price, description, image, isAvailable, customization, categoryId, sellingHours, linkedToppingGroupIds } = req.body;
    if (name) item.name = name;
    if (price !== undefined) item.price = Number(price);
    if (description !== undefined) item.description = description;
    if (image !== undefined) item.image = image;
    if (isAvailable !== undefined) item.isAvailable = isAvailable;
    if (customization !== undefined) item.customization = customization;
    if (categoryId !== undefined) item.categoryId = categoryId;
    if (sellingHours !== undefined) item.sellingHours = sellingHours;
    if (linkedToppingGroupIds !== undefined) item.linkedToppingGroupIds = linkedToppingGroupIds;

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

// 14.1. Admin Khóa quán / Tạm ngưng hoạt động có thời hạn
exports.adminBanRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { durationDays, banUntil, reason } = req.body;

    const store = await Restaurant.findById(id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    let days = Number(durationDays) || 0;
    let untilDate = banUntil ? new Date(banUntil) : null;

    if (!untilDate && days > 0) {
      untilDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else if (untilDate && days <= 0) {
      days = Math.max(1, Math.round((untilDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    } else if (!untilDate && days <= 0) {
      days = 7;
      untilDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const banReasonText = reason && reason.trim() ? reason.trim() : 'Vi phạm quy định và chính sách hoạt động của nền tảng';

    store.status = 'BANNED';
    store.banInfo = {
      isBanned: true,
      bannedAt: new Date(),
      banUntil: untilDate,
      banDurationDays: days,
      banReason: banReasonText,
      bannedBy: (req.user && req.user.email) ? req.user.email : 'Admin'
    };

    if (!Array.isArray(store.notifications)) {
      store.notifications = [];
    }

    const untilDateStr = untilDate ? untilDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Khi có quyết định mới';

    store.notifications.unshift({
      id: `notif_${Date.now()}`,
      type: 'BAN',
      title: `Thông báo: Cửa hàng [${store.name}] đã bị tạm khóa hoạt động`,
      content: `Cửa hàng của bạn đã bị tạm khóa trong vòng ${days} ngày. Thời hạn khóa đến: ${untilDateStr}. Lý do: ${banReasonText}. Vui lòng liên hệ bộ phận hỗ trợ đối tác nếu cần giải trình và mở cấm.`,
      createdAt: new Date(),
      isRead: false,
      meta: { days, banUntil: untilDate, reason: banReasonText }
    });

    await store.save();
    await invalidateRestaurantCache(id);

    return res.status(200).json({
      success: true,
      message: `Đã khóa quán [${store.name}] trong ${days} ngày (đến ${untilDateStr}). Thông báo đã được gửi tới chủ quán.`,
      data: store
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi khóa quán: ' + error.message });
  }
};

// 14.2. Admin Mở khóa quán / Bỏ cấm trước hạn
exports.adminUnbanRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Restaurant.findById(id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    store.status = 'ACTIVE';
    if (!store.banInfo) {
      store.banInfo = {};
    }
    store.banInfo.isBanned = false;
    store.banInfo.unbannedAt = new Date();

    if (!Array.isArray(store.notifications)) {
      store.notifications = [];
    }

    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    store.notifications.unshift({
      id: `notif_${Date.now()}`,
      type: 'UNBAN',
      title: `Thông báo: Cửa hàng [${store.name}] đã được mở khóa hoạt động`,
      content: `Quản trị viên đã dỡ bỏ lệnh khóa đối với cửa hàng của bạn vào lúc ${nowStr}. Cửa hàng hiện đã có thể tiếp tục mở cửa bán hàng và tiếp nhận đơn bình thường.`,
      createdAt: new Date(),
      isRead: false
    });

    await store.save();
    await invalidateRestaurantCache(id);

    return res.status(200).json({
      success: true,
      message: `Đã mở khóa hoạt động cho quán [${store.name}]. Thông báo mở cấm đã được gửi tới chủ quán.`,
      data: store
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi mở khóa quán: ' + error.message });
  }
};

// 14.3. Admin Gửi cảnh báo tới chủ quán
exports.adminWarnRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const store = await Restaurant.findById(id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung cảnh báo không được để trống.' });
    }

    const warnTitle = title && title.trim() ? title.trim() : 'Cảnh báo vi phạm từ Quản trị viên FoodFast';

    if (!Array.isArray(store.notifications)) {
      store.notifications = [];
    }

    store.notifications.unshift({
      id: `notif_${Date.now()}`,
      type: 'WARNING',
      title: warnTitle,
      content: content.trim(),
      createdAt: new Date(),
      isRead: false,
      meta: { warnedBy: (req.user && req.user.email) ? req.user.email : 'Admin' }
    });

    await store.save();

    return res.status(200).json({
      success: true,
      message: `Đã gửi cảnh báo thành công tới chủ quán [${store.name}]!`,
      data: store
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi gửi cảnh báo: ' + error.message });
  }
};

// 14.4. Chủ quán lấy danh sách thông báo & cảnh báo
exports.getStoreNotifications = async (req, res) => {
  try {
    const ownerId = req.user?.id || req.user?.userId || req.user?._id;
    const store = await Restaurant.findOne({ ownerId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng của bạn.' });
    }

    return res.status(200).json({
      success: true,
      data: store.notifications || []
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy thông báo quán: ' + error.message });
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

// -----------------------------------------------------------------------------
// CÁC HÀM PHỤC VỤ VẬN HÀNH ĐỐI TÁC CHỦ QUÁN (SHOPEE PARTNER SPEC)
// -----------------------------------------------------------------------------

// 16. Bật/Tắt nhanh trạng thái Còn món / Hết món (1-Touch Availability Toggle)
exports.toggleMenuItemAvailability = async (req, res) => {
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
    item.isAvailable = !item.isAvailable;
    await store.save();
    await invalidateRestaurantCache(store._id.toString());
    return res.status(200).json({
      success: true,
      message: `Món [${item.name}] đã chuyển sang: ${item.isAvailable ? 'Còn món' : 'Hết món'}`,
      isAvailable: item.isAvailable,
      data: item
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 17. Cập nhật Trạng thái hoạt động, Chế độ Quán Bận & Lịch hoạt động (Module 3)
exports.updateStoreOperations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }
    const { operatingStatus, weeklySchedule, specialSchedules } = req.body;
    if (operatingStatus) {
      store.operatingStatus = {
        ...(store.operatingStatus || {}),
        ...operatingStatus
      };
    }
    if (weeklySchedule) {
      store.weeklySchedule = weeklySchedule;
    }
    if (specialSchedules) {
      store.specialSchedules = specialSchedules;
    }
    await store.save();
    await invalidateRestaurantCache(store._id.toString());
    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái và lịch hoạt động quán thành công!',
      data: {
        operatingStatus: store.operatingStatus,
        weeklySchedule: store.weeklySchedule,
        specialSchedules: store.specialSchedules
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 18. Quản lý Danh mục món & Thứ tự danh mục (Module 2)
exports.manageCategories = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }
    const { categories } = req.body;
    if (categories && Array.isArray(categories)) {
      store.categories = categories;
      await store.save();
      await invalidateRestaurantCache(store._id.toString());
    }
    return res.status(200).json({
      success: true,
      message: 'Cập nhật danh mục thực đơn thành công!',
      data: store.categories
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 19. Quản lý Nhóm Topping & Tùy chọn độc lập của Quán (Module 2)
exports.manageToppingGroups = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }
    const { toppingGroups } = req.body;
    if (toppingGroups && Array.isArray(toppingGroups)) {
      store.toppingGroups = toppingGroups;
      await store.save();
      await invalidateRestaurantCache(store._id.toString());
    }
    return res.status(200).json({
      success: true,
      message: 'Cập nhật nhóm topping thành công!',
      data: store.toppingGroups
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 20. Quản lý Nhân viên của Quán (Module 4)
exports.manageStaff = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }
    const { staff } = req.body;
    if (staff && Array.isArray(staff)) {
      store.staff = staff;
      await store.save();
    }
    return res.status(200).json({
      success: true,
      message: 'Cập nhật danh sách nhân viên thành công!',
      data: store.staff
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 21. Quản lý Ví đối tác, Rút tiền thủ công & PIN bảo mật (Module 5)
exports.manageWallet = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    if (!store.wallet) {
      store.wallet = {
        availableBalance: 1368922,
        pendingBalance: 327850,
        walletPinHash: '123456',
        failedPinAttempts: 0,
        pinLockedUntil: null,
        bankAccount: {
          bankName: store.bankName || 'Vietcombank',
          accountNumber: store.bankAccountNumber || '1033618225',
          accountHolder: store.bankAccountHolder || store.representativeName || 'Dương Nguyễn',
          branch: store.bankBranch || 'TP. Thủ Đức'
        }
      };
    }

    const { action, amount, pin, newPin, bankAccount } = req.body;

    if (action === 'set_pin') {
      if (!newPin || newPin.length !== 6) {
        return res.status(400).json({ success: false, message: 'Mã PIN bảo mật phải gồm đúng 6 chữ số.' });
      }
      store.wallet.walletPinHash = newPin;
      store.wallet.failedPinAttempts = 0;
      await store.save();
      return res.status(200).json({ success: true, message: 'Thiết lập mã PIN rút tiền 6 số thành công!' });
    }

    if (action === 'update_bank') {
      if (bankAccount) {
        store.wallet.bankAccount = { ...store.wallet.bankAccount, ...bankAccount };
        await store.save();
      }
      return res.status(200).json({
        success: true,
        message: 'Cập nhật thông tin tài khoản ngân hàng thành công!',
        data: store.wallet.bankAccount
      });
    }

    if (action === 'withdraw') {
      const withdrawAmount = Number(amount);
      if (!withdrawAmount || withdrawAmount < 100000) {
        return res.status(400).json({ success: false, message: 'Số tiền rút tối thiểu là 100.000đ.' });
      }

      if (withdrawAmount > (store.wallet.availableBalance || 0)) {
        return res.status(400).json({ success: false, message: 'Số dư khả dụng không đủ để thực hiện yêu cầu rút tiền.' });
      }

      // Xác thực mã PIN (Mặc định mã PIN 123456 nếu chưa tạo)
      const correctPin = store.wallet.walletPinHash || '123456';
      if (pin !== correctPin) {
        store.wallet.failedPinAttempts = (store.wallet.failedPinAttempts || 0) + 1;
        await store.save();
        return res.status(400).json({
          success: false,
          message: `Mã PIN bảo mật không chính xác (Đã thử sai ${store.wallet.failedPinAttempts}/5 lần).`
        });
      }

      // Trừ tiền khỏi Số dư khả dụng
      store.wallet.availableBalance -= withdrawAmount;
      store.wallet.failedPinAttempts = 0;

      const payoutRecord = {
        id: 'WD_' + Date.now(),
        code: 'WD-' + Math.floor(100000 + Math.random() * 900000),
        amount: withdrawAmount,
        status: 'PENDING',
        bankInfo: store.wallet.bankAccount || {
          bankName: store.bankName,
          accountNumber: store.bankAccountNumber,
          accountHolder: store.bankAccountHolder
        },
        requestedAt: new Date()
      };

      if (!store.payouts) store.payouts = [];
      store.payouts.unshift(payoutRecord);

      await store.save();
      return res.status(200).json({
        success: true,
        message: 'Tạo yêu cầu rút tiền thành công! Tiền sẽ được chuyển về tài khoản ngân hàng từ 2 - 4 ngày làm việc.',
        data: {
          wallet: store.wallet,
          payout: payoutRecord
        }
      });
    }

    // Default: Trả về thông tin ví
    return res.status(200).json({
      success: true,
      data: {
        wallet: store.wallet,
        payouts: store.payouts || []
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// QUÁN YÊU THÍCH (SHOPEEFOOD WISHLIST / LIKE SYSTEM)
// =============================================================================

// 20. Like / Dislike (Thả tim / Bỏ tim) quán ăn
exports.toggleRestaurantLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId || req.body?.userId || req.query?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để lưu quán vào danh sách yêu thích!'
      });
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy quán ăn!' });
    }

    if (!restaurant.likes) restaurant.likes = [];
    const index = restaurant.likes.indexOf(String(userId));
    let isLiked = false;

    if (index > -1) {
      restaurant.likes.splice(index, 1);
      isLiked = false;
    } else {
      restaurant.likes.push(String(userId));
      isLiked = true;
    }

    restaurant.likeCount = restaurant.likes.length;
    await restaurant.save();

    // Làm mới cache quán
    invalidateRestaurantCache(restaurant._id, restaurant.city_code);

    return res.status(200).json({
      success: true,
      isLiked,
      likeCount: restaurant.likeCount,
      message: isLiked ? `Đã thêm "${restaurant.name}" vào danh sách yêu thích!` : `Đã bỏ lưu quán "${restaurant.name}".`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 21. Lấy danh sách các quán đã thả tim của khách hàng
exports.getFavoriteRestaurants = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.query?.userId;

    if (!userId) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const favorites = await Restaurant.find({
      likes: String(userId),
      $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }]
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: favorites.length,
      data: favorites
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
