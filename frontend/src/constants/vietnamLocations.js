/**
 * Danh mục trọn vẹn 63 Tỉnh/Thành phố truyền thống của Việt Nam
 * Ưu tiên 5 thành phố trọng điểm trực thuộc trung ương ở đầu,
 * tiếp theo là 58 tỉnh thành còn lại theo thứ tự bảng chữ cái.
 */
export const VIETNAM_CITIES = [
  // 5 Thành phố lớn trọng điểm
  { code: 'hcm', name: 'TP. Hồ Chí Minh', shortName: 'TP. HCM', isMajor: true, lat: 10.7769, lng: 106.7009 },
  { code: 'hn', name: 'Hà Nội', shortName: 'Hà Nội', isMajor: true, lat: 21.0285, lng: 105.8542 },
  { code: 'dn', name: 'Đà Nẵng', shortName: 'Đà Nẵng', isMajor: true, lat: 16.0544, lng: 108.2022 },
  { code: 'ct', name: 'Cần Thơ', shortName: 'Cần Thơ', isMajor: true, lat: 10.0452, lng: 105.7469 },
  { code: 'hp', name: 'Hải Phòng', shortName: 'Hải Phòng', isMajor: true, lat: 20.8449, lng: 106.6881 },

  // 58 Tỉnh thành còn lại (theo thứ tự A - Z)
  { code: 'angiang', name: 'An Giang', shortName: 'An Giang', lat: 10.5216, lng: 105.1259 },
  { code: 'brvt', name: 'Bà Rịa - Vũng Tàu', shortName: 'Vũng Tàu', lat: 10.5425, lng: 107.2429 },
  { code: 'bacgiang', name: 'Bắc Giang', shortName: 'Bắc Giang', lat: 21.2731, lng: 106.1946 },
  { code: 'backan', name: 'Bắc Kạn', shortName: 'Bắc Kạn', lat: 22.1470, lng: 105.8348 },
  { code: 'baclieu', name: 'Bạc Liêu', shortName: 'Bạc Liêu', lat: 9.2941, lng: 105.7278 },
  { code: 'bacninh', name: 'Bắc Ninh', shortName: 'Bắc Ninh', lat: 21.1861, lng: 106.0763 },
  { code: 'bentre', name: 'Bến Tre', shortName: 'Bến Tre', lat: 10.2434, lng: 106.3756 },
  { code: 'binhdinh', name: 'Bình Định', shortName: 'Bình Định', lat: 14.1667, lng: 109.0000 },
  { code: 'binhduong', name: 'Bình Dương', shortName: 'Bình Dương', lat: 11.1645, lng: 106.6710 },
  { code: 'binhphuoc', name: 'Bình Phước', shortName: 'Bình Phước', lat: 11.7511, lng: 106.9360 },
  { code: 'binhthuan', name: 'Bình Thuận', shortName: 'Bình Thuận', lat: 11.0903, lng: 108.0673 },
  { code: 'camau', name: 'Cà Mau', shortName: 'Cà Mau', lat: 9.1769, lng: 105.1524 },
  { code: 'caobang', name: 'Cao Bằng', shortName: 'Cao Bằng', lat: 22.6666, lng: 106.2625 },
  { code: 'daklak', name: 'Đắk Lắk', shortName: 'Đắk Lắk', lat: 12.6667, lng: 108.0500 },
  { code: 'daknong', name: 'Đắk Nông', shortName: 'Đắk Nông', lat: 12.0000, lng: 107.6833 },
  { code: 'dienbien', name: 'Điện Biên', shortName: 'Điện Biên', lat: 21.3833, lng: 103.0167 },
  { code: 'dongnai', name: 'Đồng Nai', shortName: 'Đồng Nai', lat: 11.0500, lng: 107.0500 },
  { code: 'dongthap', name: 'Đồng Tháp', shortName: 'Đồng Tháp', lat: 10.5000, lng: 105.6833 },
  { code: 'gialai', name: 'Gia Lai', shortName: 'Gia Lai', lat: 13.9833, lng: 108.0000 },
  { code: 'hagiang', name: 'Hà Giang', shortName: 'Hà Giang', lat: 22.8233, lng: 104.9836 },
  { code: 'hanam', name: 'Hà Nam', shortName: 'Hà Nam', lat: 20.5833, lng: 105.9167 },
  { code: 'hatinh', name: 'Hà Tĩnh', shortName: 'Hà Tĩnh', lat: 18.3429, lng: 105.9059 },
  { code: 'haiduong', name: 'Hải Dương', shortName: 'Hải Dương', lat: 20.9373, lng: 106.3146 },
  { code: 'haugiang', name: 'Hậu Giang', shortName: 'Hậu Giang', lat: 9.7833, lng: 105.4667 },
  { code: 'hoabinh', name: 'Hòa Bình', shortName: 'Hòa Bình', lat: 20.8172, lng: 105.3376 },
  { code: 'hungyen', name: 'Hưng Yên', shortName: 'Hưng Yên', lat: 20.6464, lng: 106.0511 },
  { code: 'khanhhoa', name: 'Khánh Hòa', shortName: 'Nha Trang', lat: 12.2388, lng: 109.1967 },
  { code: 'kiengiang', name: 'Kiên Giang', shortName: 'Kiên Giang', lat: 10.0139, lng: 105.0809 },
  { code: 'kontum', name: 'Kon Tum', shortName: 'Kon Tum', lat: 14.3500, lng: 108.0000 },
  { code: 'laichau', name: 'Lai Châu', shortName: 'Lai Châu', lat: 22.3956, lng: 103.4674 },
  { code: 'lamdong', name: 'Lâm Đồng', shortName: 'Đà Lạt', lat: 11.9404, lng: 108.4583 },
  { code: 'langson', name: 'Lạng Sơn', shortName: 'Lạng Sơn', lat: 21.8537, lng: 106.7615 },
  { code: 'laocai', name: 'Lào Cai', shortName: 'Lào Cai', lat: 22.4856, lng: 103.9707 },
  { code: 'longan', name: 'Long An', shortName: 'Long An', lat: 10.5333, lng: 106.4000 },
  { code: 'namdinh', name: 'Nam Định', shortName: 'Nam Định', lat: 20.4333, lng: 106.1833 },
  { code: 'nghean', name: 'Nghệ An', shortName: 'Nghệ An', lat: 19.3333, lng: 104.8333 },
  { code: 'ninhbinh', name: 'Ninh Bình', shortName: 'Ninh Bình', lat: 20.2539, lng: 105.9750 },
  { code: 'ninhthuan', name: 'Ninh Thuận', shortName: 'Ninh Thuận', lat: 11.6833, lng: 108.9167 },
  { code: 'phutho', name: 'Phú Thọ', shortName: 'Phú Thọ', lat: 21.3167, lng: 105.2167 },
  { code: 'phuyen', name: 'Phú Yên', shortName: 'Phú Yên', lat: 13.0882, lng: 109.0924 },
  { code: 'quangbinh', name: 'Quảng Bình', shortName: 'Quảng Bình', lat: 17.4833, lng: 106.6000 },
  { code: 'quangnam', name: 'Quảng Nam', shortName: 'Quảng Nam', lat: 15.5667, lng: 108.0000 },
  { code: 'quangngai', name: 'Quảng Ngãi', shortName: 'Quảng Ngãi', lat: 15.1205, lng: 108.7923 },
  { code: 'quangninh', name: 'Quảng Ninh', shortName: 'Hạ Long', lat: 21.0064, lng: 107.2925 },
  { code: 'quangtri', name: 'Quảng Trị', shortName: 'Quảng Trị', lat: 16.7500, lng: 107.1833 },
  { code: 'soctrang', name: 'Sóc Trăng', shortName: 'Sóc Trăng', lat: 9.6033, lng: 105.9800 },
  { code: 'sonla', name: 'Sơn La', shortName: 'Sơn La', lat: 21.3283, lng: 103.9189 },
  { code: 'tayninh', name: 'Tây Ninh', shortName: 'Tây Ninh', lat: 11.3500, lng: 106.1000 },
  { code: 'thaibinh', name: 'Thái Bình', shortName: 'Thái Bình', lat: 20.4500, lng: 106.3333 },
  { code: 'thainguyen', name: 'Thái Nguyên', shortName: 'Thái Nguyên', lat: 21.5674, lng: 105.8252 },
  { code: 'thanhhoa', name: 'Thanh Hóa', shortName: 'Thanh Hóa', lat: 19.8000, lng: 105.7667 },
  { code: 'hue', name: 'Thừa Thiên Huế', shortName: 'Huế', lat: 16.4637, lng: 107.5909 },
  { code: 'tiengiang', name: 'Tiền Giang', shortName: 'Tiền Giang', lat: 10.4167, lng: 106.3333 },
  { code: 'travinh', name: 'Trà Vinh', shortName: 'Trà Vinh', lat: 9.9347, lng: 106.3453 },
  { code: 'tuyenquang', name: 'Tuyên Quang', shortName: 'Tuyên Quang', lat: 21.8236, lng: 105.2144 },
  { code: 'vinhlong', name: 'Vĩnh Long', shortName: 'Vĩnh Long', lat: 10.2500, lng: 105.9667 },
  { code: 'vinhphuc', name: 'Vĩnh Phúc', shortName: 'Vĩnh Phúc', lat: 21.3089, lng: 105.6049 },
  { code: 'yenbai', name: 'Yên Bái', shortName: 'Yên Bái', lat: 21.7167, lng: 104.8667 }
];

export const DEFAULT_CITY = VIETNAM_CITIES[0]; // TP. Hồ Chí Minh

export function getCityByCode(code) {
  if (!code) return DEFAULT_CITY;
  const normalized = code.toLowerCase().trim();
  return (
    VIETNAM_CITIES.find(
      (c) => c.code === normalized || c.shortName.toLowerCase() === normalized || c.name.toLowerCase() === normalized
    ) || DEFAULT_CITY
  );
}

export const TOP_CITIES = VIETNAM_CITIES.slice(0, 5);
export const OTHER_CITIES = VIETNAM_CITIES.slice(5);
