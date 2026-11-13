import axios from 'axios';

// 1. Cấu hình Base URL thông minh:
// Ưu tiên đường dẫn tương đối (Relative Path) để tận dụng Vercel Reverse Proxy / API Gateway,
// giúp che giấu hoàn toàn 5 domain backend Render và loại bỏ triệt để lỗi CORS.
const getBaseUrl = () => {
  // Nếu có biến môi trường VITE_API_BASE_URL (ví dụ: '/api/v1' hoặc '')
  if (import.meta.env.VITE_API_BASE_URL !== undefined && import.meta.env.VITE_API_BASE_URL !== '') {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Mặc định: đường dẫn tương đối chuẩn cho API Gateway trên Vercel / Nginx
  return '/api/v1';
};

const API_BASE_URL = getBaseUrl();

// Cấu hình URL dịch vụ riêng lẻ khi muốn gọi trực tiếp (mặc định để trống để đi qua Vercel Gateway)
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL;
const RESTAURANT_SERVICE_URL = import.meta.env.VITE_RESTAURANT_SERVICE_URL;
const ORDER_SERVICE_URL = import.meta.env.VITE_ORDER_SERVICE_URL;
const DELIVERY_SERVICE_URL = import.meta.env.VITE_DELIVERY_SERVICE_URL;
const PAYMENT_SERVICE_URL = import.meta.env.VITE_PAYMENT_SERVICE_URL;

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Tăng timeout lên 60s để đáp ứng Render Free Tier khi cold start (khởi động sau khi ngủ)
  timeout: 60000,
});

// 2. Tự động đính kèm Token JWT nếu người dùng đã đăng nhập
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper tạo URL linh hoạt:
// Mặc định luôn ưu tiên đi qua Vercel Reverse Proxy / API Gateway tập trung (/api/v1/...)
// để che giấu hoàn toàn 5 domain backend Render và triệt tiêu lỗi CORS.
// Chỉ dùng direct URL khi cấu hình rõ ràng VITE_FORCE_DIRECT_URL === 'true'.
const buildUrl = (directServiceUrl, fallbackPath) => {
  if (import.meta.env.VITE_FORCE_DIRECT_URL === 'true' && directServiceUrl) {
    const cleanUrl = directServiceUrl.replace(/\/+$/, '');
    return `${cleanUrl}${fallbackPath}`;
  }
  return fallbackPath;
};

