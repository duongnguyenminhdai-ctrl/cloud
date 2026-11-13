/**
 * Global Horizontal Mouse Wheel & Scroll Enhancement for FoodFast
 * Cho phép người dùng dùng bánh xe cuộn chuột (Mouse Wheel) để lướt ngang qua phải/trái siêu nhanh
 * mà không cần phải dùng tay kéo thanh cuộn. Áp dụng tự động cho toàn bộ hệ thống.
 */

export function initGlobalHorizontalWheelScroll() {
  if (typeof window === 'undefined') return () => {};

  const handleGlobalWheel = (e) => {
    // Nếu người dùng đang dùng Touchpad vuốt ngang tự nhiên (deltaX chiếm ưu thế), nhường cho trình duyệt
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (Math.abs(e.deltaY) < 1) return;

    // Tìm container cuộn ngang gần nhất bắt đầu từ thẻ được hover
    let current = e.target;
    while (current && current !== document.body && current !== document.documentElement) {
      // Bỏ qua các phần tử bị vô hiệu hóa
      if (current.hasAttribute('data-no-horizontal-wheel')) {
        current = current.parentElement;
        continue;
      }

      const style = window.getComputedStyle(current);
      const overflowX = style.overflowX;
      const isScrollableX = overflowX === 'auto' || overflowX === 'scroll';

      // Kiểm tra xem phần tử có nội dung tràn ngang thực sự không
      if (isScrollableX && current.scrollWidth > current.clientWidth + 2) {
        const overflowY = style.overflowY;
        const isScrollableY = overflowY === 'auto' || overflowY === 'scroll';
        const hasVerticalScroll = isScrollableY && current.scrollHeight > current.clientHeight + 4;

        // Nếu container là thanh cuộn ngang chuyên biệt (không có cuộn dọc nội bộ),
        // hoặc người dùng đang giữ Shift, hoặc là bảng/danh mục/tabs
        if (!hasVerticalScroll || e.shiftKey || current.classList.contains('overflow-x-auto') || current.classList.contains('overflow-x-scroll')) {
          const maxScrollLeft = current.scrollWidth - current.clientWidth;
          const isScrollingRight = e.deltaY > 0;
          const isScrollingLeft = e.deltaY < 0;

          // Kiểm tra xem container còn có thể cuộn ngang theo hướng đó hay không
          const canScrollRight = isScrollingRight && current.scrollLeft < maxScrollLeft - 1;
          const canScrollLeft = isScrollingLeft && current.scrollLeft > 1;

          if (canScrollRight || canScrollLeft) {
            // Hệ số nhân tốc độ 1.6x giúp lướt nhanh, dứt khoát và mượt mà
            const scrollAmount = e.deltaY * 1.6;
            current.scrollLeft += scrollAmount;

            // Ngăn trang web cuộn dọc khi đang cuộn ngang container
            e.preventDefault();
            return;
          }
          // Nếu đã cuộn hết sang phải/trái, không chặn event để trang web tiếp tục cuộn dọc tự nhiên
        }
      }

      current = current.parentElement;
    }
  };

  // Lắng nghe sự kiện wheel với passive: false để có thể gọi e.preventDefault()
  window.addEventListener('wheel', handleGlobalWheel, { passive: false });

  return () => {
    window.removeEventListener('wheel', handleGlobalWheel);
  };
}
