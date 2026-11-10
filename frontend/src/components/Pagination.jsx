import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Component Phân trang chuẩn FoodFast (Pagination)
 * Hỗ trợ giao diện sáng (Light Mode cho Khách hàng) và giao diện tối (Dark Mode cho Admin/Merchant).
 *
 * @param {number} currentPage - Trang hiện tại (1-based)
 * @param {number} totalPages - Tổng số trang
 * @param {function} onPageChange - Callback khi chuyển trang: (page: number) => void
 * @param {number} [totalItems] - Tổng số phần tử
 * @param {number} [pageSize] - Số phần tử mỗi trang
 * @param {string} [itemLabel='mục'] - Nhãn tên phần tử (quán, món, đơn hàng, mã giảm giá...)
 * @param {'light'|'dark'} [theme='light'] - Theme giao diện
 * @param {boolean} [showDetails=true] - Hiển thị dòng mô tả "Trang x / y"
 * @param {string} [className=''] - Class tùy biến thêm
 */
export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems,
  pageSize,
  itemLabel = 'mục',
  theme = 'light',
  showDetails = true,
  className = ''
}) {
  const safeTotalPages = Math.max(1, totalPages || (totalItems && pageSize ? Math.ceil(totalItems / pageSize) : 1));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  // Không hiển thị nếu chỉ có 1 trang và số lượng phần tử không vượt quá pageSize
  if (safeTotalPages <= 1 && (!totalItems || (pageSize && totalItems <= pageSize))) {
    return null;
  }

  // Thuật toán hiển thị danh sách trang kèm dấu '...' thông minh
  const getPageNumbers = () => {
    const pages = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      if (safeCurrentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', safeTotalPages);
      } else if (safeCurrentPage >= safeTotalPages - 3) {
        pages.push(1, '...', safeTotalPages - 4, safeTotalPages - 3, safeTotalPages - 2, safeTotalPages - 1, safeTotalPages);
      } else {
        pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', safeTotalPages);
      }
    }
    return pages;
  };

  const isDark = theme === 'dark';

  const containerStyles = isDark
    ? 'border-slate-800 text-slate-300'
    : 'border-gray-100 text-gray-700';

  const btnBaseStyles = isDark
    ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-800/80 disabled:cursor-not-allowed'
    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-35 disabled:hover:bg-white disabled:cursor-not-allowed';

  const activeBtnStyles = isDark
    ? 'bg-orange-600 border-orange-500 text-white font-bold shadow-md shadow-orange-600/30'
    : 'bg-[#EE4D2D] border-[#EE4D2D] text-white font-bold shadow-md shadow-red-500/20';

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t ${containerStyles} ${className}`}
    >
      {/* Thông tin mô tả trang & số lượng */}
      {showDetails && (
        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <span>
            Trang <strong className={isDark ? 'text-white' : 'text-gray-900'}>{safeCurrentPage}</strong> /{' '}
            <strong className={isDark ? 'text-white' : 'text-gray-900'}>{safeTotalPages}</strong>
          </span>
          {typeof totalItems === 'number' && (
            <span className="ml-1.5 opacity-90">
              (Tổng <strong>{totalItems}</strong> {itemLabel})
            </span>
          )}
        </div>
      )}

      {/* Các nút điều hướng trang */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
        {/* Nút về trang đầu tiên */}
        {safeTotalPages > 4 && (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage <= 1}
            title="Trang đầu"
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${btnBaseStyles}`}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Nút lùi 1 trang */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          title="Trang trước"
          className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 cursor-pointer ${btnBaseStyles}`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px] font-semibold pr-1">Trước</span>
        </button>

        {/* Danh sách các số trang */}
        {getPageNumbers().map((num, idx) => {
          if (num === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className={`px-2 py-1 text-xs select-none ${isDark ? 'text-slate-500' : 'text-gray-400'}`}
              >
                •••
              </span>
            );
          }

          const isActive = num === safeCurrentPage;
          return (
            <button
              key={`page-${num}`}
              type="button"
              onClick={() => onPageChange(num)}
              className={`min-w-[32px] h-8 px-2 rounded-lg border text-xs transition-all cursor-pointer ${
                isActive ? activeBtnStyles : btnBaseStyles
              }`}
            >
              {num}
            </button>
          );
        })}

        {/* Nút tiến 1 trang */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= safeTotalPages}
          title="Trang sau"
          className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 cursor-pointer ${btnBaseStyles}`}
        >
          <span className="hidden sm:inline text-[11px] font-semibold pl-1">Sau</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Nút đến trang cuối cùng */}
        {safeTotalPages > 4 && (
          <button
            type="button"
            onClick={() => onPageChange(safeTotalPages)}
            disabled={safeCurrentPage >= safeTotalPages}
            title="Trang cuối"
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${btnBaseStyles}`}
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

