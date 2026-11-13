const { uploadToCloudinary } = require('../utils/cloudinary');

/**
 * POST /api/v1/upload (hoặc /api/v1/restaurants/upload, /api/v1/stores/upload)
 * Nhận ảnh (Base64 hoặc URL), upload lên Cloudinary CDN và trả về HTTPS URL sạch
 */
exports.uploadImage = async (req, res) => {
  try {
    const { image, folder = 'foodfast' } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp dữ liệu ảnh (image) dạng base64 hoặc URL'
      });
    }

    const uploaded = await uploadToCloudinary(image, { folder });

    return res.status(200).json({
      success: true,
      message: 'Tải ảnh lên Cloudinary CDN thành công!',
      data: {
        url: uploaded.secure_url,
        secure_url: uploaded.secure_url,
        public_id: uploaded.public_id,
        format: uploaded.format
      }
    });
  } catch (error) {
    console.error('[UploadController] Lỗi Cloudinary:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải ảnh lên Cloudinary: ' + error.message
    });
  }
};
