import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initGlobalHorizontalWheelScroll } from './utils/horizontalScroll';
import { initSmoothInteractions } from './utils/smoothInteractions';

// Kích hoạt tính năng cuộn ngang bằng bánh xe chuột toàn hệ thống
initGlobalHorizontalWheelScroll();

// Kích hoạt hệ thống hiệu ứng tương tác & Ink Ripple toàn diện
initSmoothInteractions();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

