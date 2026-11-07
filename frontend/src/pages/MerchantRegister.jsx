import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed, CheckCircle2, ChevronRight, ChevronLeft,
  Building, User, CreditCard, Clock, Sparkles, ArrowRight,
  Upload, AlertCircle, FileText, Check, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storeApi } from '../api/client';
import { VIETNAM_CITIES, TOP_CITIES, OTHER_CITIES } from '../constants/vietnamLocations';

export default function MerchantRegister() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State đầy đủ theo quy trình 11 ảnh của Shopee
  const [formData, setFormData] = useState({
    // Bước 1: Thông tin quán cơ bản
    brandName: '',
    specialtyDish: '',
    areaStreet: '',
    city: 'TP. Hồ Chí Minh',
    city_code: 'hcm',
    city_name: 'TP. Hồ Chí Minh',
    district: 'Thành Phố Thủ Đức',
    ward: 'Phường Phú Hữu',
    streetAddress: '',
    address_detail: '',
    phone: '',
    latitude: 10.7769,
    longitude: 106.7009,
    prep_time: 15,

    // Bước 2: Thông tin người đại diện
    merchantType: 'INDIVIDUAL', // INDIVIDUAL | HOUSEHOLD | ENTERPRISE
    representativeName: user?.name || '',
    repEmail: user?.email || '',
    repPhone: '',
    repAltPhone: '',
    citizenId: '',
    citizenIdDate: '2024-12-04',
    citizenIdPlace: 'Cục Cảnh sát QLHC về TTXH',
    citizenIdFront: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
    citizenIdBack: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
    businessLicenseImage: '',
    taxCode: '312259544',
    taxImage: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',

    // Bước 3: Thông tin ngân hàng
    bankName: 'Vietcombank',
    bankAccountNumber: '',
    bankAccountHolder: user?.name || '',
    bankBranch: 'Hồ Chí Minh - Chi nhánh Thủ Đức',

    // Bước 4: Chi tiết quán
    operatingHours: {
      mon: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      tue: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      wed: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      thu: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      fri: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      sat: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      sun: { isOpen: false, openTime: '08:00', closeTime: '22:00' },
    },
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    serviceTypes: ['Quán ăn'],
    cuisineTypes: ['Món Việt'],
    featuredDishes: ['Cơm tấm', 'Trà sữa'],
    parkingFee: 'Miễn phí',
    menuImages: ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'],

    // Bước 5: Gói tăng trưởng
    growthPackage: 'FREE', // FREE | GROWTH_1 | GROWTH_3
    packagePrice: 0,
  });

  // Kiểm tra nếu chưa đăng nhập thì chuyển hướng sang login
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/merchant/register');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Tự động đồng bộ tên chủ tài khoản theo tên đại diện nếu sửa tên đại diện
      ...(name === 'representativeName' ? { bankAccountHolder: value } : {}),
    }));
  };

  const handleOperatingHoursToggle = (day) => {
    setFormData((prev) => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day],
          isOpen: !prev.operatingHours[day].isOpen,
        },
      },
    }));
  };

  const handleOperatingHoursChange = (day, field, value) => {
    setFormData((prev) => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day],
          [field]: value,
        },
      },
    }));
  };

  const handleCityChange = (e) => {
    const val = e.target.value;
    const found = VIETNAM_CITIES.find((c) => c.name === val || c.code === val) || VIETNAM_CITIES[0];
    setFormData((prev) => ({
      ...prev,
      city: found.name,
      city_name: found.name,
      city_code: found.code
    }));
  };

  // Tạo tên quán đầy đủ
  const fullStoreName = [formData.brandName, formData.specialtyDish, formData.areaStreet]
    .filter(Boolean)
    .join(' - ');

  // Tạo địa chỉ đầy đủ
  const fullAddress = [formData.streetAddress, formData.ward, formData.district, formData.city]
    .filter(Boolean)
    .join(', ');

  const handleNext = () => {
    setErrorMsg('');
    if (currentStep === 1) {
      if (!formData.brandName) {
        setErrorMsg('Vui lòng nhập tên quán ăn/thương hiệu.');
        return;
      }
      if (!formData.phone) {
        setErrorMsg('Vui lòng nhập số điện thoại liên hệ của quán.');
        return;
      }
      if (!formData.streetAddress) {
        setErrorMsg('Vui lòng nhập số nhà và tên đường.');
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.representativeName) {
        setErrorMsg('Vui lòng nhập họ và tên người đại diện.');
        return;
      }
      if (!formData.repPhone) {
        setErrorMsg('Vui lòng nhập số điện thoại nhận thông báo & thanh toán.');
        return;
      }
      if (!formData.citizenId) {
        setErrorMsg('Vui lòng nhập số CMND / CCCD / Hộ chiếu.');
        return;
      }
    } else if (currentStep === 3) {
      if (!formData.bankAccountNumber) {
        setErrorMsg('Vui lòng nhập số tài khoản ngân hàng nhận tiền.');
        return;
      }
      if (!formData.bankAccountHolder) {
        setErrorMsg('Vui lòng nhập tên chủ tài khoản ngân hàng.');
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    setErrorMsg('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        ...formData,
        city_code: formData.city_code || 'hcm',
        city_name: formData.city_name || formData.city || 'TP. Hồ Chí Minh',
        address_detail: formData.streetAddress || '',
        name: fullStoreName || formData.brandName,
        address: fullAddress || `${formData.streetAddress}, ${formData.city}`,
        phone: formData.phone || formData.repPhone,
      };

      const res = await storeApi.register(payload);
      if (res.data?.success) {
        navigate('/merchant/status');
      } else {
        setErrorMsg(res.data?.message || 'Có lỗi xảy ra khi đăng ký');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Lỗi gửi hồ sơ đăng ký');
    } finally {
      setSubmitting(false);
    }
  };

  // Danh sách các bước Stepper
  const steps = [
    { num: 1, title: 'Thông tin cơ bản', desc: 'Tên & Địa chỉ quán' },
    { num: 2, title: 'Người đại diện', desc: 'CCCD & Thuế' },
    { num: 3, title: 'Ngân hàng', desc: 'Tài khoản nhận tiền' },
    { num: 4, title: 'Chi tiết quán', desc: 'Giờ mở & Thực đơn' },
    { num: 5, title: 'Gói tăng trưởng', desc: 'Ưu đãi quán mới' },
    { num: 6, title: 'Xác nhận', desc: 'Kiểm tra & Gửi duyệt' },
  ];

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      {/* Top Header Minimalist */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-16 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Đăng ký trở thành Người Bán</h1>
              <p className="text-xs text-gray-500">Quy trình mở gian hàng đối tác FoodFast tiêu chuẩn</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200"
          >
            Về trang chủ
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        {/* Stepper Progress Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm mb-6">
          <div className="flex items-center justify-between overflow-x-auto pb-2 sm:pb-0 gap-2">
            {steps.map((st, idx) => (
              <React.Fragment key={st.num}>
                <div className="flex flex-col items-center min-w-[70px] text-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                      currentStep === st.num
                        ? 'bg-orange-600 text-white shadow-md shadow-orange-500/30 ring-4 ring-orange-100'
                        : currentStep > st.num
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {currentStep > st.num ? <Check className="w-4 h-4 stroke-[3]" /> : st.num}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium whitespace-nowrap ${
                      currentStep === st.num ? 'text-orange-600 font-bold' : 'text-gray-500'
                    }`}
                  >
                    {st.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 min-w-[20px] transition-colors ${
                      currentStep > st.num ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step Content Cards */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          {/* ================================================================= */}
          {/* BƯỚC 1: THÔNG TIN QUÁN CƠ BẢN */}
          {/* ================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Thông tin quán cơ bản</h2>
                <p className="text-sm text-gray-500 mt-1">Cung cấp tên và địa chỉ thực tế của cửa hàng</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Tên quán
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    name="brandName"
                    value={formData.brandName}
                    onChange={handleChange}
                    placeholder="Tên thương hiệu (vd: Vnet Food)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                  <input
                    type="text"
                    name="specialtyDish"
                    value={formData.specialtyDish}
                    onChange={handleChange}
                    placeholder="Món đặc trưng (vd: Chè thái)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                  <input
                    type="text"
                    name="areaStreet"
                    value={formData.areaStreet}
                    onChange={handleChange}
                    placeholder="Khu vực/Đường (vd: Thủ Đức)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
                <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/60 text-xs text-amber-800 flex items-start gap-2">
                  <span className="font-bold">💡 Gợi ý:</span>
                  <span>Tên quán nên đặt theo thứ tự: Tên quán, món đặc trưng của quán và tên đường/khu vực. Tên hiển thị: <strong>{fullStoreName || '(Chưa nhập đủ)'}</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Số điện thoại liên hệ của quán
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="0969535231"
                  className="w-full sm:w-1/2 px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Thành phố
                  </label>
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleCityChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm bg-white"
                  >
                    <optgroup label="Thành phố trọng điểm">
                      {TOP_CITIES.map((c) => (
                        <option key={c.code} value={c.name}>{c.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Tất cả 63 Tỉnh/Thành phố">
                      {OTHER_CITIES.map((c) => (
                        <option key={c.code} value={c.name}>{c.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Quận/Huyện
                  </label>
                  <input
                    type="text"
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    placeholder="Thành Phố Thủ Đức"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Phường/Xã
                  </label>
                  <input
                    type="text"
                    name="ward"
                    value={formData.ward}
                    onChange={handleChange}
                    placeholder="Phường Phú Hữu"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Số nhà và Đường/Phố
                </label>
                <input
                  type="text"
                  name="streetAddress"
                  value={formData.streetAddress}
                  onChange={handleChange}
                  placeholder="Số 2 đường Võ Văn Ngân"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1.5">Địa chỉ này phải là địa điểm kinh doanh thực tế để shipper tới lấy món.</p>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* BƯỚC 2: THÔNG TIN NGƯỜI ĐẠI DIỆN */}
          {/* ================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Thông tin người đại diện</h2>
                <p className="text-sm text-gray-500 mt-1">Vui lòng điền đúng thông tin theo giấy tờ pháp lý</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Đăng ký dưới danh nghĩa
                </label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { id: 'INDIVIDUAL', label: 'Cá nhân' },
                    { id: 'HOUSEHOLD', label: 'Hộ kinh doanh' },
                    { id: 'ENTERPRISE', label: 'Doanh nghiệp' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, merchantType: tab.id })}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        formData.merchantType === tab.id
                          ? 'border-orange-600 bg-orange-50 text-orange-600 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Tên đầy đủ người đại diện
                </label>
                <input
                  type="text"
                  name="representativeName"
                  value={formData.representativeName}
                  onChange={handleChange}
                  placeholder="Nguyễn Ngọc Định"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Tên của người đăng ký phải trùng với tên chủ TK ngân hàng nhận thanh toán doanh thu.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Email nhận báo cáo doanh thu
                  </label>
                  <input
                    type="email"
                    name="repEmail"
                    value={formData.repEmail}
                    onChange={handleChange}
                    placeholder="merchant@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Số điện thoại đăng ký thanh toán tự động
                  </label>
                  <input
                    type="text"
                    name="repPhone"
                    value={formData.repPhone}
                    onChange={handleChange}
                    placeholder="0969535231"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Số CMND/CCCD/Hộ chiếu
                  </label>
                  <input
                    type="text"
                    name="citizenId"
                    value={formData.citizenId}
                    onChange={handleChange}
                    placeholder="082096010945"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Ngày cấp
                  </label>
                  <input
                    type="date"
                    name="citizenIdDate"
                    value={formData.citizenIdDate}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Nơi cấp
                  </label>
                  <input
                    type="text"
                    name="citizenIdPlace"
                    value={formData.citizenIdPlace}
                    onChange={handleChange}
                    placeholder="Tiền Giang"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
              </div>

              {/* Upload CMND/CCCD */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Ảnh chụp CMND/CCCD/Hộ chiếu
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-orange-500 transition-colors">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Mặt trước</p>
                    <img
                      src={formData.citizenIdFront}
                      alt="CCCD mặt trước"
                      className="w-full h-32 object-cover rounded-lg border mb-2"
                    />
                    <span className="text-xs text-emerald-600 font-medium">✓ Đã sẵn sàng ảnh xác thực</span>
                  </div>
                  <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-orange-500 transition-colors">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Mặt sau</p>
                    <img
                      src={formData.citizenIdBack}
                      alt="CCCD mặt sau"
                      className="w-full h-32 object-cover rounded-lg border mb-2"
                    />
                    <span className="text-xs text-emerald-600 font-medium">✓ Đã sẵn sàng ảnh xác thực</span>
                  </div>
                </div>
              </div>

              {/* Mã số thuế */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mã số thuế
                  </label>
                  <input
                    type="text"
                    name="taxCode"
                    value={formData.taxCode}
                    onChange={handleChange}
                    placeholder="312259544"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ảnh chụp Giấy phép kinh doanh / MST (nếu có)
                  </label>
                  <div className="border border-dashed border-gray-200 rounded-xl p-3 flex items-center gap-3">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500">Ảnh giấy phép / đăng ký thuế</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* BƯỚC 3: THÔNG TIN NGÂN HÀNG */}
          {/* ================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Thông tin quán - Thông tin ngân hàng</h2>
                <p className="text-sm text-gray-500 mt-1">Tài khoản sẽ nhận doanh thu bán hàng tự động hàng ngày</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Tên ngân hàng
                </label>
                <select
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm bg-white"
                >
                  <option value="Vietcombank">Vietcombank - Ngân hàng Ngoại thương Việt Nam</option>
                  <option value="MBBank">MB Bank - Ngân hàng Quân Đội</option>
                  <option value="Techcombank">Techcombank - Ngân hàng Kỹ Thương</option>
                  <option value="Vietinbank">Vietinbank - Ngân hàng Công Thương</option>
                  <option value="BIDV">BIDV - Ngân hàng Đầu tư và Phát triển</option>
                  <option value="ACB">ACB - Ngân hàng Á Châu</option>
                  <option value="TPBank">TPBank - Ngân hàng Tiên Phong</option>
                  <option value="VPBank">VPBank - Ngân hàng Việt Nam Thịnh Vượng</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Số tài khoản ngân hàng
                </label>
                <input
                  type="text"
                  name="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={handleChange}
                  placeholder="1033618225"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Tên chủ tài khoản ngân hàng
                </label>
                <input
                  type="text"
                  name="bankAccountHolder"
                  value={formData.bankAccountHolder}
                  onChange={handleChange}
                  placeholder="NGUYEN NGOC DINH"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm uppercase"
                />
                <p className="text-xs text-gray-400 mt-1">Tên chủ TK ngân hàng nhận thanh toán doanh thu phải trùng với tên người đại diện.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chi nhánh ngân hàng
                </label>
                <input
                  type="text"
                  name="bankBranch"
                  value={formData.bankBranch}
                  onChange={handleChange}
                  placeholder="Hồ Chí Minh (Vietcombank) / Chi nhánh Thủ Đức"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                />
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* BƯỚC 4: THÔNG TIN QUÁN - CHI TIẾT */}
          {/* ================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Thông tin quán - Chi tiết</h2>
                <p className="text-sm text-gray-500 mt-1">Thời gian phục vụ, hình ảnh đại diện và thực đơn mẫu</p>
              </div>

              {/* Giờ mở cửa */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <span className="text-red-500">*</span> Thời gian mở cửa trong tuần
                </label>
                <div className="space-y-2.5">
                  {[
                    { key: 'mon', label: 'Thứ 2' },
                    { key: 'tue', label: 'Thứ 3' },
                    { key: 'wed', label: 'Thứ 4' },
                    { key: 'thu', label: 'Thứ 5' },
                    { key: 'fri', label: 'Thứ 6' },
                    { key: 'sat', label: 'Thứ 7' },
                    { key: 'sun', label: 'Chủ Nhật' },
                  ].map((d) => {
                    const item = formData.operatingHours[d.key] || { isOpen: true, openTime: '08:00', closeTime: '22:00' };
                    return (
                      <div key={d.key} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50/50">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOperatingHoursToggle(d.key)}
                            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                              item.isOpen ? 'bg-orange-600' : 'bg-gray-300'
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                item.isOpen ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className="text-sm font-semibold text-gray-800 w-20">{d.label}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item.isOpen ? 'Mở cửa' : 'Đóng cửa'}
                          </span>
                        </div>

                        {item.isOpen && (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={item.openTime}
                              onChange={(e) => handleOperatingHoursChange(d.key, 'openTime', e.target.value)}
                              className="px-2 py-1 text-xs border rounded-lg"
                            />
                            <span className="text-xs text-gray-400">-</span>
                            <input
                              type="time"
                              value={item.closeTime}
                              onChange={(e) => handleOperatingHoursChange(d.key, 'closeTime', e.target.value)}
                              className="px-2 py-1 text-xs border rounded-lg"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hình ảnh đại diện & Ảnh bìa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Ảnh đại diện quán (550x550px)
                  </label>
                  <img
                    src={formData.image}
                    alt="Avatar quán"
                    className="w-full h-36 object-cover rounded-xl border mb-2"
                  />
                  <p className="text-xs text-gray-400">Nên dùng logo quán hoặc hình món đặc trưng đẹp mắt.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500">*</span> Ảnh bìa quán (960x550px)
                  </label>
                  <img
                    src={formData.coverImage}
                    alt="Ảnh bìa quán"
                    className="w-full h-36 object-cover rounded-xl border mb-2"
                  />
                  <p className="text-xs text-gray-400">Ảnh bìa sẽ hiển thị trên đầu trang gian hàng của bạn.</p>
                </div>
              </div>

              {/* Phí gửi xe & Thời gian chuẩn bị món */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phí gửi xe</label>
                  <select
                    name="parkingFee"
                    value={formData.parkingFee}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    <option value="Miễn phí">Miễn phí</option>
                    <option value="5.000đ">5.000đ</option>
                    <option value="10.000đ">10.000đ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Chuẩn bị món (phút)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    name="prep_time"
                    value={formData.prep_time || 15}
                    onChange={(e) => setFormData({ ...formData, prep_time: Number(e.target.value) || 15 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    placeholder="15"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Dùng để tính thời gian giao thực tế</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ẩm thực chính</label>
                  <input
                    type="text"
                    value="Món Việt, Trà sữa, Ăn vặt"
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* BƯỚC 5: GÓI TĂNG TRƯỞNG DOANH THU */}
          {/* ================================================================= */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Gói Hỗ trợ tăng trưởng doanh thu cho quán mới
                </h2>
                <p className="text-sm text-gray-500 mt-1">Chọn gói khởi động để sớm có những đơn hàng đầu tiên</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Gói Cơ bản Miễn phí */}
                <div
                  onClick={() => setFormData({ ...formData, growthPackage: 'FREE', packagePrice: 0 })}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.growthPackage === 'FREE'
                      ? 'border-orange-600 bg-orange-50/40 shadow-md ring-2 ring-orange-500/20'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-800">Gói Tiêu Chuẩn</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formData.growthPackage === 'FREE' ? 'border-orange-600 bg-orange-600' : 'border-gray-300'
                    }`}>
                      {formData.growthPackage === 'FREE' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <div className="text-2xl font-black text-gray-900 mb-2">0 VND</div>
                  <p className="text-xs text-gray-500 mb-4">Mở bán tiêu chuẩn trên ứng dụng không tốn phí kích hoạt.</p>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-center gap-1.5">✓ Mở gian hàng miễn phí</li>
                    <li className="flex items-center gap-1.5">✓ Nhận đơn hàng trực tuyến</li>
                  </ul>
                </div>

                {/* Gói 1 */}
                <div
                  onClick={() => setFormData({ ...formData, growthPackage: 'GROWTH_1', packagePrice: 1200000 })}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.growthPackage === 'GROWTH_1'
                      ? 'border-orange-600 bg-orange-50/40 shadow-md ring-2 ring-orange-500/20'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-orange-600">Gói Tăng Trưởng 1</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formData.growthPackage === 'GROWTH_1' ? 'border-orange-600 bg-orange-600' : 'border-gray-300'
                    }`}>
                      {formData.growthPackage === 'GROWTH_1' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <div className="text-2xl font-black text-orange-600 mb-2">1.200.000 VND</div>
                  <p className="text-xs text-gray-500 mb-4">60 mã khuyến mãi trị giá lên đến 2.050.000 đồng.</p>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-center gap-1.5">✓ Xuất hiện trên banner BST quán mới</li>
                    <li className="flex items-center gap-1.5">✓ Hỗ trợ tạo thực đơn 10 món</li>
                  </ul>
                </div>

                {/* Gói 3 */}
                <div
                  onClick={() => setFormData({ ...formData, growthPackage: 'GROWTH_3', packagePrice: 2000000 })}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.growthPackage === 'GROWTH_3'
                      ? 'border-orange-600 bg-orange-50/40 shadow-md ring-2 ring-orange-500/20'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-amber-600">Gói Siêu Tăng Trưởng</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formData.growthPackage === 'GROWTH_3' ? 'border-orange-600 bg-orange-600' : 'border-gray-300'
                    }`}>
                      {formData.growthPackage === 'GROWTH_3' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <div className="text-2xl font-black text-amber-600 mb-2">2.000.000 VND</div>
                  <p className="text-xs text-gray-500 mb-4">120 mã khuyến mãi trị giá lên đến 4.100.000 đồng.</p>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-center gap-1.5">✓ Top đề xuất 14 ngày liên tục</li>
                    <li className="flex items-center gap-1.5">✓ Chụp ảnh món ăn chuyên nghiệp</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* BƯỚC 6: XÁC NHẬN HỒ SƠ & GỬI DUYỆT (REVIEW SCREEN) */}
          {/* ================================================================= */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Vui lòng kiểm tra kỹ trước khi gửi yêu cầu</h2>
                <p className="text-sm text-gray-500 mt-1">Thông tin này sẽ được gửi tới Ban quản trị hệ thống FoodFast để xét duyệt</p>
              </div>

              {/* Tóm tắt Bước 1 */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-sm">
                <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-1.5">Thông tin quán - Cơ bản</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Tên quán:</span> <strong>{fullStoreName}</strong></div>
                  <div><span className="text-gray-500">Số điện thoại:</span> <strong>{formData.phone}</strong></div>
                  <div><span className="text-gray-500">Tỉnh/Thành phố:</span> <strong>{formData.city}</strong></div>
                  <div><span className="text-gray-500">Quận/Huyện:</span> <strong>{formData.district}</strong></div>
                  <div className="sm:col-span-2"><span className="text-gray-500">Địa chỉ đầy đủ:</span> <strong>{fullAddress}</strong></div>
                </div>
              </div>

              {/* Tóm tắt Bước 2 */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-sm">
                <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-1.5">Thông tin người đại diện</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Danh nghĩa:</span> <strong>{formData.merchantType === 'INDIVIDUAL' ? 'Cá nhân' : 'Hộ kinh doanh'}</strong></div>
                  <div><span className="text-gray-500">Tên đại diện:</span> <strong>{formData.representativeName}</strong></div>
                  <div><span className="text-gray-500">Email nhận báo cáo:</span> <strong>{formData.repEmail}</strong></div>
                  <div><span className="text-gray-500">Số điện thoại:</span> <strong>{formData.repPhone}</strong></div>
                  <div><span className="text-gray-500">Số CMND/CCCD:</span> <strong>****{formData.citizenId.slice(-4) || '0945'}</strong></div>
                  <div><span className="text-gray-500">Nơi cấp:</span> <strong>{formData.citizenIdPlace}</strong></div>
                </div>
              </div>

              {/* Tóm tắt Bước 3 & Bước 5 */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-sm">
                <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-1.5">Tài khoản ngân hàng & Gói dịch vụ</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Ngân hàng:</span> <strong>{formData.bankName}</strong></div>
                  <div><span className="text-gray-500">Số tài khoản:</span> <strong>{formData.bankAccountNumber}</strong></div>
                  <div><span className="text-gray-500">Chủ tài khoản:</span> <strong>{formData.bankAccountHolder}</strong></div>
                  <div><span className="text-gray-500">Gói đã chọn:</span> <strong className="text-orange-600">{formData.growthPackage} ({formData.packagePrice.toLocaleString('vi-VN')} đ)</strong></div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 flex-shrink-0 text-blue-600" />
                <span>
                  Bằng cách bấm nút "Gửi hồ sơ đăng ký", bạn cam kết thông tin cung cấp là hoàn toàn chính xác. Quản trị viên FoodFast sẽ duyệt hồ sơ của bạn trong vòng 24 giờ làm việc.
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons (Footer) */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Quay lại
              </button>
            ) : <div />}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-md shadow-orange-600/20 flex items-center gap-1.5 transition-all"
              >
                Tiếp tục <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {submitting ? 'Đang gửi hồ sơ...' : 'Gửi hồ sơ đăng ký'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

