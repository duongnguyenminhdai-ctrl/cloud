import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initGlobalHorizontalWheelScroll } from './utils/horizontalScroll';

// Kích hoạt tính năng cuộn ngang bằng bánh xe chuột toàn hệ thống
initGlobalHorizontalWheelScroll();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

