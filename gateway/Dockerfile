FROM nginx:alpine

# Xóa cấu hình mặc định của Nginx
RUN rm -f /etc/nginx/conf.d/default.conf

# Sao chép file cấu hình Gateway tùy biến
COPY nginx.conf /etc/nginx/nginx.conf

# Cài đặt curl để hỗ trợ container healthcheck
RUN apk add --no-cache curl

# Mở cổng 80 cho Gateway
EXPOSE 80

# Kiểm tra định kỳ sức khỏe của Gateway
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Khởi động Nginx ở chế độ foreground
CMD ["nginx", "-g", "daemon off;"]
