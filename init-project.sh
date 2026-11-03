#!/usr/bin/env bash

# ==============================================================================
# Script: init-project.sh
# Description: Tự động khởi tạo cấu trúc Microservices cho đồ án Đặt món ăn
# Architecture: Node.js (Express) + MongoDB Atlas + RabbitMQ + Nginx + React (Vite/Tailwind)
# ==============================================================================

set -euo pipefail

PROJECT_NAME="food-delivery-cloud"

echo "=================================================="
echo "🚀 Đang khởi tạo dự án: ${PROJECT_NAME}"
echo "=================================================="

# 1. Tạo thư mục gốc dự án
mkdir -p "${PROJECT_NAME}"
cd "${PROJECT_NAME}"

# 2. Định nghĩa danh sách 4 backend microservices kèm port và tên database
# Format: "service_name:port:db_name"
SERVICES=(
  "restaurant-service:3001:restaurant_db"
  "order-service:3002:order_db"
  "payment-service:3003:payment_db"
  "delivery-service:3004:delivery_db"
)

# 3. Khởi tạo từng microservice
mkdir -p services
for item in "${SERVICES[@]}"; do
  IFS=":" read -r SERVICE_NAME PORT DB_NAME <<< "${item}"
  SERVICE_DIR="services/${SERVICE_NAME}"

  echo "📦 -> Đang tạo service: ${SERVICE_NAME} (Port: ${PORT})..."
  mkdir -p "${SERVICE_DIR}/src"

  # 3.1. Tạo package.json
  cat <<EOF > "${SERVICE_DIR}/package.json"
{
  "name": "${SERVICE_NAME}",
  "version": "1.0.0",
  "description": "Microservice ${SERVICE_NAME} cho hệ thống Food Delivery Cloud",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "amqplib": "^0.10.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "mongoose": "^8.4.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
EOF

  # 3.2. Tạo module src/rabbitmq.js dùng chung
  cat <<'EOF' > "${SERVICE_DIR}/src/rabbitmq.js"
const amqp = require('amqplib');

const DEFAULT_EXCHANGE = 'food_order_topic';
const DEFAULT_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

let connection = null;
let channel = null;
let isConnecting = false;
let currentUrl = DEFAULT_URL;

const registeredConsumers = [];

async function connectRabbitMQ(url = DEFAULT_URL) {
  if (connection && channel) {
    return { connection, channel };
  }

  if (isConnecting) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (connection && channel) {
          clearInterval(checkInterval);
          resolve({ connection, channel });
        }
      }, 500);
    });
  }

  currentUrl = url || currentUrl;
  isConnecting = true;

  try {
    console.log(`[RabbitMQ] ⏳ Đang kết nối tới: ${currentUrl}...`);
    connection = await amqp.connect(currentUrl);

    connection.on('error', (err) => {
      console.error('[RabbitMQ] ⚠️ Lỗi kết nối (Connection Error):', err.message);
    });

    connection.on('close', () => {
      console.warn('[RabbitMQ] 🔌 Mất kết nối tới RabbitMQ! Sẽ tự động kết nối lại sau 5 giây...');
      connection = null;
      channel = null;
      isConnecting = false;
      setTimeout(() => {
        connectRabbitMQ(currentUrl).catch(() => {});
      }, 5000);
    });

    channel = await connection.createChannel();
    channel.prefetch(1);

    channel.on('error', (err) => {
      console.error('[RabbitMQ] ⚠️ Lỗi kênh (Channel Error):', err.message);
    });

    channel.on('close', () => {
      console.warn('[RabbitMQ] ⚠️ Channel bị đóng.');
      channel = null;
    });

    console.log('[RabbitMQ] ✅ Kết nối và khởi tạo Channel thành công!');
    isConnecting = false;

    for (const consumer of registeredConsumers) {
      await setupConsumer(consumer);
    }

    return { connection, channel };
  } catch (error) {
    console.error(`[RabbitMQ] ❌ Kết nối thất bại: ${error.message}. Đang thử lại sau 5 giây...`);
    connection = null;
    channel = null;
    isConnecting = false;

    setTimeout(() => {
      connectRabbitMQ(currentUrl).catch(() => {});
    }, 5000);

    return { connection: null, channel: null };
  }
}

async function getChannel() {
  if (!channel) {
    await connectRabbitMQ(currentUrl);
  }
  if (!channel) {
    throw new Error('[RabbitMQ] Chưa thể lấy Channel do chưa kết nối được tới server.');
  }
  return channel;
}

