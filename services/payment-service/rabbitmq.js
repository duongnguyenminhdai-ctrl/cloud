const amqp = require('amqplib');

const DEFAULT_EXCHANGE = 'food_order_topic';
const DEFAULT_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

let connection = null;
let channel = null;
let isConnecting = false;
let currentUrl = DEFAULT_URL;
let reconnectTimer = null;

// Danh sách lưu trữ các consumer đã đăng ký để tự động bind lại khi reconnect
const registeredConsumers = [];

/**
 * Che giấu thông tin mật khẩu trong URL khi log ra console
 */
function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '******';
    return u.toString();
  } catch {
    return url.replace(/:([^:@]+)@/, ':******@');
  }
}

/**
 * 1. Kết nối RabbitMQ / CloudAMQP với hỗ trợ amqps:// (TLS/SSL) và auto-reconnect
 * @param {string} url - Chuỗi kết nối RabbitMQ AMQP / AMQPS
 * @returns {Promise<{connection: any, channel: any}>}
 */
async function connectRabbitMQ(url = DEFAULT_URL) {
  if (connection && channel) {
    return { connection, channel };
  }

  if (isConnecting) {
    // Đang trong tiến trình kết nối, chờ kết nối xong
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (connection && channel) {
          clearInterval(checkInterval);
          resolve({ connection, channel });
        }
      }, 500);
    });
  }

  currentUrl = url || process.env.RABBITMQ_URL || DEFAULT_URL;
  isConnecting = true;

  try {
    const isCloudAMQPS = currentUrl.startsWith('amqps://');
    console.log(`[RabbitMQ] ⏳ Đang kết nối tới ${isCloudAMQPS ? 'CloudAMQP (TLS amqps)' : 'RabbitMQ'}: ${maskUrl(currentUrl)}...`);

    // Tùy chọn kết nối tối ưu cho CloudAMQP (heartbeat 60s giữ kết nối qua NAT/Load Balancer)
    const connectOptions = {
      heartbeat: 60,
      clientProperties: {
        connection_name: `food-delivery-service-${process.pid}`
      }
    };

    connection = await amqp.connect(currentUrl, connectOptions);

    connection.on('error', (err) => {
      console.error('[RabbitMQ] ⚠️ Lỗi kết nối (Connection Error):', err.message);
    });

    connection.on('close', () => {
      console.warn('[RabbitMQ] 🔌 Mất kết nối tới RabbitMQ/CloudAMQP! Sẽ tự động kết nối lại sau 5 giây...');
      connection = null;
      channel = null;
      isConnecting = false;

      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectRabbitMQ(currentUrl).catch(() => {});
        }, 5000);
      }
    });

    channel = await connection.createChannel();
    channel.prefetch(1); // Fair dispatch: mỗi consumer chỉ xử lý 1 message tại một thời điểm

    channel.on('error', (err) => {
      console.error('[RabbitMQ] ⚠️ Lỗi kênh (Channel Error):', err.message);
    });

    channel.on('close', () => {
      console.warn('[RabbitMQ] ⚠️ Channel bị đóng.');
      channel = null;
    });

    console.log('[RabbitMQ] ✅ Kết nối thành công tới Message Broker & đã khởi tạo Channel!');
    isConnecting = false;

    // Tự động khôi phục lại các consumer đã đăng ký trước đó
    for (const consumer of registeredConsumers) {
      await setupConsumer(consumer);
    }

    return { connection, channel };
  } catch (error) {
    console.error(`[RabbitMQ] ❌ Kết nối thất bại (${maskUrl(currentUrl)}): ${error.message}. Đang thử lại sau 5 giây...`);
    connection = null;
    channel = null;
    isConnecting = false;

    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectRabbitMQ(currentUrl).catch(() => {});
      }, 5000);
    }

    return { connection: null, channel: null };
  }
}

/**
 * Lấy channel hiện tại hoặc kích hoạt kết nối nếu chưa có
 */
async function getChannel() {
  if (!channel) {
    await connectRabbitMQ(currentUrl);
  }
  if (!channel) {
    throw new Error('[RabbitMQ] Chưa thể lấy Channel do chưa kết nối được tới server.');
  }
  return channel;
}

/**
 * 2. Bắn (publish) sự kiện lên RabbitMQ Exchange (Topic)
 * @param {string} exchange - Tên exchange (mặc định: food_order_topic)
 * @param {string} routingKey - Routing key của sự kiện (ví dụ: order.created)
 * @param {object} data - Dữ liệu sự kiện
 * @returns {Promise<boolean>}
 */
async function publishEvent(exchange = DEFAULT_EXCHANGE, routingKey, data) {
  try {
    const ch = await getChannel();

    // Khởi tạo exchange dạng topic, bền vững (durable: true)
    await ch.assertExchange(exchange, 'topic', { durable: true });

    const payload = Buffer.from(JSON.stringify(data));
    const published = ch.publish(exchange, routingKey, payload, {
      persistent: true, // Tin nhắn lưu trên disk phòng khi broker restart
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

/**
 * Thiết lập lắng nghe message trong queue
 */
async function setupConsumer({ exchange, queueName, routingKey, callback }) {
  try {
    const ch = await getChannel();

    // Đảm bảo exchange tồn tại
    await ch.assertExchange(exchange, 'topic', { durable: true });

    // Tạo queue bền vững
    const q = await ch.assertQueue(queueName, { durable: true });

    // Bind queue với exchange thông qua routingKey
    await ch.bindQueue(q.queue, exchange, routingKey);

    console.log(`[RabbitMQ] 📥 Đã đăng ký lắng nghe Queue [${queueName}] với RoutingKey [${routingKey}]`);

    // Lắng nghe và tiêu thụ message
    await ch.consume(
      q.queue,
      async (msg) => {
        if (!msg) return;

        try {
          const rawContent = msg.content.toString();
          const parsedData = JSON.parse(rawContent);

          console.log(`[RabbitMQ] 📩 [${queueName}] Nhận được tin nhắn [${routingKey}]:`, parsedData);

          // Gọi hàm callback xử lý nghiệp vụ
          await callback(parsedData, msg);

          // Xác nhận xử lý thành công
          ch.ack(msg);
          console.log(`[RabbitMQ] ✅ [${queueName}] Đã xác nhận thành công (ACK) cho [${routingKey}]`);
        } catch (handlerError) {
          console.error(`[RabbitMQ] ❌ [${queueName}] Lỗi xử lý callback cho [${routingKey}]:`, handlerError.message);
          // Gửi NACK, không requeue để tránh lặp vô tận
          ch.nack(msg, false, false);
        }
      },
      { noAck: false } // Bắt buộc gửi ACK thủ công
    );
  } catch (error) {
    console.error(`[RabbitMQ] ❌ Lỗi khi thiết lập consumer cho queue [${queueName}]:`, error.message);
  }
}

/**
 * 3. Lắng nghe (consume) sự kiện từ RabbitMQ Queue
 * @param {string} exchange - Tên exchange (mặc định: food_order_topic)
 * @param {string} queueName - Tên hàng đợi (ví dụ: payment_order_created_queue)
 * @param {string} routingKey - Routing key cần lắng nghe (hỗ trợ wildcard như order.*)
 * @param {Function} callback - Hàm xử lý dữ liệu: async (data, msg) => {}
 */
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
    // Nếu chưa có channel, tiến hành kết nối
    connectRabbitMQ().catch(() => {});
  }
}

module.exports = {
  connectRabbitMQ,
  publishEvent,
  consumeEvent,
  DEFAULT_EXCHANGE
};
