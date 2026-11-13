import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api/v1/auth': 'http://localhost:3005',
      '/api/v1/restaurants': 'http://localhost:3001',
      '/api/v1/stores': 'http://localhost:3001',
      '/api/v1/upload': 'http://localhost:3001',
      '/api/v1/vouchers': 'http://localhost:3001',
      '/api/v1/reviews': 'http://localhost:3001',
      '/api/v1/admin/vouchers': 'http://localhost:3001',
      '/api/v1/orders': 'http://localhost:3002',
      '/api/v1/payments': 'http://localhost:3003',
      '/api/v1/deliveries': 'http://localhost:3004'
    }
  }
});

