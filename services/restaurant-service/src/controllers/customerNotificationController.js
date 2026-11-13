const CustomerNotification = require('../models/CustomerNotification');

/**
 * 1. GET /api/v1/notifications/my-notifications (hoặc /api/v1/customer-notifications)
 * Lấy danh sách thông báo chuông còn hiệu lực (chưa quá 7 ngày và chưa hoàn tất đánh giá)
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = (req.user && (req.user.userId || req.user.id)) || req.query.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để xem thông báo' });
    }

    const now = new Date();
    // Chỉ lấy thông báo còn trong thời hạn 7 ngày và chưa hoàn thành đánh giá
    const filter = {
      userId: String(userId),
      expiresAt: { $gt: now },
      isCompleted: false
    };

    const notifications = await CustomerNotification.find(filter)
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await CustomerNotification.countDocuments({
      ...filter,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải danh sách thông báo: ' + error.message
    });
  }
};

/**
 * 2. PUT /api/v1/notifications/:id/read (hoặc /api/v1/notifications/read-all)
 * Đánh dấu thông báo đã đọc
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user && (req.user.userId || req.user.id);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập' });
    }

    if (id === 'all' || req.path.includes('read-all')) {
      await CustomerNotification.updateMany(
        { userId: String(userId), isRead: false },
        { $set: { isRead: true } }
      );
      return res.status(200).json({
        success: true,
        message: 'Đã đánh dấu đã đọc tất cả thông báo'
      });
    }

    const notif = await CustomerNotification.findOneAndUpdate(
      { _id: id, userId: String(userId) },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notif) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu đã đọc thông báo',
      data: notif
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật trạng thái thông báo: ' + error.message
    });
  }
};

/**
 * 3. DELETE /api/v1/notifications/:id
 * Xóa thông báo khỏi danh sách chuông của người dùng
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user && (req.user.userId || req.user.id);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập' });
    }

    const deleted = await CustomerNotification.findOneAndDelete({
      _id: id,
      userId: String(userId)
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo để xóa' });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa thông báo thành công'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi xóa thông báo: ' + error.message
    });
  }
};

