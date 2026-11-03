import axios from 'axios';

// 1. Cấu hình Base URL thông minh:
// Tự động điều hướng chính xác về API Gateway tại cổng 8080 (hoặc origin tương ứng)
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Dù người dùng mở trực tiếp container frontend http://localhost:3000 hay qua gateway http://localhost:8080,
    // luôn gọi tới API Gateway tại cổng 8080 để đảm bảo qua Nginx Gateway reverse proxy
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.protocol}//${host}:8080/api/v1`;
    }
    // Nếu chạy qua Domain Ingress (ví dụ food-order.local hoặc production)
    return `${window.location.origin}/api/v1`;
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
};

const API_BASE_URL = getBaseUrl();

// Cấu hình URL dịch vụ riêng lẻ khi deploy độc lập
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL;
const RESTAURANT_SERVICE_URL = import.meta.env.VITE_RESTAURANT_SERVICE_URL;
const ORDER_SERVICE_URL = import.meta.env.VITE_ORDER_SERVICE_URL;
const DELIVERY_SERVICE_URL = import.meta.env.VITE_DELIVERY_SERVICE_URL;
const PAYMENT_SERVICE_URL = import.meta.env.VITE_PAYMENT_SERVICE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
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

// Helper tạo URL linh hoạt: ưu tiên Service URL riêng nếu có, nếu không dùng API Gateway chung
const buildUrl = (directServiceUrl, fallbackPath) => {
  if (directServiceUrl) {
    const cleanUrl = directServiceUrl.replace(/\/+$/, '');
    return `${cleanUrl}${fallbackPath}`;
  }
  return fallbackPath;
};

// -----------------------------------------------------------------------------
// 1. Auth Service Endpoints (Port 3005 Fallback)
// -----------------------------------------------------------------------------
export const authApi = {
  sendOTP: async ({ email, type = 'REGISTER' }) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/otp/send'), { email, type });
    } catch (err) {
      if ((err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
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
      if ((err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
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
      if ((err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
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
      if ((err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
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
      if ((err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
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
      if ((err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
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
    return `${API_BASE_URL}/auth/google`;
  },
  loginWithGoogleCredential: async (credential) => {
    try {
      return await apiClient.post(buildUrl(AUTH_SERVICE_URL, '/auth/google/credential'), { credential });
    } catch (err) {
      if ((err.code === 'ERR_NETWORK' || !err.response) && !AUTH_SERVICE_URL) {
        try {
          return await axios.post('http://localhost:3005/api/v1/auth/google/credential', { credential });
        } catch {}
      }
      throw err;
    }
  },
};

// -----------------------------------------------------------------------------
// 2. Restaurant Service Endpoints (Port 3001 Fallback)
// -----------------------------------------------------------------------------
export const restaurantApi = {
  getAll: async () => {
    try {
      return await apiClient.get(buildUrl(RESTAURANT_SERVICE_URL, '/restaurants'));
    } catch (err) {
      // Fallback tự động gọi trực tiếp port 3001 nếu API Gateway chưa chạy
      if ((err.code === 'ERR_NETWORK' || !err.response) && !RESTAURANT_SERVICE_URL) {
        try {
          console.warn('[Restaurant API] Gateway 8080 không phản hồi, tự động fallback sang port 3001...');
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
      if ((err.code === 'ERR_NETWORK' || !err.response) && !RESTAURANT_SERVICE_URL) {
        try {
          return await axios.get(`http://localhost:3001/api/v1/restaurants/${id}`);
        } catch {}
      }
      throw err;
    }
  },
};

// -----------------------------------------------------------------------------
// 3. Order Service Endpoints (Port 3002 Fallback)
// -----------------------------------------------------------------------------
export const orderApi = {
  create: async (orderData) => {
    try {
      return await apiClient.post(buildUrl(ORDER_SERVICE_URL, '/orders'), orderData);
    } catch (err) {
      if ((err.code === 'ERR_NETWORK' || !err.response) && !ORDER_SERVICE_URL) {
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
      if ((err.code === 'ERR_NETWORK' || !err.response) && !ORDER_SERVICE_URL) {
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
// 4. Delivery Service Endpoints (Port 3004 Fallback)
// -----------------------------------------------------------------------------
export const deliveryApi = {
  getByOrderId: async (orderId) => {
    try {
      return await apiClient.get(buildUrl(DELIVERY_SERVICE_URL, `/deliveries/order/${orderId}`));
    } catch (err) {
      if ((err.code === 'ERR_NETWORK' || !err.response) && !DELIVERY_SERVICE_URL) {
        try {
          return await axios.get(`http://localhost:3004/api/v1/deliveries/order/${orderId}`);
        } catch {}
      }
      throw err;
    }
  },
};

// -----------------------------------------------------------------------------
// 5. Payment Service Endpoints (Port 3003 Fallback)
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
      if ((err.code === 'ERR_NETWORK' || !err.response) && !PAYMENT_SERVICE_URL) {
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
      if ((err.code === 'ERR_NETWORK' || !err.response) && !PAYMENT_SERVICE_URL) {
        try {
          return await axios.get(`http://localhost:3003/api/v1/payments/order/${orderId}`);
        } catch {}
      }
      throw err;
    }
  },
};

export default apiClient;
