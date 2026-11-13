const ALLOWED_IMAGE_MIME_RE = /^image\/(jpeg|jpg|png|webp|gif)$/i;

/**
 * Kiểm tra đường dẫn URL ảnh đại diện hợp lệ (http/https hoặc data:image base64)
 */
export function isValidAvatarSource(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    /^https?:\/\/\S+$/i.test(trimmed) ||
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)
  );
}

/**
 * Nén và thu nhỏ ảnh đại diện phía trình duyệt trước khi gửi lên Backend.
 * Trả về chuỗi Data URL (image/jpeg) nhẹ (~20-60KB) giúp lưu nhanh và mượt.
 */
export function compressAvatarFile(file, options = {}) {
  const { maxSize = 400, quality = 0.85, maxFileBytes = 5 * 1024 * 1024 } = options;

  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Chưa chọn tệp ảnh nào.'));
      return;
    }

    if (!ALLOWED_IMAGE_MIME_RE.test(file.type || '')) {
      reject(new Error('Định dạng không hỗ trợ. Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF.'));
      return;
    }

    if (file.size > maxFileBytes) {
      reject(new Error('Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhẹ hơn.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh từ thiết bị.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Tệp ảnh bị lỗi hoặc không đúng định dạng.'));
      img.onload = () => {
        let width = img.width || maxSize;
        let height = img.height || maxSize;

        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh Canvas.'));
          return;
        }

        // Lót nền trắng nhẹ để ảnh PNG trong suốt không bị nền đen khi xuất JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result;
    };
    reader.readAsDataURL(file);
  });
}

