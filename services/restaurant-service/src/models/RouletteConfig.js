const mongoose = require('mongoose');

const rouletteItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, // Tên món tiêu biểu, VD: "Bún Bò Huế"
  description: { type: String, default: '', trim: true }, // Mô tả ngắn
  image: { type: String, default: '', trim: true }, // URL ảnh
  priceRange: { type: String, default: '', trim: true }, // VD: "35.000đ - 55.000đ"
  rarity: {
    type: String,
    enum: ['COMMON', 'RARE', 'LEGENDARY'],
    default: 'COMMON'
  }, // Độ hiếm: COMMON (<35k), RARE (35k-70k), LEGENDARY (>70k)
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const RouletteConfig = mongoose.model('RouletteConfig',
  new mongoose.Schema({
    items: [rouletteItemSchema],
    updatedBy: { type: String, default: '' }
  }, { timestamps: true })
);

module.exports = RouletteConfig;
