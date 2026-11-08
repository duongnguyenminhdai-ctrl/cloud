/**
 * Tiện ích Reverse Geocoding & Address Search tối ưu cho Việt Nam
 * Kết hợp Photon API (Komoot Elasticsearch) và OpenStreetMap Nominatim
 * - Tìm kiếm được số nhà, số hẻm, tên đường, tòa nhà chi tiết như FoodFast
 * - Tự động định vị tọa độ và đồng bộ với bản đồ
 */

const reverseCache = new Map();
const searchCache = new Map();

// Danh sách các địa điểm phổ biến tại TP.HCM để gợi ý tức thì
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
 * Định dạng địa chỉ đầy đủ từ thuộc tính của Photon/Nominatim
 */
function buildAddressFromProps(props) {
  if (!props) return 'Khu vực TP. Hồ Chí Minh';

  const parts = [];
  if (props.housenumber && props.street) {
    parts.push(`${props.housenumber} ${props.street}`);
  } else {
    if (props.housenumber) parts.push(props.housenumber);
    if (props.street) parts.push(props.street);
  }

  if (props.name && props.name !== props.street && props.name !== props.housenumber) {
    if (!parts.some((p) => p.includes(props.name))) {
      parts.unshift(props.name);
    }
  }
  if (props.locality || props.suburb) parts.push(props.locality || props.suburb);
  if (props.district) parts.push(props.district);
  if (props.city && !parts.some((p) => p.includes(props.city))) parts.push(props.city);

  if (parts.length >= 2) {
    return parts.join(', ');
  }
  return props.name || props.street || 'TP. Hồ Chí Minh';
}

/**
 * Rút gọn địa chỉ hiển thị thẻ
 */
function buildShortAddressFromProps(props, full) {
  if (props?.housenumber && props?.street) {
    return `${props.housenumber} ${props.street}`;
  }
  if (props?.name) return props.name;
  if (props?.street) {
    const dist = props.district || props.city || '';
    return dist ? `${props.street}, ${dist}` : props.street;
  }
  return full ? full.split(',').slice(0, 2).join(', ') : 'TP. Hồ Chí Minh';
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
      address: 'Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      shortAddress: 'Nguyễn Huệ, Quận 1',
      lat: 10.7769,
      lng: 106.7009
    };
  }

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (reverseCache.has(key)) {
    return reverseCache.get(key);
  }

  // 1. Thử Photon Reverse Geocoding (Nhanh, không rate limit)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.features) && data.features.length > 0) {
        const props = data.features[0].properties;
        const full = buildAddressFromProps(props);
        const short = buildShortAddressFromProps(props, full);

        const result = {
          address: full,
          shortAddress: short,
          lat,
          lng
        };
        reverseCache.set(key, result);
        return result;
      }
    }
  } catch (err) {
    // Thử Nominatim bên dưới
  }

  // 2. Thử Nominatim Reverse Geocoding
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const parts = [];
      if (addr.house_number && (addr.road || addr.pedestrian)) {
        parts.push(`${addr.house_number} ${addr.road || addr.pedestrian}`);
      } else {
        if (addr.house_number) parts.push(addr.house_number);
        if (addr.road || addr.pedestrian) parts.push(addr.road || addr.pedestrian);
      }
      if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
      if (addr.city_district || addr.district) parts.push(addr.city_district || addr.district);
      if (addr.city || addr.state) parts.push(addr.city || addr.state);

      const full = parts.length > 0 ? parts.join(', ') : (data.display_name || 'Khu vực TP. Hồ Chí Minh');
      const short = (addr.road || addr.pedestrian || parts[0]) + (addr.city_district ? `, ${addr.city_district}` : '');

      const result = {
        address: full,
        shortAddress: short || 'TP. Hồ Chí Minh',
        lat,
        lng
      };
      reverseCache.set(key, result);
      return result;
    }
  } catch (err) {
    console.warn('[Geocoding] Reverse geocode fallback:', err.message);
  }

  // Fallback
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
 * Tìm kiếm địa chỉ chi tiết theo số nhà, tên đường, phường, quận (FoodFast style)
 * @param {string} query Từ khóa tìm kiếm
 * @param {number} [centerLat=10.7769] Tọa độ ưu tiên
 * @param {number} [centerLng=106.7009]
 * @returns {Promise<Array<{ name: string, address: string, lat: number, lng: number }>>}
 */
export async function searchAddress(query, centerLat = 10.7769, centerLng = 106.7009) {
  if (!query || query.trim().length < 2) {
    return POPULAR_LOCATIONS_HCMC.slice(0, 5);
  }

  const q = query.trim();
  const cacheKey = `${q.toLowerCase()}_${centerLat.toFixed(2)},${centerLng.toFixed(2)}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  const results = [];

  // 1. Kiểm tra danh bạ địa phương trước
  const qLower = q.toLowerCase();
  for (const item of POPULAR_LOCATIONS_HCMC) {
    if (item.name.toLowerCase().includes(qLower) || item.address.toLowerCase().includes(qLower)) {
      results.push(item);
    }
  }

  // 2. Tìm kiếm qua Photon API (Hỗ trợ cực tốt số nhà, số hẻm, tên đường tiếng Việt)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lat=${centerLat}&lon=${centerLng}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.features)) {
        for (const f of data.features) {
          const props = f.properties;
          const coords = f.geometry.coordinates; // [lng, lat]
          const fullAddr = buildAddressFromProps(props);
          const title = props.name || props.street || fullAddr.split(',')[0];

          // Tránh trùng lặp kết quả gần nhau
          if (!results.some((r) => Math.abs(r.lat - coords[1]) < 0.001 && Math.abs(r.lng - coords[0]) < 0.001)) {
            results.push({
              name: title,
              address: fullAddr,
              lat: coords[1],
              lng: coords[0]
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Geocoding] Photon search error:', err.message);
  }

  // 3. Nếu vẫn ít kết quả, bổ sung tìm kiếm qua Nominatim
  if (results.length < 3) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const vb = `${(centerLng - 0.6).toFixed(4)},${(centerLat + 0.6).toFixed(4)},${(centerLng + 0.6).toFixed(4)},${(centerLat - 0.6).toFixed(4)}`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=vn&viewbox=${vb}&limit=6&addressdetails=1`;
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (!results.some((r) => Math.abs(r.lat - lat) < 0.001 && Math.abs(r.lng - lng) < 0.001)) {
            results.push({
              name: item.name || item.display_name.split(',')[0],
              address: item.display_name,
              lat,
              lng
            });
          }
        }
      }
    } catch {
      // Bỏ qua lỗi
    }
  }

  searchCache.set(cacheKey, results.slice(0, 6));
  return results.slice(0, 6);
}
