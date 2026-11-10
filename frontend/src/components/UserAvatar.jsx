import React, { useState, useEffect } from 'react';

/**
 * Hiển thị ảnh đại diện người dùng nhất quán trên toàn hệ thống (Navbar, Profile, Modal, Admin).
 * Tự động fallback về chữ cái đầu nếu chưa có ảnh hoặc ảnh lỗi.
 */
export default function UserAvatar({
  src = '',
  name = '',
  fallbackChar = 'U',
  className = 'w-10 h-10 rounded-full text-sm'
}) {
  const [imgError, setImgError] = useState(false);
  const cleanSrc = typeof src === 'string' ? src.trim() : '';

  useEffect(() => {
    setImgError(false);
  }, [cleanSrc]);

  const initial = (name && String(name).trim().charAt(0).toUpperCase()) || fallbackChar;

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {cleanSrc && !imgError ? (
        <img
          src={cleanSrc}
          alt={name || 'Ảnh đại diện'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
