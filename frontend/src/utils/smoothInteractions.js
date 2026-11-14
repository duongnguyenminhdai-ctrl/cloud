/**
 * FoodFast Smooth Interactions & Ink Ripple System
 * Cung cấp hiệu ứng phản hồi xúc giác (tactile micro-interactions) và
 * hiệu ứng sóng loang mực thủy mặc (Water Ink Ripple) khi click vào bất kỳ nút bấm nào trên toàn bộ website.
 */

export function initSmoothInteractions() {
  if (typeof window === 'undefined') return;

  // Lắng nghe sự kiện click/pointerdown toàn cục cho hiệu ứng Ripple xúc giác
  document.addEventListener('pointerdown', (e) => {
    // Chỉ kích hoạt khi click chuột trái hoặc chạm ngón tay
    if (e.button !== 0) return;

    // Tìm phần tử có tính tương tác gần nhất
    const target = e.target.closest(
      'button, a[role="button"], [role="button"], .sketch-btn-primary, .sketch-btn-secondary, .sketch-card, .interactive-tap'
    );
    if (!target) return;

    // Không tạo ripple cho các nút disabled hoặc các nút cố tình tắt ripple
    if (target.disabled || target.getAttribute('aria-disabled') === 'true' || target.classList.contains('no-ripple')) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'foodfast-ink-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    // Đảm bảo target có position tương đối và overflow ẩn để giữ ripple gọn gàng
    const computedStyle = window.getComputedStyle(target);
    if (computedStyle.position === 'static') {
      target.style.position = 'relative';
    }
    target.classList.add('has-foodfast-ripple');
    target.appendChild(ripple);

    // Tự động dọn dẹp sau khi animation kết thúc (500ms)
    setTimeout(() => {
      ripple.remove();
      if (!target.querySelector('.foodfast-ink-ripple')) {
        target.classList.remove('has-foodfast-ripple');
      }
    }, 550);
  }, { passive: true });
}

