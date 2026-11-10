const { consumeEvent } = require('../rabbitmq');
const Voucher = require('../models/Voucher');
const { setQuota } = require('../../redis');
const { emitStoreUpdate, broadcastAdminEvent } = require('../utils/realtimeHub');

/**
 * Worker tự động tặng Voucher khi có Review (Event-Driven qua RabbitMQ)
 * Queue: q.voucher_incentive
 * Routing Key: review.submitted
 * Exchange: foodfast_events (kèm fallback food_order_topic)
 */
async function startVoucherIncentiveWorker() {
  console.log('[Voucher Worker] 🚀 Đang khởi động Voucher Incentive Worker lắng nghe [review.submitted]...');

  const handleReviewEvent = async (data) => {
    try {
      const { user_id, store_id, rating, review_id } = data;
      const numRating = Number(rating);

      console.log(`[Voucher Worker] 🔔 Nhận sự kiện review.submitted: Đánh giá ${numRating} sao từ user [${user_id}] cho quán [${store_id}]`);

      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Trường hợp 1: rating <= 2 (Đánh giá thấp / Không hài lòng) -> Tặng voucher SORRY-XXXXXX giảm 20%
      if (numRating <= 2) {
        const voucherCode = `SORRY-${randomSuffix}`;
        const newVoucher = new Voucher({
          code: voucherCode,
          title: 'FoodFast & Quán chân thành xin lỗi - Giảm 20% cho đơn tiếp theo',
          issuer_type: 'STORE',
          store_id: store_id || null,
          user_id: user_id || null,
          discount_type: 'PERCENTAGE',
          discount_value: 20,
          max_discount_amount: 50000,
          min_order_value: 0,
          usage_limit: 1,
          used_count: 0,
          is_active: true
        });

        await newVoucher.save();
        await setQuota(`voucher:quota:${voucherCode}`, 1);
        emitStoreUpdate({ storeId: store_id ? String(store_id) : null, event: 'voucher.updated', extra: { code: voucherCode } });
        console.log(`[Voucher Worker] 🎁 ĐÃ TẶNG VOUCHER ĐỀN BÙ [${voucherCode}] giảm 20% cho user [${user_id}]`);
      }
      // Trường hợp 2: rating === 5 (Đánh giá 5 sao khen ngợi) -> Tặng voucher THANKYOU-XXXXXX giảm 10%
      else if (numRating === 5) {
        const voucherCode = `THANKYOU-${randomSuffix}`;
        const newVoucher = new Voucher({
          code: voucherCode,
          title: 'Tri ân đánh giá 5 sao - Giảm 10% cho đơn kế tiếp',
          issuer_type: 'STORE',
          store_id: store_id || null,
          user_id: user_id || null,
          discount_type: 'PERCENTAGE',
          discount_value: 10,
          max_discount_amount: 30000,
          min_order_value: 0,
          usage_limit: 1,
          used_count: 0,
          is_active: true
        });

        await newVoucher.save();
        await setQuota(`voucher:quota:${voucherCode}`, 1);
        emitStoreUpdate({ storeId: store_id ? String(store_id) : null, event: 'voucher.updated', extra: { code: voucherCode } });
        console.log(`[Voucher Worker] 🌟 ĐÃ TẶNG VOUCHER TRI ÂN [${voucherCode}] giảm 10% cho user [${user_id}]`);
      }
    } catch (err) {
      console.error('[Voucher Worker] ❌ Lỗi xử lý tặng voucher tự động:', err.message);
    }
  };

  // Đăng ký consumer lắng nghe hàng đợi q.voucher_incentive
  try {
    await consumeEvent('foodfast_events', 'q.voucher_incentive', 'review.submitted', handleReviewEvent);
  } catch (err) {
    console.warn('[Voucher Worker] Fallback sang exchange mặc định:', err.message);
    await consumeEvent(undefined, 'q.voucher_incentive', 'review.submitted', handleReviewEvent);
  }
}

/**
 * Worker lắng nghe các sự kiện đơn hàng từ order-service / delivery-service qua RabbitMQ
 * để phát sóng SSE Realtime ngay lập tức về Dashboard của Chủ quán & Admin.
 */
async function startRealtimeOrderRelayWorker() {
  const handleOrderRelayEvent = async (data) => {
    try {
      const storeId = data?.restaurantId || data?.store_id || null;
      if (storeId) {
        emitStoreUpdate({
          storeId: String(storeId),
          event: 'order.updated',
          extra: {
            orderId: data?.orderId || data?._id,
            status: data?.status || data?.newStatus
          }
        });
      } else {
        broadcastAdminEvent('order.updated', data);
      }
    } catch {}
  };

  for (const routingKey of ['order.created', 'order.status_updated', 'order.completed', 'delivery.completed']) {
    try {
      await consumeEvent(undefined, `q.restaurant_rt_${routingKey.replace(/\./g, '_')}`, routingKey, handleOrderRelayEvent);
    } catch {}
  }
}

module.exports = {
  startVoucherIncentiveWorker,
  startRealtimeOrderRelayWorker
};

