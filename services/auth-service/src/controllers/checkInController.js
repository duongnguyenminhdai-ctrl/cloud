const mongoose = require('mongoose');
const User = require('../models/User');
const DailyCheckIn = require('../models/DailyCheckIn');

/**
 * Trích xuất ngày giờ chuẩn theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 */
function getVietnamTime() {
  const now = new Date();
  const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // 'YYYY-MM-DD'
  const [year, month, day] = vnDateStr.split('-').map(Number);
  const monthYear = `${year}-${String(month).padStart(2, '0')}`;
  return {
    year,
    month,
    day,
    monthYear,
    dateStr: vnDateStr,
    now
  };
}

/**
 * Lấy số ngày trong tháng chuẩn (tháng 31 ngày, 30 ngày, tháng 2 nhuận/thường)
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Lấy thứ của ngày 1 trong tháng (0 = Chủ Nhật, 1 = Thứ Hai, ..., 6 = Thứ Bảy)
 */
function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * Lấy chuỗi YYYY-MM-DD của ngày hôm qua
 */
function getYesterdayDateStr(todayDateStr) {
  const d = new Date(todayDateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Lấy YYYY-MM-DD từ một đối tượng Date theo giờ VN
 */
function toVNDateStr(dateObj) {
  if (!dateObj) return null;
  return new Date(dateObj).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// Cấu hình các mốc quà tích lũy trong tháng
const MILESTONE_CONFIG = {
  3: { type: 'COINS', amount: 500, label: '+500 Xu' },
  7: { type: 'COINS', amount: 1000, label: '+1.000 Xu' },
  14: { type: 'COINS', amount: 2000, label: '+2.000 Xu' },
  25: { type: 'VOUCHER', voucherCode: 'GIAM30K', label: 'Voucher GIAM30K (Giảm 30K)' }
};

/**
 * 1. GET /api/v1/auth/checkin/status
 * Lấy toàn bộ thông tin bảng điểm danh tháng hiện tại của người dùng
 */
exports.getCheckInStatus = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    const vn = getVietnamTime();
    const daysInMonth = getDaysInMonth(vn.year, vn.month);
    const firstDayOfWeek = getFirstDayOfWeek(vn.year, vn.month);

    // Tìm hoặc tạo bản ghi điểm danh tháng hiện tại
    let checkInDoc = await DailyCheckIn.findOne({ userId, monthYear: vn.monthYear });
    if (!checkInDoc) {
      checkInDoc = await DailyCheckIn.create({
        userId,
        monthYear: vn.monthYear,
        checkedInDays: [],
        currentStreak: 0,
        highestStreak: 0,
        claimedMilestones: []
      });
    }

    // Kiểm tra xem hôm nay đã điểm danh chưa
    const lastCheckInStr = toVNDateStr(checkInDoc.lastCheckInDate);
    const isCheckedInToday = checkInDoc.checkedInDays.includes(vn.day) || lastCheckInStr === vn.dateStr;

    // Tính streak dự kiến hôm nay nếu điểm danh
    const yesterdayStr = getYesterdayDateStr(vn.dateStr);
    let nextStreak = 1;
    if (lastCheckInStr === yesterdayStr) {
      nextStreak = checkInDoc.currentStreak + 1;
    } else if (lastCheckInStr === vn.dateStr) {
      nextStreak = checkInDoc.currentStreak;
    }

    // Thưởng xu dự kiến: Ngày 1-7 là 500 xu, ngày > 7 (streak trên 7 ngày) là 1000 xu
    const rewardIfCheckIn = nextStreak > 7 ? 1000 : 500;

    // Lấy số xu hiện tại của User
    const user = await User.findById(userId).select('coins name avatar');

    return res.status(200).json({
      success: true,
      data: {
        monthYear: vn.monthYear,
        year: vn.year,
        month: vn.month,
        todayDay: vn.day,
        todayDateStr: vn.dateStr,
        daysInMonth,
        firstDayOfWeek, // 0 = CN, 1 = T2, ...
        checkedInDays: checkInDoc.checkedInDays,
        totalCheckedInDays: checkInDoc.checkedInDays.length,
        currentStreak: checkInDoc.currentStreak,
        highestStreak: checkInDoc.highestStreak,
        isCheckedInToday,
        claimedMilestones: checkInDoc.claimedMilestones,
        milestonesConfig: MILESTONE_CONFIG,
        rewardIfCheckIn,
        userCoins: user?.coins || 0
      }
    });
  } catch (error) {
    console.error('[CheckIn] Lỗi lấy trạng thái điểm danh:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy dữ liệu điểm danh' });
  }
};