async function publishEvent(exchange = DEFAULT_EXCHANGE, routingKey, data) {
  try {
    const ch = await getChannel();
    await ch.assertExchange(exchange, 'topic', { durable: true });

    const payload = Buffer.from(JSON.stringify(data));
    const published = ch.publish(exchange, routingKey, payload, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now()
    });

    console.log(`[RabbitMQ] 📤 Đã bắn sự kiện [${routingKey}] lên exchange [${exchange}]:`, data);
    return published;
  } catch (error) {
    console.error(`[RabbitMQ] ❌ Lỗi khi bắn sự kiện [${routingKey}]:`, error.message);
    throw error;
  }
}

async function setupConsumer({ exchange, queueName, routingKey, callback }) {
  try {
    const ch = await getChannel();
    await ch.assertExchange(exchange, 'topic', { durable: true });
    const q = await ch.assertQueue(queueName, { durable: true });
    await ch.bindQueue(q.queue, exchange, routingKey);

    console.log(`[RabbitMQ] 📥 Đã đăng ký lắng nghe Queue [${queueName}] với RoutingKey [${routingKey}]`);

    await ch.consume(
      q.queue,
      async (msg) => {
        if (!msg) return;

        try {
          const rawContent = msg.content.toString();
          const parsedData = JSON.parse(rawContent);

          console.log(`[RabbitMQ] 📩 [${queueName}] Nhận được tin nhắn [${routingKey}]:`, parsedData);
          await callback(parsedData, msg);

          ch.ack(msg);
          console.log(`[RabbitMQ] ✅ [${queueName}] Đã xác nhận thành công (ACK) cho [${routingKey}]`);
        } catch (handlerError) {
          console.error(`[RabbitMQ] ❌ [${queueName}] Lỗi xử lý callback cho [${routingKey}]:`, handlerError.message);
          ch.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
  } catch (error) {
    console.error(`[RabbitMQ] ❌ Lỗi khi thiết lập consumer cho queue [${queueName}]:`, error.message);
  }
}

async function consumeEvent(exchange = DEFAULT_EXCHANGE, queueName, routingKey, callback) {
  const consumerConfig = {
    exchange: exchange || DEFAULT_EXCHANGE,
    queueName,
    routingKey,
    callback
  };

  registeredConsumers.push(consumerConfig);

  if (channel) {
    await setupConsumer(consumerConfig);
  } else {
    connectRabbitMQ().catch(() => {});
  }
}

module.exports = {
  connectRabbitMQ,
  publishEvent,
  consumeEvent,
  DEFAULT_EXCHANGE
};
EOF

  # 3.3. Tạo cấu trúc thư mục MVC: models, controllers, routes
  mkdir -p "${SERVICE_DIR}/src/models" "${SERVICE_DIR}/src/controllers" "${SERVICE_DIR}/src/routes"

  # ============================================================================
  # SERVICE: restaurant-service
  # ============================================================================
  if [ "${SERVICE_NAME}" = "restaurant-service" ]; then
    cat <<'EOF' > "${SERVICE_DIR}/src/models/Restaurant.js"
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên món ăn không được để trống'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Giá món ăn không được để trống'],
    min: [0, 'Giá món ăn phải lớn hơn hoặc bằng 0']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
});

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên nhà hàng không được để trống'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Địa chỉ nhà hàng không được để trống'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Số điện thoại nhà hàng không được để trống'],
      trim: true
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 1.0,
      max: 5.0
    },
    menuItems: [menuItemSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Restaurant', restaurantSchema);
EOF

    cat <<'EOF' > "${SERVICE_DIR}/src/controllers/restaurantController.js"
const Restaurant = require('../models/Restaurant');

exports.getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: `Không tìm thấy nhà hàng ID: ${id}` });
    }
    return res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRestaurant = async (req, res) => {
  try {
    const { name, address, phone, rating, menuItems } = req.body;
    if (!name || !address || !phone) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp: name, address, phone' });
    }
    const newRestaurant = new Restaurant({
      name,
      address,
      phone,
      rating: rating || 5.0,
      menuItems: menuItems || []
    });
    const saved = await newRestaurant.save();
    return res.status(201).json({ success: true, message: 'Tạo nhà hàng thành công!', data: saved });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
EOF

    cat <<'EOF' > "${SERVICE_DIR}/src/routes/restaurantRoutes.js"
const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');

router.get(['/', '/restaurants'], restaurantController.getAllRestaurants);
router.get(['/:id', '/restaurants/:id'], restaurantController.getRestaurantById);
router.post(['/', '/restaurants'], restaurantController.createRestaurant);

module.exports = router;
EOF

    cat <<EOF > "${SERVICE_DIR}/server.js"
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const { connectRabbitMQ } = require('./src/rabbitmq');
const restaurantRoutes = require('./src/routes/restaurantRoutes');

const app = express();
const PORT = process.env.PORT || ${PORT};
const SERVICE_NAME = '${SERVICE_NAME}';
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

if (MONGO_URI && !MONGO_URI.includes('<username>')) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log(\`[\${SERVICE_NAME}] Đã kết nối thành công MongoDB Atlas\`))
    .catch((err) => console.error(\`[\${SERVICE_NAME}] Lỗi kết nối MongoDB:\`, err.message));
}

connectRabbitMQ();

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use(['/restaurants', '/api/v1/restaurants', '/'], restaurantRoutes);

app.listen(PORT, () => {
  console.log(\`[\${new Date().toISOString()}] \${SERVICE_NAME} đang chạy tại cổng \${PORT}\`);
});
EOF

  # ============================================================================
  # SERVICE: order-service
  # ============================================================================
  elif [ "${SERVICE_NAME}" = "order-service" ]; then
    cat <<'EOF' > "${SERVICE_DIR}/src/models/Order.js"
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItemId: { type: String, default: null },
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 }
});

const orderSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true },
    customerId: { type: String, required: true },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Đơn hàng phải có ít nhất 1 món'
      }
    },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'DELIVERING', 'COMPLETED'],
      default: 'PENDING'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
EOF

    cat <<'EOF' > "${SERVICE_DIR}/src/controllers/orderController.js"
const Order = require('../models/Order');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');

exports.createOrder = async (req, res) => {
  try {
    const { restaurantId, customerId, items, totalPrice } = req.body;
    if (!restaurantId || !customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp restaurantId, customerId và items' });
    }

    const calculatedTotal =
      totalPrice || items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);

    const newOrder = new Order({
      restaurantId,
      customerId,
      items,
      totalPrice: calculatedTotal,
      status: 'PENDING'
    });

    const savedOrder = await newOrder.save();
    console.log(`[orderController] 📝 Đã lưu đơn hàng vào MongoDB: ${savedOrder._id}`);

    const eventPayload = {
      orderId: savedOrder._id.toString(),
      restaurantId: savedOrder.restaurantId,
      customerId: savedOrder.customerId,
      items: savedOrder.items,
      totalPrice: savedOrder.totalPrice,
      status: savedOrder.status,
      createdAt: savedOrder.createdAt
    };

    try {
      await publishEvent(DEFAULT_EXCHANGE, 'order.created', eventPayload);
    } catch (eventError) {
      console.warn('[orderController] ⚠️ RabbitMQ:', eventError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Tạo đơn hàng thành công và đã phát sự kiện order.created!',
      data: savedOrder
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: `Không tìm thấy đơn hàng ID: ${id}` });
    }
    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
EOF

    cat <<'EOF' > "${SERVICE_DIR}/src/routes/orderRoutes.js"
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.post(['/', '/orders'], orderController.createOrder);
router.get(['/', '/orders'], orderController.getAllOrders);
router.get(['/:id', '/orders/:id'], orderController.getOrderById);

module.exports = router;
EOF

    cat <<EOF > "${SERVICE_DIR}/server.js"
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const { connectRabbitMQ, consumeEvent, DEFAULT_EXCHANGE } = require('./src/rabbitmq');
const Order = require('./src/models/Order');
const orderRoutes = require('./src/routes/orderRoutes');

const app = express();
const PORT = process.env.PORT || ${PORT};
const SERVICE_NAME = '${SERVICE_NAME}';
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

if (MONGO_URI && !MONGO_URI.includes('<username>')) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log(\`[\${SERVICE_NAME}] Đã kết nối thành công MongoDB Atlas\`))
    .catch((err) => console.error(\`[\${SERVICE_NAME}] Lỗi kết nối MongoDB:\`, err.message));
}

connectRabbitMQ().then(() => {
  consumeEvent(
    DEFAULT_EXCHANGE,
    'order_payment_success_queue',
    'payment.success',
    async (paymentData) => {
      try {
        const orderId = paymentData.orderId;
        if (mongoose.isValidObjectId(orderId)) {
          await Order.findByIdAndUpdate(orderId, { status: 'CONFIRMED' });
          console.log(\`[\${SERVICE_NAME}] ✅ Đã cập nhật đơn hàng \${orderId} sang trạng thái CONFIRMED\`);
        }
      } catch (err) {
        console.error(\`[\${SERVICE_NAME}] ❌ Lỗi cập nhật đơn hàng:\`, err.message);
      }
    }
  );
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use(['/orders', '/api/v1/orders', '/'], orderRoutes);

app.listen(PORT, () => {
  console.log(\`[\${new Date().toISOString()}] \${SERVICE_NAME} đang chạy tại cổng \${PORT}\`);
});
EOF

  # ============================================================================
  # SERVICE: payment-service
  # ============================================================================
  elif [ "${SERVICE_NAME}" = "payment-service" ]; then
    cat <<'EOF' > "${SERVICE_DIR}/src/models/Payment.js"
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, default: 'VNPAY_QR' },
    status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
    transactionId: { type: String, required: true, unique: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
EOF

    cat <<'EOF' > "${SERVICE_DIR}/src/controllers/paymentController.js"
const Payment = require('../models/Payment');

exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: payments.length, data: payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPaymentByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ success: false, message: `Không tìm thấy thanh toán cho đơn: ${orderId}` });
    }
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
EOF

    cat <<'EOF' > "${SERVICE_DIR}/src/routes/paymentRoutes.js"
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get(['/', '/payments'], paymentController.getAllPayments);
router.get(['/order/:orderId', '/payments/order/:orderId'], paymentController.getPaymentByOrderId);

module.exports = router;
EOF

    cat <<EOF > "${SERVICE_DIR}/server.js"
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const { connectRabbitMQ, publishEvent, consumeEvent, DEFAULT_EXCHANGE } = require('./src/rabbitmq');
const Payment = require('./src/models/Payment');
const paymentRoutes = require('./src/routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || ${PORT};
const SERVICE_NAME = '${SERVICE_NAME}';
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

if (MONGO_URI && !MONGO_URI.includes('<username>')) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log(\`[\${SERVICE_NAME}] Đã kết nối thành công MongoDB Atlas\`))
    .catch((err) => console.error(\`[\${SERVICE_NAME}] Lỗi kết nối MongoDB:\`, err.message));
}

connectRabbitMQ().then(() => {
  consumeEvent(
    DEFAULT_EXCHANGE,
    'payment_order_created_queue',
    'order.created',
    async (orderData) => {
      try {
        const orderId = orderData._id || orderData.orderId;
        const amount = orderData.totalPrice || orderData.amount || 0;
        const transactionId = \`TXN-\${Date.now()}-\${Math.floor(1000 + Math.random() * 9000)}\`;

        let savedPayment = null;
        if (mongoose.connection.readyState === 1) {
          const payment = new Payment({
            orderId: orderId.toString(),
            amount: Number(amount),
            paymentMethod: orderData.paymentMethod || 'VNPAY_QR',
            status: 'SUCCESS',
            transactionId
          });
          savedPayment = await payment.save();
          console.log(\`[\${SERVICE_NAME}] 💾 Đã lưu thanh toán vào MongoDB: \${savedPayment._id}\`);
        } else {
          savedPayment = {
            orderId: orderId.toString(),
            amount: Number(amount),
            paymentMethod: 'VNPAY_QR',
            status: 'SUCCESS',
            transactionId
          };
        }

        const paymentSuccessPayload = {
          paymentId: savedPayment._id ? savedPayment._id.toString() : transactionId,
          orderId: savedPayment.orderId,
          amount: savedPayment.amount,
          paymentMethod: savedPayment.paymentMethod,
          status: 'SUCCESS',
          transactionId: savedPayment.transactionId,
          paidAt: new Date().toISOString()
        };

        console.log(\`[\${SERVICE_NAME}] 💰 Thanh toán THÀNH CÔNG cho đơn [\${orderId}], phát sự kiện payment.success\`);
        await publishEvent(DEFAULT_EXCHANGE, 'payment.success', paymentSuccessPayload);
      } catch (err) {
        console.error(\`[\${SERVICE_NAME}] ❌ Lỗi xử lý thanh toán:\`, err.message);
      }
    }
  );
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use(['/payments', '/api/v1/payments', '/'], paymentRoutes);

app.listen(PORT, () => {
  console.log(\`[\${new Date().toISOString()}] \${SERVICE_NAME} đang chạy tại cổng \${PORT}\`);
});
EOF

  # ============================================================================
  # SERVICE: delivery-service
  # ============================================================================
  elif [ "${SERVICE_NAME}" = "delivery-service" ]; then
    cat <<'EOF' > "${SERVICE_DIR}/src/models/Delivery.js"
const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    driverName: { type: String, default: null },
    status: {
      type: String,
      enum: ['FINDING_DRIVER', 'PICKING_UP', 'DELIVERING', 'DELIVERED'],
      default: 'FINDING_DRIVER'
    },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Delivery', deliverySchema);
EOF

    cat <<'EOF' > "${SERVICE_DIR}/src/controllers/deliveryController.js"
const Delivery = require('../models/Delivery');

exports.getDeliveryByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const delivery = await Delivery.findOne({ orderId }).sort({ createdAt: -1 });
    if (!delivery) {
      return res.status(404).json({ success: false, message: `Chưa có lộ trình giao cho đơn: ${orderId}` });
    }
    return res.status(200).json({ success: true, data: delivery });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: deliveries.length, data: deliveries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, driverName } = req.body;
    const updateFields = { updatedAt: new Date() };
    if (status) updateFields.status = status;
    if (driverName) updateFields.driverName = driverName;

    const updated = await Delivery.findOneAndUpdate({ orderId }, updateFields, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: `Không tìm thấy chuyến giao cho đơn: ${orderId}` });
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
EOF

    cat <<'EOF' > "${SERVICE_DIR}/src/routes/deliveryRoutes.js"
const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

router.get(['/order/:orderId', '/deliveries/order/:orderId'], deliveryController.getDeliveryByOrderId);
router.get(['/', '/deliveries'], deliveryController.getAllDeliveries);
router.put(['/order/:orderId/status', '/deliveries/order/:orderId/status'], deliveryController.updateDeliveryStatus);

module.exports = router;
EOF

    cat <<EOF > "${SERVICE_DIR}/server.js"
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const { connectRabbitMQ, consumeEvent, publishEvent, DEFAULT_EXCHANGE } = require('./src/rabbitmq');
const Delivery = require('./src/models/Delivery');
const deliveryRoutes = require('./src/routes/deliveryRoutes');

const app = express();
const PORT = process.env.PORT || ${PORT};
const SERVICE_NAME = '${SERVICE_NAME}';
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

if (MONGO_URI && !MONGO_URI.includes('<username>')) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log(\`[\${SERVICE_NAME}] Đã kết nối thành công MongoDB Atlas\`))
    .catch((err) => console.error(\`[\${SERVICE_NAME}] Lỗi kết nối MongoDB:\`, err.message));
}

connectRabbitMQ().then(() => {
  consumeEvent(
    DEFAULT_EXCHANGE,
    'delivery_payment_success_queue',
    'payment.success',
    async (paymentData) => {
      try {
        const orderId = paymentData.orderId;
        console.log(\`[\${SERVICE_NAME}] 🛵 Nhận payment.success cho đơn [\${orderId}], tạo chuyến giao hàng...\`);

        let savedDelivery = null;
        if (mongoose.connection.readyState === 1) {
          const delivery = new Delivery({
            orderId: orderId.toString(),
            driverName: null,
            status: 'FINDING_DRIVER',
            updatedAt: new Date()
          });
          savedDelivery = await delivery.save();
          console.log(\`[\${SERVICE_NAME}] 💾 Đã lưu chuyến giao hàng vào MongoDB: \${savedDelivery._id}\`);
        } else {
          savedDelivery = {
            orderId: orderId.toString(),
            driverName: null,
            status: 'FINDING_DRIVER',
            updatedAt: new Date()
          };
        }

        console.log(\`[\${SERVICE_NAME}] 🚀 Đã tạo record Delivery cho đơn [\${orderId}] với trạng thái FINDING_DRIVER\`);
        await publishEvent(DEFAULT_EXCHANGE, 'delivery.created', {
          deliveryId: savedDelivery._id ? savedDelivery._id.toString() : \`DEL-\${Date.now()}\`,
          orderId: savedDelivery.orderId,
          status: savedDelivery.status
        });
      } catch (err) {
        console.error(\`[\${SERVICE_NAME}] ❌ Lỗi tạo chuyến giao:\`, err.message);
      }
    }
  );
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use(['/deliveries', '/api/v1/deliveries', '/'], deliveryRoutes);

app.listen(PORT, () => {
  console.log(\`[\${new Date().toISOString()}] \${SERVICE_NAME} đang chạy tại cổng \${PORT}\`);
});
EOF
  fi

  # 3.3. Tạo Dockerfile chuẩn Node 20 Alpine
  cat <<EOF > "${SERVICE_DIR}/Dockerfile"
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE ${PORT}

CMD ["npm", "start"]
EOF

  # 3.4. Tạo .dockerignore cho service
  cat <<EOF > "${SERVICE_DIR}/.dockerignore"
node_modules
npm-debug.log
.env
EOF

  # 3.5. Tạo .env.example cho service
  cat <<EOF > "${SERVICE_DIR}/.env.example"
PORT=${PORT}
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/${DB_NAME}?retryWrites=true&w=majority
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
EOF

  # Tạo sẵn file .env từ .env.example để tiện dev local
  cp "${SERVICE_DIR}/.env.example" "${SERVICE_DIR}/.env"
done

# 4. Khởi tạo API Gateway (Nginx)
echo "🌐 -> Đang tạo API Gateway (Nginx)..."
mkdir -p gateway

cat <<EOF > gateway/Dockerfile
FROM nginx:alpine

# Xóa cấu hình mặc định của Nginx
RUN rm -rf /etc/nginx/conf.d/default.conf

# Sao chép file cấu hình Gateway tùy biến
COPY nginx.conf /etc/nginx/nginx.conf

# Cài đặt curl để hỗ trợ container healthcheck
RUN apk add --no-cache curl

# Mở cổng 80 cho Gateway
EXPOSE 80

# Kiểm tra định kỳ sức khỏe của Gateway
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost/health || exit 1

# Khởi động Nginx
CMD ["nginx", "-g", "daemon off;"]
EOF

cat <<'EOF' > gateway/nginx.conf
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/json;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout  65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

    # Hỗ trợ nâng cấp kết nối WebSocket (Socket.io)
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    # ==========================================================================
    # Cấu hình Upstream cho từng Microservice backend & Frontend Web
    # ==========================================================================
    upstream restaurant_service {
        server restaurant-service:3001;
        keepalive 32;
    }

    upstream order_service {
        server order-service:3002;
        keepalive 32;
    }

    upstream payment_service {
        server payment-service:3003;
        keepalive 32;
    }

    upstream delivery_service {
        server delivery-service:3004;
        keepalive 32;
    }

    upstream frontend_service {
        server frontend:3000;
        keepalive 32;
    }

    server {
        listen 80;
        server_name localhost;

        # ----------------------------------------------------------------------
        # Endpoint kiểm tra sức khỏe của API Gateway
        # ----------------------------------------------------------------------
        location /health {
            default_type application/json;
            return 200 '{"status":"OK","gateway":"nginx-api-gateway","timestamp":"$time_iso8601"}';
        }

        # ----------------------------------------------------------------------
        # 1. Restaurant Service: /api/v1/restaurants/ -> http://restaurant-service:3001/
        # ----------------------------------------------------------------------
        location /api/v1/restaurants/ {
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' '*' always;
                add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
                add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With, Range' always;
                add_header 'Access-Control-Max-Age' 86400;
                add_header 'Content-Type' 'text/plain; charset=utf-8';
                add_header 'Content-Length' 0;
                return 204;
            }

            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With, Range' always;
            add_header 'Access-Control-Expose-Headers' 'Content-Length, Content-Range' always;

            proxy_pass http://restaurant_service/;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_hide_header Access-Control-Allow-Origin;
            proxy_hide_header Access-Control-Allow-Methods;
            proxy_hide_header Access-Control-Allow-Headers;
        }

        location = /api/v1/restaurants {
            return 308 /api/v1/restaurants/;
        }

        # ----------------------------------------------------------------------
        # 2. Order Service: /api/v1/orders/ -> http://order-service:3002/
        # ----------------------------------------------------------------------
        location /api/v1/orders/ {
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' '*' always;
                add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
                add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With, Range' always;
                add_header 'Access-Control-Max-Age' 86400;
                add_header 'Content-Type' 'text/plain; charset=utf-8';
                add_header 'Content-Length' 0;
                return 204;
            }

            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With, Range' always;
            add_header 'Access-Control-Expose-Headers' 'Content-Length, Content-Range' always;

            proxy_pass http://order_service/;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_hide_header Access-Control-Allow-Origin;
            proxy_hide_header Access-Control-Allow-Methods;
            proxy_hide_header Access-Control-Allow-Headers;
        }

        location = /api/v1/orders {
            return 308 /api/v1/orders/;
        }

        # ----------------------------------------------------------------------
        # 3. Payment Service: /api/v1/payments/ -> http://payment-service:3003/
        # ----------------------------------------------------------------------
        location /api/v1/payments/ {
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' '*' always;
                add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
                add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With, Range' always;
                add_header 'Access-Control-Max-Age' 86400;
                add_header 'Content-Type' 'text/plain; charset=utf-8';
                add_header 'Content-Length' 0;
                return 204;
            }

            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With, Range' always;
            add_header 'Access-Control-Expose-Headers' 'Content-Length, Content-Range' always;

            proxy_pass http://payment_service/;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_hide_header Access-Control-Allow-Origin;
            proxy_hide_header Access-Control-Allow-Methods;
            proxy_hide_header Access-Control-Allow-Headers;
        }

        location = /api/v1/payments {
            return 308 /api/v1/payments/;
        }

        # ----------------------------------------------------------------------
        # 4. Delivery Service: /api/v1/deliveries/ -> http://delivery-service:3004/
        # ----------------------------------------------------------------------
        location /api/v1/deliveries/ {
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' '*' always;
                add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
                add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With, Range' always;
                add_header 'Access-Control-Max-Age' 86400;
                add_header 'Content-Type' 'text/plain; charset=utf-8';
                add_header 'Content-Length' 0;
                return 204;
            }

            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin, X-Requested-With, Range' always;
            add_header 'Access-Control-Expose-Headers' 'Content-Length, Content-Range' always;

            proxy_pass http://delivery_service/;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Nâng cấp kết nối WebSocket (Socket.io)
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;

            proxy_hide_header Access-Control-Allow-Origin;
            proxy_hide_header Access-Control-Allow-Methods;
            proxy_hide_header Access-Control-Allow-Headers;
        }

        location = /api/v1/deliveries {
            return 308 /api/v1/deliveries/;
        }

        # ----------------------------------------------------------------------
        # 5. Socket.io Realtime endpoint chuyên dụng cho Delivery Service
        # ----------------------------------------------------------------------
        location /socket.io/ {
            proxy_pass http://delivery_service/socket.io/;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }

        # ----------------------------------------------------------------------
        # 6. Frontend Web: / -> http://frontend:3000/
        # ----------------------------------------------------------------------
        location / {
            proxy_pass http://frontend_service;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }
    }
}
EOF

# 5. Khởi tạo thư mục Frontend (React + Vite + TailwindCSS khung mẫu)
echo "💻 -> Đang tạo khung Frontend (React + Vite + TailwindCSS)..."
mkdir -p frontend/src frontend/public

cat <<EOF > frontend/package.json
{
  "name": "food-delivery-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "lucide-react": "^0.383.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.11"
  }
}
EOF

cat <<EOF > frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  }
});
EOF

cat <<EOF > frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

cat <<EOF > frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

cat <<EOF > frontend/index.html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Food Delivery Cloud</title>
  </head>
  <body class="bg-slate-50 text-slate-900">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

cat <<EOF > frontend/src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

cat <<EOF > frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
EOF

cat <<EOF > frontend/src/App.jsx
import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white">
      <div className="max-w-xl w-full bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700 text-center">
        <h1 className="text-3xl font-bold text-amber-400 mb-2">Food Delivery Cloud</h1>
        <p className="text-slate-400 mb-6">Hệ thống Đặt món ăn trực tuyến Microservices</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">Restaurant: :3001</div>
          <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">Order: :3002</div>
          <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">Payment: :3003</div>
          <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">Delivery: :3004</div>
        </div>
      </div>
    </div>
  );
}
EOF

cat <<EOF > frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
EOF

cat <<EOF > frontend/.env.example
VITE_API_GATEWAY_URL=http://localhost:80/api/v1
EOF

# 6. Khởi tạo thư mục Kubernetes (k8s)
echo "☸️  -> Đang tạo thư mục k8s..."
mkdir -p k8s/base k8s/deployments k8s/services k8s/ingress

cat <<EOF > k8s/README.md
# Kubernetes Manifests cho Food Delivery Cloud

Thư mục này chứa các file cấu hình triển khai Kubernetes:
- \`deployments/\`: Cấu hình Deployment cho từng microservice, rabbitmq, gateway.
- \`services/\`: Cấu hình ClusterIP / NodePort / LoadBalancer.
- \`ingress/\`: Cấu hình Ingress controller phân luồng traffic.
EOF

# 7. Tạo file docker-compose.yml tổng quan
echo "🐳 -> Đang tạo docker-compose.yml..."
cat <<EOF > docker-compose.yml
services:
  # ============================================================================
  # 1. RabbitMQ Message Broker
  # ============================================================================
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    restart: unless-stopped
    ports:
      - "5672:5672"     # AMQP Protocol
      - "15672:15672"   # RabbitMQ Management Web Dashboard
    environment:
      RABBITMQ_DEFAULT_USER: \${RABBITMQ_USER:-guest}
      RABBITMQ_DEFAULT_PASS: \${RABBITMQ_PASS:-guest}
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    networks:
      - food-net

  # ============================================================================
  # 2. Restaurant Service
  # ============================================================================
  restaurant-service:
    build:
      context: ./services/restaurant-service
      dockerfile: Dockerfile
    container_name: restaurant-service
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - MONGO_URI=\${RESTAURANT_MONGO_URI:-mongodb+srv://<username>:<password>@cluster0.mongodb.net/restaurant_db?retryWrites=true&w=majority}
      - RABBITMQ_URL=\${RABBITMQ_URL:-amqp://guest:guest@rabbitmq:5672}
    depends_on:
      rabbitmq:
        condition: service_healthy
    networks:
      - food-net

  # ============================================================================
  # 3. Order Service
  # ============================================================================
  order-service:
    build:
      context: ./services/order-service
      dockerfile: Dockerfile
    container_name: order-service
    restart: unless-stopped
    ports:
      - "3002:3002"
    environment:
      - PORT=3002
      - MONGO_URI=\${ORDER_MONGO_URI:-mongodb+srv://<username>:<password>@cluster0.mongodb.net/order_db?retryWrites=true&w=majority}
      - RABBITMQ_URL=\${RABBITMQ_URL:-amqp://guest:guest@rabbitmq:5672}
    depends_on:
      rabbitmq:
        condition: service_healthy
    networks:
      - food-net

  # ============================================================================
  # 4. Payment Service
  # ============================================================================
  payment-service:
    build:
      context: ./services/payment-service
      dockerfile: Dockerfile
    container_name: payment-service
    restart: unless-stopped
    ports:
      - "3003:3003"
    environment:
      - PORT=3003
      - MONGO_URI=\${PAYMENT_MONGO_URI:-mongodb+srv://<username>:<password>@cluster0.mongodb.net/payment_db?retryWrites=true&w=majority}
      - RABBITMQ_URL=\${RABBITMQ_URL:-amqp://guest:guest@rabbitmq:5672}
    depends_on:
      rabbitmq:
        condition: service_healthy
    networks:
      - food-net

  # ============================================================================
  # 5. Delivery Service
  # ============================================================================
  delivery-service:
    build:
      context: ./services/delivery-service
      dockerfile: Dockerfile
    container_name: delivery-service
    restart: unless-stopped
    ports:
      - "3004:3004"
    environment:
      - PORT=3004
      - MONGO_URI=\${DELIVERY_MONGO_URI:-mongodb+srv://<username>:<password>@cluster0.mongodb.net/delivery_db?retryWrites=true&w=majority}
      - RABBITMQ_URL=\${RABBITMQ_URL:-amqp://guest:guest@rabbitmq:5672}
    depends_on:
      rabbitmq:
        condition: service_healthy
    networks:
      - food-net

  # ============================================================================
  # 6. Frontend Web (React + Vite + TailwindCSS)
  # ============================================================================
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: food-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    networks:
      - food-net

  # ============================================================================
  # 7. API Gateway (Nginx Reverse Proxy)
  # ============================================================================
  gateway:
    build:
      context: ./gateway
      dockerfile: Dockerfile
    container_name: food-gateway
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - restaurant-service
      - order-service
      - payment-service
      - delivery-service
      - frontend
    networks:
      - food-net

networks:
  food-net:
    name: food-net
    driver: bridge
EOF

# 8. Tạo file .env.example ở thư mục gốc
echo "⚙️  -> Đang tạo .env.example gốc..."
cat <<EOF > .env.example
# RabbitMQ Broker Credentials & Connection
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672

# MongoDB Atlas URIs (Database riêng biệt trên cùng cụm Atlas)
RESTAURANT_MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/restaurant_db?retryWrites=true&w=majority
ORDER_MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/order_db?retryWrites=true&w=majority
PAYMENT_MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/payment_db?retryWrites=true&w=majority
DELIVERY_MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/delivery_db?retryWrites=true&w=majority
EOF

# Sao chép .env mẫu sang .env
cp .env.example .env

# 9. Tạo .gitignore gốc
cat <<EOF > .gitignore
node_modules/
.env
dist/
build/
.DS_Store
*.log
EOF

echo "=================================================="
echo "✅ Khởi tạo thành công cấu trúc dự án ${PROJECT_NAME}!"
echo "Để chạy dự án bằng Docker Compose:"
echo "  cd ${PROJECT_NAME}"
echo "  docker compose up --build"
echo "=================================================="