// -----------------------------------------------------------------------------
// 1. Auth Service Endpoints (Port 3005 Local Fallback)
// -----------------------------------------------------------------------------
export const authApi = {
  sendOTP: async ({ email, type = 'REGISTER' }) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/otp/send'), { email, type });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/otp/send', { email, type });
        } catch {}
      }
      throw err;
    }
  },
  verifyOTP: async ({ email, otp, type = 'REGISTER' }) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/otp/verify'), { email, otp, type });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/otp/verify', { email, otp, type });
        } catch {}
      }
      throw err;
    }
  },
  resetPassword: async ({ email, otp, newPassword }) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/reset-password'), { email, otp, newPassword });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/reset-password', { email, otp, newPassword });
        } catch {}
      }
      throw err;
    }
  },
  login: async (credentials) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/login'), credentials);
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/login', credentials);
        } catch {}
      }
      throw err;
    }
  },
  register: async (userData) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/register'), userData);
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/register', userData);
        } catch {}
      }
      throw err;
    }
  },
  verify: async () => {
    try {
      return await apiClient.get(buildUrl(AUTH_SERVICE_URL, '/auth/verify'));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.get('http://localhost:3005/api/v1/auth/verify', {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  getGoogleAuthUrl: () => {
    if (import.meta.env.VITE_FORCE_DIRECT_URL === 'true' && AUTH_SERVICE_URL) {
      return `${AUTH_SERVICE_URL.replace(/\/+$/, '')}/auth/google`;
    }
    return '/api/v1/auth/google';
  },
  loginWithGoogleCredential: async (credential) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/google/credential'), { credential });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/google/credential', { credential });
        } catch {}
      }
      throw err;
    }
  },
  getProfile: async () => {
    try {
      return await apiClient.get(buildUrl(AUTH_SERVICE_URL, '/auth/profile'));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.get('http://localhost:3005/api/v1/auth/profile', {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  updateProfile: async (profileData) => {
    try {
      return await apiClient.put(buildUrl(AUTH_SERVICE_URL, '/auth/profile'), profileData);
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.put('http://localhost:3005/api/v1/auth/profile', profileData, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  changePassword: async ({ oldPassword, newPassword }) => {
    try {
      return await apiClient.put(buildUrl(AUTH_SERVICE_URL, '/auth/change-password'), { oldPassword, newPassword });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.put('http://localhost:3005/api/v1/auth/change-password', { oldPassword, newPassword }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  getCoinsBalance: async () => {
    try {
      return await apiClient.get(buildUrl(AUTH_SERVICE_URL, '/auth/coins/balance'));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.get('http://localhost:3005/api/v1/auth/coins/balance', {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  deductCoins: async ({ amount, orderId }) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/coins/deduct'), { amount, orderId });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/coins/deduct', { amount, orderId }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  getPhoneConfigStatus: async () => {
    try {
      return await apiClient.get(buildUrl(AUTH_SERVICE_URL, '/auth/phone/config-status'));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        try {
          return await axios.get('http://localhost:3005/api/v1/auth/phone/config-status');
        } catch {}
      }
      throw err;
    }
  },
  checkPhoneAvailable: async ({ phone, purpose }) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/phone/check-available'), { phone, purpose });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/phone/check-available', { phone, purpose }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  verifyFirebasePhone: async ({ idToken, purpose = 'PROFILE' }) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/phone/verify-firebase'), { idToken, purpose });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/phone/verify-firebase', { idToken, purpose }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
};

// -----------------------------------------------------------------------------
// 2. Restaurant Service Endpoints (Port 3001 Local Fallback)
// -----------------------------------------------------------------------------
export const restaurantApi = {
  getAll: async (params = {}) => {
    try {
      return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/restaurants'), { params });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !RESTAURANT_SERVICE_URL) {
        try {
          console.warn('[Restaurant API] Gateway không phản hồi, tự động fallback sang port 3001...');
          return await axios.get('http://localhost:3001/api/v1/restaurants', { params });
        } catch {}
      }
      throw err;
    }
  },
  getById: async (id) => {
    try {
      return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/${id}`));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !RESTAURANT_SERVICE_URL) {
        try {
          return await axios.get(`http://localhost:3001/api/v1/restaurants/${id}`);
        } catch {}
      }
      throw err;
    }
  },
  toggleLike: async (id, userId) => {
    try {
      return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/${id}/like`), { userId });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !RESTAURANT_SERVICE_URL) {
        try {
          return await axios.post(`http://localhost:3001/api/v1/restaurants/${id}/like`, { userId });
        } catch {}
      }
      throw err;
    }
  },
  getFavorites: async (userId) => {
    try {
      return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/restaurants/favorites'), { params: { userId } });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !RESTAURANT_SERVICE_URL) {
        try {
          return await axios.get('http://localhost:3001/api/v1/restaurants/favorites', { params: { userId } });
        } catch {}
      }
      throw err;
    }
  },
};

// -----------------------------------------------------------------------------
// 3. Order Service Endpoints (Port 3002 Local Fallback)
// -----------------------------------------------------------------------------
export const orderApi = {
  create: async (orderData) => {
    try {
      return await apiClient.post(buildUrl(ORDER_SERVICE_URL, '/orders'), orderData);
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !ORDER_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.post('http://localhost:3002/api/v1/orders', orderData, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  getById: async (id) => {
    try {
      return await apiClient.get(buildUrl(ORDER_SERVICE_URL, `/orders/${id}`));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !ORDER_SERVICE_URL) {
        const token = localStorage.getItem('token');
        try {
          return await axios.get(`http://localhost:3002/api/v1/orders/${id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  getAll: (params = {}) =>
    apiClient.get(buildUrl(ORDER_SERVICE_URL, '/orders'), { params }),
  updateStatus: async (orderId, statusData) => {
    return await apiClient.put(buildUrl(ORDER_SERVICE_URL, `/orders/${orderId}/status`), statusData);
  },
  modifyItems: async (orderId, modifyData) => {
    return await apiClient.put(buildUrl(ORDER_SERVICE_URL, `/orders/${orderId}/modify`), modifyData);
  },
  cleanupStale: async () => {
    return await apiClient.post(buildUrl(ORDER_SERVICE_URL, '/orders/cleanup-stale'));
  },
};

// -----------------------------------------------------------------------------
// 4. Delivery Service Endpoints (Port 3004 Local Fallback & Driver Role API)
// -----------------------------------------------------------------------------
export const deliveryApi = {
  // Khách hàng theo dõi lộ trình thời gian thực
  trackOrder: async (orderId) => {
    try {
      return await apiClient.get(buildUrl(DELIVERY_SERVICE_URL, `/deliveries/track/${orderId}`));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !DELIVERY_SERVICE_URL) {
        try {
          return await axios.get(`http://localhost:3004/api/v1/deliveries/track/${orderId}`);
        } catch {}
      }
      throw err;
    }
  },
  getByOrderId: async (orderId) => {
    try {
      return await apiClient.get(buildUrl(DELIVERY_SERVICE_URL, `/deliveries/track/${orderId}`));
    } catch (err) {
      try {
        return await apiClient.get(buildUrl(DELIVERY_SERVICE_URL, `/deliveries/order/${orderId}`));
      } catch (innerErr) {
        if (isLocalhost && (innerErr.code === 'ERR_NETWORK' || !innerErr.response) && !DELIVERY_SERVICE_URL) {
          try {
            return await axios.get(`http://localhost:3004/api/v1/deliveries/track/${orderId}`);
          } catch {
            return await axios.get(`http://localhost:3004/api/v1/deliveries/order/${orderId}`);
          }
        }
        throw innerErr;
      }
    }
  },
  // Tài xế nhận đơn (PATCH /api/v1/deliveries/:id/accept)
  acceptDelivery: async (id, driverData = {}) => {
    return await apiClient.patch(buildUrl(DELIVERY_SERVICE_URL, `/deliveries/${id}/accept`), driverData);
  },
  // Tài xế xác nhận lấy món (PATCH /api/v1/deliveries/:id/pick-up)
  pickUpDelivery: async (id) => {
    return await apiClient.patch(buildUrl(DELIVERY_SERVICE_URL, `/deliveries/${id}/pick-up`));
  },
  // Tài xế hoàn tất giao hàng (PATCH /api/v1/deliveries/:id/complete)
  completeDelivery: async (id) => {
    return await apiClient.patch(buildUrl(DELIVERY_SERVICE_URL, `/deliveries/${id}/complete`));
  },
  // Tài xế cập nhật tọa độ GPS thời gian thực (PATCH /api/v1/deliveries/:id/location)
  updateLocation: async (id, { lat, lng }) => {
    return await apiClient.patch(buildUrl(DELIVERY_SERVICE_URL, `/deliveries/${id}/location`), { lat, lng });
  },
  // Lấy toàn bộ danh sách vận đơn
  getAll: async () => {
    return await apiClient.get(buildUrl(DELIVERY_SERVICE_URL, '/deliveries'));
  },
  // Tính cước phí giao hàng động (Dynamic Surge Pricing theo giờ & thời tiết)
  getShippingFee: async ({ distanceKm, lat, lng, mockParams = {} }) => {
    try {
      const params = {
        distanceKm,
        lat,
        lng,
        ...mockParams
      };
      return await apiClient.get(buildUrl(DELIVERY_SERVICE_URL, '/deliveries/shipping-fee'), { params });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !DELIVERY_SERVICE_URL) {
        try {
          return await axios.get('http://localhost:3004/api/v1/deliveries/shipping-fee', {
            params: { distanceKm, lat, lng, ...mockParams }
          });
        } catch {}
      }
      throw err;
    }
  }
};

// -----------------------------------------------------------------------------
// 5. Payment Service Endpoints (Port 3003 Local Fallback)
// -----------------------------------------------------------------------------
export const paymentApi = {
  createVNPayUrl: async ({ orderId, amount, orderInfo, bankCode }) => {
    try {
      return await apiClient.post(buildUrl(PAYMENT_SERVICE_URL, '/payments/create-vnpay-url'), {
        orderId,
        amount,
        orderInfo,
        bankCode
      });
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !PAYMENT_SERVICE_URL) {
        try {
          return await axios.post('http://localhost:3003/api/v1/payments/create-vnpay-url', {
            orderId,
            amount,
            orderInfo,
            bankCode
          });
        } catch {}
      }
      throw err;
    }
  },
  getByOrderId: async (orderId) => {
    try {
      return await apiClient.get(buildUrl(PAYMENT_SERVICE_URL, `/payments/order/${orderId}`));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !PAYMENT_SERVICE_URL) {
        try {
          return await axios.get(`http://localhost:3003/api/v1/payments/order/${orderId}`);
        } catch {}
      }
      throw err;
    }
  },
};

// -----------------------------------------------------------------------------
// 6. Store & Merchant Onboarding Endpoints (My Store)
// -----------------------------------------------------------------------------
export const storeApi = {
  getMyStatus: async () => {
    try {
      return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-status'));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !RESTAURANT_SERVICE_URL) {
        try {
          const token = localStorage.getItem('token');
          return await axios.get('http://localhost:3001/api/v1/stores/my-status', {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  register: async (storeData) => {
    try {
      return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/stores/register'), storeData);
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !RESTAURANT_SERVICE_URL) {
        try {
          const token = localStorage.getItem('token');
          return await axios.post('http://localhost:3001/api/v1/stores/register', storeData, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        } catch {}
      }
      throw err;
    }
  },
  getMyStore: async () => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store'));
  },
  updateMyStore: async (storeData) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store'), storeData);
  },
  addMenuItem: async (itemData) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/menu'), itemData);
  },
  updateMenuItem: async (itemId, itemData) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/stores/my-store/menu/${itemId}`), itemData);
  },
  deleteMenuItem: async (itemId) => {
    return await apiClient.delete(buildUrl(RESTAURANT_SERVICE_URL, `/stores/my-store/menu/${itemId}`));
  },
  toggleItemAvailability: async (itemId) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/stores/my-store/menu/${itemId}/toggle-availability`));
  },
  updateOperations: async (opData) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/operations'), opData);
  },
  updateCategories: async (catData) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/categories'), catData);
  },
  updateToppingGroups: async (tgData) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/toppings'), tgData);
  },
  updateStaff: async (staffData) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/staff'), staffData);
  },
  manageWallet: async (walletData) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/wallet'), walletData);
  },
  getWallet: async () => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/wallet'));
  },
  getNotifications: async () => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/notifications'));
  },
  markNotificationsRead: async (notificationIds = null) => {
    return await apiClient.put(
      buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/notifications/read'),
      notificationIds ? { notificationIds } : {}
    );
  },
  // Quản lý Voucher riêng của Quán (Merchant Self-Service)
  getVouchers: async () => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/vouchers'));
  },
  createVoucher: async (data) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/vouchers'), data);
  },
  updateVoucher: async (voucherId, data) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/stores/my-store/vouchers/${voucherId}`), data);
  },
  toggleVoucher: async (voucherId) => {
    return await apiClient.patch(buildUrl(RESTAURANT_SERVICE_URL, `/stores/my-store/vouchers/${voucherId}/toggle`));
  },
  deleteVoucher: async (voucherId) => {
    return await apiClient.delete(buildUrl(RESTAURANT_SERVICE_URL, `/stores/my-store/vouchers/${voucherId}`));
  },
  syncSettlements: async (payload) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/stores/my-store/sync-settlements'), payload);
  }
};

// -----------------------------------------------------------------------------
// 7. Voucher Service Endpoints (FoodFast Style & Redis Concurrency Control)
// -----------------------------------------------------------------------------
export const voucherApi = {
  apply: async ({ voucher_code, cart_total, store_id }) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/vouchers/apply'), {
      voucher_code,
      cart_total,
      store_id
    });
  },
  getAvailable: async ({ store_id } = {}) => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/vouchers'), {
      params: { store_id }
    });
  },
  create: async (voucherData) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/vouchers'), voucherData);
  }
};

// -----------------------------------------------------------------------------
// 8. Smart Recommendation API (Ranking Score & Geo-Grid Redis Cache)
// -----------------------------------------------------------------------------
export const recommendationApi = {
  getRecommended: async ({ user_lat, user_lng, city, city_code } = {}) => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/stores/recommended'), {
      params: { user_lat, user_lng, city: city || city_code, city_code: city_code || city }
    });
  }
};

// -----------------------------------------------------------------------------
// 9. Review Service & Event-Driven Incentive Endpoints
// -----------------------------------------------------------------------------
export const reviewApi = {
  create: async (reviewData) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/reviews'), reviewData);
  },
  getByStore: async (storeId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = `/reviews/store/${storeId}${query ? `?${query}` : ''}`;
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, url));
  },
  toggleLike: async (reviewId) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, `/reviews/${reviewId}/like`));
  },
  reply: async (reviewId, comment) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, `/reviews/${reviewId}/reply`), { comment });
  }
};

// -----------------------------------------------------------------------------
// 9.1 Thông báo Chuông Khách Hàng (Customer Notifications & Shopee Reviews)
// -----------------------------------------------------------------------------
export const notificationApi = {
  getMyNotifications: async () => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/notifications/my-notifications'));
  },
  markAsRead: async (id = 'all') => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/notifications/${id}/read`));
  },
  deleteNotification: async (id) => {
    return await apiClient.delete(buildUrl(RESTAURANT_SERVICE_URL, `/notifications/${id}`));
  }
};

