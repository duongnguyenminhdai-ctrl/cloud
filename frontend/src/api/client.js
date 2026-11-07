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
};

// -----------------------------------------------------------------------------
// 2. Restaurant Service Endpoints (Port 3001 Local Fallback)
// -----------------------------------------------------------------------------
export const restaurantApi = {
  getAll: async () => {
    try {
      return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/restaurants'));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !RESTAURANT_SERVICE_URL) {
        try {
          console.warn('[Restaurant API] Gateway không phản hồi, tự động fallback sang port 3001...');
          return await axios.get('http://localhost:3001/api/v1/restaurants');
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
  getAll: () =>
    apiClient.get(buildUrl(ORDER_SERVICE_URL, '/orders')),
};

// -----------------------------------------------------------------------------
// 4. Delivery Service Endpoints (Port 3004 Local Fallback)
// -----------------------------------------------------------------------------
export const deliveryApi = {
  getByOrderId: async (orderId) => {
    try {
      return await apiClient.get(buildUrl(DELIVERY_SERVICE_URL, `/deliveries/order/${orderId}`));
    } catch (err) {
      if (isLocalhost && (err.code === 'ERR_NETWORK' || !err.response) && !DELIVERY_SERVICE_URL) {
        try {
          return await axios.get(`http://localhost:3004/api/v1/deliveries/order/${orderId}`);
        } catch {}
      }
      throw err;
    }
  },
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
  }
};

// -----------------------------------------------------------------------------
// 7. Voucher Service Endpoints (Shopee Style & Redis Concurrency Control)
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
  getRecommended: async ({ user_lat, user_lng } = {}) => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/stores/recommended'), {
      params: { user_lat, user_lng }
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
  getByStore: async (storeId) => {
    return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, `/reviews/store/${storeId}`));
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
  createRestaurant: async (restaurantData) => {
    return await apiClient.post(buildUrl(RESTAURANT_SERVICE_URL, '/restaurants'), restaurantData);
  },
  updateRestaurant: async (id, restaurantData) => {
    return await apiClient.put(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/${id}`), restaurantData);
  },
  deleteRestaurant: async (id) => {
    return await apiClient.delete(buildUrl(RESTAURANT_SERVICE_URL, `/restaurants/admin/${id}`));
  }
};

export default apiClient;