/**
 * 2. POST /api/v1/auth/checkin/claim-daily
 * Thực hiện điểm danh ngày hôm nay
 */
exports.claimDailyCheckIn = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    const vn = getVietnamTime();
    let checkInDoc = await DailyCheckIn.findOne({ userId, monthYear: vn.monthYear });
    if (!checkInDoc) {
      checkInDoc = new DailyCheckIn({
        userId,
        monthYear: vn.monthYear,
        checkedInDays: [],
        currentStreak: 0,
        highestStreak: 0,
        claimedMilestones: []
      });
    }

    const lastCheckInStr = toVNDateStr(checkInDoc.lastCheckInDate);

    // Chặn điểm danh trùng nếu hôm nay đã điểm danh
    if (checkInDoc.checkedInDays.includes(vn.day) || lastCheckInStr === vn.dateStr) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã điểm danh ngày hôm nay rồi! Hãy quay lại vào ngày mai nhé.'
      });
    }

    // Tính toán chuỗi điểm danh liên tục (Streak)
    const yesterdayStr = getYesterdayDateStr(vn.dateStr);
    let newStreak = 1;
    if (lastCheckInStr === yesterdayStr) {
      newStreak = (checkInDoc.currentStreak || 0) + 1;
    } else {
      newStreak = 1; // Đứt chuỗi, bắt đầu lại chuỗi mới
    }

    // Quy tắc thưởng Xu:
    // Ngày 1 - 7: nhận 500 Xu / ngày
    // Streak trên 7 ngày (từ ngày thứ 8 trở đi): nhận 1.000 Xu / ngày
    const rewardCoins = newStreak > 7 ? 1000 : 500;

    // Cập nhật bản ghi điểm danh
    if (!checkInDoc.checkedInDays.includes(vn.day)) {
      checkInDoc.checkedInDays.push(vn.day);
      checkInDoc.checkedInDays.sort((a, b) => a - b);
    }
    checkInDoc.currentStreak = newStreak;
    if (newStreak > (checkInDoc.highestStreak || 0)) {
      checkInDoc.highestStreak = newStreak;
    }
    checkInDoc.lastCheckInDate = vn.now;
    checkInDoc.totalCoinsEarned = (checkInDoc.totalCoinsEarned || 0) + rewardCoins;
    await checkInDoc.save();

    // Tăng số xu cho User trong DB thật
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: rewardCoins } },
      { new: true }
    ).select('coins name');

    return res.status(200).json({
      success: true,
      message: `Điểm danh thành công ngày ${vn.day}! Nhận ngay +${rewardCoins.toLocaleString('vi-VN')} Xu FoodFast.`,
      data: {
        rewardCoins,
        currentStreak: newStreak,
        totalCheckedInDays: checkInDoc.checkedInDays.length,
        checkedInDays: checkInDoc.checkedInDays,
        todayDay: vn.day,
        newCoinsBalance: updatedUser?.coins || 0
      }
    });
  } catch (error) {
    console.error('[CheckIn] Lỗi thực hiện điểm danh:', error.message);
    return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi điểm danh' });
  }
};

