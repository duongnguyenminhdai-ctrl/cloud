const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Tải ảnh lên Cloudinary CDN
 * @param {string} fileOrBase64 - Đường dẫn file, URL hoặc Data URI Base64 (data:image/...)
 * @param {object} options - Cấu hình tải lên (folder, tags, transformations)
 * @returns {Promise<{url: string, secure_url: string, public_id: string, format: string}>}
 */
async function uploadToCloudinary(fileOrBase64, options = {}) {
  const {
    folder = 'foodfast',
    tags = ['foodfast'],
    resource_type = 'auto'
  } = options;

  if (!fileOrBase64) {
    throw new Error('Không có dữ liệu ảnh để tải lên Cloudinary');
  }

  // Nếu đã là link Cloudinary hoặc link web https hợp lệ, không cần tải lại
  if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('https://res.cloudinary.com/')) {
    return {
      url: fileOrBase64,
      secure_url: fileOrBase64,
      public_id: ''
    };
  }

  const result = await cloudinary.uploader.upload(fileOrBase64, {
    folder,
    tags,
    resource_type,
    transformation: [
      { quality: 'auto:good', fetch_format: 'auto' } // Tự động tối ưu dung lượng WebP/AVIF
    ]
  });

  return {
    url: result.url,
    secure_url: result.secure_url,
    public_id: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format
  };
}

/**
 * Xóa ảnh khỏi Cloudinary qua Public ID hoặc URL
 */
async function deleteFromCloudinary(publicIdOrUrl) {
  if (!publicIdOrUrl) return null;
  try {
    let publicId = publicIdOrUrl;
    if (publicIdOrUrl.includes('cloudinary.com')) {
      const parts = publicIdOrUrl.split('/upload/');
      if (parts.length > 1) {
        const pathAfterUpload = parts[1].replace(/^v\d+\//, '');
        publicId = pathAfterUpload.substring(0, pathAfterUpload.lastIndexOf('.')) || pathAfterUpload;
      }
    }
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[Cloudinary] Không thể xóa ảnh:', err.message);
    return null;
  }
}

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary
};