// -----------------------------------------------------------------------------
// 10. Admin Management Endpoints
// -----------------------------------------------------------------------------
export const adminApi = {
  login: async ({ email, password }) => {
    return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/admin/login'), { email, password });
  },
  getUsers: async (params = {}) => {
    return await apiClient.get(buildUrl(AUTH_SERVICE_URL, '/auth/admin/users'), { params });
  },
  createUser: async (userData) => {
    return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/admin/users'), userData);
  },
  updateUser: async (id, userData) => {
    return await apiClient.put(buildUrl(AUTH_SERVICE_URL, `/auth/admin/users/${id}`), userData);
  },
  deleteUser: async (id) => {
    return await apiClient.delete(buildUrl(AUTH_SERVICE_URL, `/auth/admin/users/${id}`));
  },
  changePassword: async ({ oldPassword, newPassword }) => {
    return await apiClient.put(buildUrl(AUTH_SERVICE_URL, '/auth/admin/change-password'), { oldPassword, newPassword });
  },
  getRestaurants: async (params = {}) => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/restaurants/admin/list'), { params });
  },
  approveRestaurant: async (id) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/admin/${id}/approve`));
  },
  rejectRestaurant: async (id, reason) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/admin/${id}/reject`), { reason });
  },
  banRestaurant: async (id, { durationDays, banUntil, reason }) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/admin/${id}/ban`), { durationDays, banUntil, reason });
  },
  unbanRestaurant: async (id) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/admin/${id}/unban`));
  },
  warnRestaurant: async (id, { title, content }) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/admin/${id}/warn`), { title, content });
  },
  grantWallet: async (id, { amount, reason, targetBalance }) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/admin/${id}/grant-wallet`), {
      amount,
      reason,
      targetBalance
    });
  },
  createRestaurant: async (restaurantData) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/restaurants'), restaurantData);
  },
  updateRestaurant: async (id, restaurantData) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/${id}`), restaurantData);
  },
  deleteRestaurant: async (id) => {
    return await apiClient.delete(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/admin/${id}`));
  },
  // Quản trị mã giảm giá (Admin Voucher Management)
  getVouchers: async (params = {}) => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/admin/vouchers'), { params });
  },
  createVoucher: async (voucherData) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/admin/vouchers'), voucherData);
  },
  updateVoucher: async (id, voucherData) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/admin/vouchers/${id}`), voucherData);
  },
  toggleVoucher: async (id) => {
    return await apiClient.patch(buildUrl(RESTAURANT_SERVICE_URL, `/admin/vouchers/${id}/toggle`));
  },
  deleteVoucher: async (id) => {
    return await apiClient.delete(buildUrl(RESTAURANT_SERVICE_URL, `/admin/vouchers/${id}`));
  }
};

// Helper tạo URL cho Server-Sent Events (SSE Realtime Stream)
export const buildStreamUrl = (service, path, queryParams = {}) => {
  const serviceMap = {
    auth: AUTH_SERVICE_URL,
    restaurant: RESTAURANT_SERVICE_URL,
    order: ORDER_SERVICE_URL,
    delivery: DELIVERY_SERVICE_URL,
    payment: PAYMENT_SERVICE_URL
  };
  const directServiceUrl = serviceMap[service];
  let baseUrl = '';

  if (import.meta.env.VITE_FORCE_DIRECT_URL === 'true' && directServiceUrl) {
    baseUrl = directServiceUrl.replace(/\/+$/, '');
  } else {
    baseUrl = API_BASE_URL.replace(/\/+$/, '');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  Object.entries(queryParams || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && !url.searchParams.has('token')) {
      url.searchParams.set('token', token);
    }
  }

  return url.toString();
};

export default apiClient;