/**
 * 3. POST /api/v1/auth/checkin/claim-milestone
 * Nhận phần thưởng theo mốc (3 ngày, 7 ngày, 14 ngày, 25 ngày)
 */
exports.claimMilestoneReward = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    const { milestone } = req.body;
    const targetMilestone = Number(milestone);
    const config = MILESTONE_CONFIG[targetMilestone];

    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Mốc thưởng không hợp lệ. Các mốc hợp lệ: 3, 7, 14, 25 ngày.'
      });
    }

    const vn = getVietnamTime();
    const checkInDoc = await DailyCheckIn.findOne({ userId, monthYear: vn.monthYear });
    if (!checkInDoc) {
      return res.status(400).json({
        success: false,
        message: 'Bạn chưa có dữ liệu điểm danh tháng này.'
      });
    }

    const totalDays = checkInDoc.checkedInDays.length;
    if (totalDays < targetMilestone) {
      return res.status(400).json({
        success: false,
        message: `Chưa đạt điều kiện nhận thưởng. Bạn đã điểm danh ${totalDays}/${targetMilestone} ngày.`
      });
    }

    if (checkInDoc.claimedMilestones.includes(targetMilestone)) {
      return res.status(400).json({
        success: false,
        message: `Bạn đã nhận phần thưởng mốc ${targetMilestone} ngày của tháng này rồi!`
      });
    }

    let rewardMessage = '';
    let updatedCoins = 0;

    if (config.type === 'COINS') {
      const rewardCoins = config.amount;
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { coins: rewardCoins } },
        { new: true }
      ).select('coins');
      updatedCoins = user?.coins || 0;
      rewardMessage = `Chúc mừng bạn đã nhận thưởng mốc ${targetMilestone} ngày: +${rewardCoins.toLocaleString('vi-VN')} Xu FoodFast!`;
    } else if (config.type === 'VOUCHER') {
      // Mốc 25 ngày: Mở khóa Voucher GIAM30K độc quyền
      rewardMessage = `🎉 Chúc mừng bạn đã mở khóa thành công Voucher GIAM30K (Giảm ngay 30.000đ khi đặt món)!`;
      const user = await User.findById(userId).select('coins');
      updatedCoins = user?.coins || 0;
    }

    // Đánh dấu mốc đã nhận
    checkInDoc.claimedMilestones.push(targetMilestone);
    checkInDoc.claimedMilestones.sort((a, b) => a - b);
    await checkInDoc.save();

    return res.status(200).json({
      success: true,
      message: rewardMessage,
      data: {
        claimedMilestone: targetMilestone,
        claimedMilestones: checkInDoc.claimedMilestones,
        newCoinsBalance: updatedCoins,
        rewardType: config.type,
        voucherCode: config.voucherCode || null
      }
    });
  } catch (error) {
    console.error('[CheckIn] Lỗi nhận quà mốc:', error.message);
    return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi nhận thưởng mốc' });
  }
};

/**
 * 4. GET /api/v1/auth/checkin/verify-giam30k-eligibility
 * API nội bộ / verify kiểm tra xem user có đủ điều kiện dùng voucher GIAM30K không
 * (Chỉ người đã nhận mốc 25 ngày điểm danh mới có quyền áp dụng)
 */
exports.verifyGiam30kEligibility = async (req, res) => {
  try {
    const targetUserId = req.query.userId || req.user?.userId || req.user?.id;
    if (!targetUserId) {
      return res.status(200).json({ eligible: false });
    }

    const vn = getVietnamTime();
    // Kiểm tra xem trong tháng này (hoặc bất kỳ tháng nào gần đây) user đã nhận mốc 25 chưa
    const checkInDoc = await DailyCheckIn.findOne({
      userId: targetUserId,
      claimedMilestones: 25
    });

    return res.status(200).json({
      success: true,
      eligible: Boolean(checkInDoc)
    });
  } catch (error) {
    return res.status(200).json({ eligible: false });
  }
};
