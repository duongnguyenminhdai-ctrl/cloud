/**
 * Tiện ích Reverse Geocoding & Address Search sử dụng OpenStreetMap Nominatim
 * Chuyển đổi tọa độ GPS thành địa chỉ tên đường/quận/thành phố chuẩn ShopeeFood.
 */

const reverseCache = new Map();
const searchCache = new Map();

// Danh sách các địa điểm phổ biến tại TP.HCM để gợi ý tức thì không cần đợi API
export const POPULAR_LOCATIONS_HCMC = [
  {
    name: 'Chợ Bến Thành, Quận 1',
    address: 'Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    lat: 10.7725,
    lng: 106.6980
  },
  {
    name: 'Nhà thờ Đức Bà / Phố đi bộ Nguyễn Huệ',
    address: 'Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    lat: 10.7769,
    lng: 106.7009
  },
  {
    name: 'Đường Đông Du / Hai Bà Trưng, Quận 1',
    address: 'Đông Du, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    lat: 10.7761,
    lng: 106.7042
  },
  {
    name: 'Hồ Con Rùa, Quận 3',
    address: 'Công trường Quốc Tế, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    lat: 10.7828,
    lng: 106.6958
  },
  {
    name: 'Landmark 81, Vinhomes Central Park',
    address: '720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP. Hồ Chí Minh',
    lat: 10.7950,
    lng: 106.7218
  },
  {
    name: 'Đại học Quốc gia TP.HCM, TP. Thủ Đức',
    address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
    lat: 10.8700,
    lng: 106.8030
  },
  {
    name: 'Khu đô thị Phú Mỹ Hưng, Quận 7',
    address: 'Nguyễn Văn Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
    lat: 10.7295,
    lng: 106.7118
  },
  {
    name: 'Sân bay Tân Sơn Nhất, Tân Bình',
    address: 'Trường Sơn, Phường 2, Tân Bình, TP. Hồ Chí Minh',
    lat: 10.8185,
    lng: 106.6588
  }
];

/**
 * Rút gọn địa chỉ hiển thị thanh tiêu đề hoặc thẻ quán
 */
function extractShortAddress(addrObj, fullDisplay) {
  if (!addrObj) {
    if (!fullDisplay) return 'Trung tâm TP.HCM';
    const parts = fullDisplay.split(',').map((p) => p.trim());
    return parts.slice(0, 2).join(', ');
  }

  const street = addrObj.road || addrObj.pedestrian || addrObj.suburb || addrObj.neighbourhood || '';
  const district = addrObj.city_district || addrObj.district || addrObj.county || addrObj.suburb || '';
  const city = addrObj.city || addrObj.town || addrObj.state || 'TP.HCM';

  if (street && district) {
    return `${street}, ${district}`;
  }
  if (district) {
    return `${district}, ${city}`;
  }
  if (street) {
    return `${street}, ${city}`;
  }
  return fullDisplay ? fullDisplay.split(',')[0] : 'TP. Hồ Chí Minh';
}

/**
 * Định dạng địa chỉ đầy đủ từ đối tượng address của Nominatim
 */
function formatFullAddress(addrObj, fallback) {
  if (!addrObj) return fallback;

  const parts = [];
  if (addrObj.house_number) parts.push(addrObj.house_number);
  if (addrObj.road || addrObj.pedestrian) parts.push(addrObj.road || addrObj.pedestrian);
  if (addrObj.suburb || addrObj.neighbourhood) parts.push(addrObj.suburb || addrObj.neighbourhood);
  if (addrObj.city_district || addrObj.district || addrObj.county) {
    parts.push(addrObj.city_district || addrObj.district || addrObj.county);
  }
  if (addrObj.city || addrObj.town) parts.push(addrObj.city || addrObj.town);

  if (parts.length >= 2) {
    return parts.join(', ');
  }
  return fallback;
}

/**
 * Chuyển đổi tọa độ GPS thành địa chỉ người đọc được (Reverse Geocoding)
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ address: string, shortAddress: string, lat: number, lng: number }>}
 */
export async function reverseGeocode(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return {
      address: 'Trung tâm Quận 1, TP. Hồ Chí Minh',
      shortAddress: 'Quận 1, TP.HCM',
      lat: 10.7769,
      lng: 106.7009
    };
  }

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (reverseCache.has(key)) {
    return reverseCache.get(key);
  }

  // Tìm nhanh xem có gần địa điểm phổ biến nào không (< 300 mét)
  for (const item of POPULAR_LOCATIONS_HCMC) {
    const dLat = Math.abs(item.lat - lat);
    const dLng = Math.abs(item.lng - lng);
    if (dLat < 0.003 && dLng < 0.003) {
      const res = {
        address: item.address,
        shortAddress: item.name,
        lat,
        lng
      };
      reverseCache.set(key, res);
      return res;
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const full = formatFullAddress(data.address, data.display_name || 'Khu vực TP. Hồ Chí Minh');
      const short = extractShortAddress(data.address, data.display_name);

      const result = {
        address: full,
        shortAddress: short,
        lat,
        lng
      };
      reverseCache.set(key, result);
      return result;
    }
  } catch (err) {
    console.warn('[Geocoding] Reverse geocode timeout or error, using fallback:', err.message);
  }

  // Fallback nếu API bận hoặc timeout
  const fallbackResult = {
    address: 'Khu vực TP. Hồ Chí Minh',
    shortAddress: 'TP. Hồ Chí Minh',
    lat,
    lng
  };
  reverseCache.set(key, fallbackResult);
  return fallbackResult;
}

/**
 * Tìm kiếm địa chỉ bằng tên đường/quận/địa danh
 * @param {string} query
 * @returns {Promise<Array<{ name: string, address: string, lat: number, lng: number }>>}
 */
export async function searchAddress(query) {
  if (!query || query.trim().length < 2) {
    return POPULAR_LOCATIONS_HCMC.slice(0, 5);
  }

  const q = query.trim().toLowerCase();
  const cacheKey = q;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  // 1. Lọc trong danh sách địa điểm nổi tiếng trước (0ms phản hồi)
  const localMatches = POPULAR_LOCATIONS_HCMC.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.address.toLowerCase().includes(q)
  );

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const remoteMatches = data.map((item) => ({
        name: item.name || item.display_name.split(',')[0],
        address: formatFullAddress(item.address, item.display_name),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));

      // Gộp kết quả địa phương + kết quả từ Nominatim (loại bỏ trùng lặp)
      const combined = [...localMatches];
      for (const r of remoteMatches) {
        if (!combined.some((c) => Math.abs(c.lat - r.lat) < 0.001 && Math.abs(c.lng - r.lng) < 0.001)) {
          combined.push(r);
        }
      }

      searchCache.set(cacheKey, combined.slice(0, 6));
      return combined.slice(0, 6);
    }
  } catch (err) {
    console.warn('[Geocoding] Search address timeout or error:', err.message);
  }

  return localMatches.length > 0 ? localMatches : POPULAR_LOCATIONS_HCMC.slice(0, 4);
}
