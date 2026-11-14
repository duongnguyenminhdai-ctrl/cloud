import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sun, Moon, UtensilsCrossed } from 'lucide-react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function FlashlightAuthCard({
  title = 'Đăng Nhập',
  subtitle = 'Đặt món ăn yêu thích chỉ trong vài giây',
  sceneTitle = 'FOODFAST',
  sceneDesc = 'Giao món nóng hổi, chuẩn vị muôn nơi chỉ từ 15 phút.',
  passwordValue = '',
  passwordInputRef,
  passwordButtonRef,
  confirmPasswordValue = '',
  confirmPasswordInputRef,
  confirmPasswordButtonRef,
  activeEye = 'password',
  emailInputRef,
  isNightMode,
  onToggleNightMode,
  children
}) {
  const [internalNight, setInternalNight] = useState(false);
  const nightMode = isNightMode !== undefined ? isNightMode : internalNight;
  const setNightMode = (val) => {
    if (onToggleNightMode) onToggleNightMode(val);
    else setInternalNight(val);
  };

  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [angleDeg, setAngleDeg] = useState(180);
  const [beamStyle, setBeamStyle] = useState({});
  const [flashlightStyle, setFlashlightStyle] = useState({});
  const [overlayStyle, setOverlayStyle] = useState({});
  const [litLevels, setLitLevels] = useState([]);
  const [confirmOverlayStyle, setConfirmOverlayStyle] = useState({});
  const [confirmLitLevels, setConfirmLitLevels] = useState([]);

  // Owl physics state
  const [owlLight, setOwlLight] = useState(0);
  const [owlGaze, setOwlGaze] = useState({ x: 0, y: 0, tilt: 0 });

  const angleRadRef = useRef(Math.PI);
  const charRefs = useRef([]);
  const confirmCharRefs = useRef([]);

  // Cập nhật vị trí và góc quay của đèn pin & chùm sáng
  const updatePhysics = useCallback((clientX, clientY) => {
    if (!nightMode) return;

    let activeBtn = passwordButtonRef?.current;
    if (activeEye === 'confirm' && confirmPasswordButtonRef?.current) {
      activeBtn = confirmPasswordButtonRef.current;
    } else if (!activeBtn && confirmPasswordButtonRef?.current) {
      activeBtn = confirmPasswordButtonRef.current;
    }

    let eyeX = window.innerWidth / 2;
    let eyeY = window.innerHeight / 2;

    if (activeBtn) {
      const eyeRect = activeBtn.getBoundingClientRect();
      eyeX = eyeRect.left + eyeRect.width / 2;
      eyeY = eyeRect.top + eyeRect.height / 2;
    }

    const pointerDistance = Math.hypot(clientX - eyeX, clientY - eyeY);
    if (pointerDistance > 20) {
      angleRadRef.current = Math.atan2(clientY - eyeY, clientX - eyeX);
    }

    const currentAngleDeg = (angleRadRef.current * 180) / Math.PI;
    setAngleDeg(currentAngleDeg);

    const unitX = Math.cos(angleRadRef.current);
    const unitY = Math.sin(angleRadRef.current);
    const originX = eyeX + unitX * 14;
    const originY = eyeY + unitY * 14;
    const beamLength = clamp(pointerDistance * 1.65, 180, 1500);
    const beamHeight = beamLength * 0.4;

    setBeamStyle({
      left: `${originX}px`,
      top: `${originY - beamHeight / 2}px`,
      width: `${beamLength}px`,
      height: `${beamHeight}px`,
      transform: `rotate(${currentAngleDeg}deg)`
    });

    setFlashlightStyle({
      left: `${eyeX - 18}px`,
      top: `${eyeY - 18}px`,
      transform: `rotate(${currentAngleDeg}deg)`
    });

    // Định vị overlay password chính
    let fieldRect = null;
    if (passwordInputRef?.current) {
      fieldRect = passwordInputRef.current.getBoundingClientRect();
      const inputStyle = window.getComputedStyle(passwordInputRef.current);
      const padLeft = parseFloat(inputStyle.paddingLeft) || 40;
      const padRight = parseFloat(inputStyle.paddingRight) || 48;
      const fontSize = inputStyle.fontSize || '14px';
      const fontFamily = inputStyle.fontFamily;
      const letterSpacing = inputStyle.letterSpacing || 'normal';

      setOverlayStyle({
        left: `${fieldRect.left}px`,
        top: `${fieldRect.top}px`,
        width: `${fieldRect.width}px`,
        height: `${fieldRect.height}px`,
        paddingLeft: `${padLeft}px`,
        paddingRight: `${padRight}px`,
        fontSize,
        fontFamily,
        letterSpacing
      });
    }

    // Định vị overlay confirm password
    let confirmFieldRect = null;
    if (confirmPasswordInputRef?.current) {
      confirmFieldRect = confirmPasswordInputRef.current.getBoundingClientRect();
      const cStyle = window.getComputedStyle(confirmPasswordInputRef.current);
      const cPadLeft = parseFloat(cStyle.paddingLeft) || 40;
      const cPadRight = parseFloat(cStyle.paddingRight) || 48;
      const cFontSize = cStyle.fontSize || '14px';
      const cFontFamily = cStyle.fontFamily;
      const cLetterSpacing = cStyle.letterSpacing || 'normal';

      setConfirmOverlayStyle({
        left: `${confirmFieldRect.left}px`,
        top: `${confirmFieldRect.top}px`,
        width: `${confirmFieldRect.width}px`,
        height: `${confirmFieldRect.height}px`,
        paddingLeft: `${cPadLeft}px`,
        paddingRight: `${cPadRight}px`,
        fontSize: cFontSize,
        fontFamily: cFontFamily,
        letterSpacing: cLetterSpacing
      });
    }

    // Hàm tính toán cường độ ánh sáng tại điểm (x, y)
    const getLightLevel = (x, y) => {
      const offsetX = x - originX;
      const offsetY = y - originY;
      const along = offsetX * unitX + offsetY * unitY;
      const sideways = Math.abs(-offsetX * unitY + offsetY * unitX);
      const halfBeam = beamHeight * (0.01 + (0.49 * Math.max(0, along)) / beamLength);
      const edgeFade = clamp((halfBeam - sideways + 6) / 18, 0, 1);
      const tail = clamp((along / beamLength - 0.55) / 0.41, 0, 1);
      const endFade = 1 - tail * tail * (3 - 2 * tail);
      return along >= 0 ? edgeFade * endFade : 0;
    };

    // Tính ánh sáng cho từng ký tự mật khẩu chính
    if (charRefs.current.length > 0 && fieldRect) {
      const levels = charRefs.current.map((charEl) => {
        if (!charEl) return 0;
        const b = charEl.getBoundingClientRect();
        return getLightLevel(b.left + b.width / 2, fieldRect.top + fieldRect.height / 2);
      });
      setLitLevels(levels);
    }

    // Tính ánh sáng cho từng ký tự xác nhận mật khẩu
    if (confirmCharRefs.current.length > 0 && confirmFieldRect) {
      const cLevels = confirmCharRefs.current.map((charEl) => {
        if (!charEl) return 0;
        const b = charEl.getBoundingClientRect();
        return getLightLevel(b.left + b.width / 2, confirmFieldRect.top + confirmFieldRect.height / 2);
      });
      setConfirmLitLevels(cLevels);
    }

    // Tính ánh sáng và hướng nhìn của chú cú (đậu ở góc phải trên của email input)
    if (emailInputRef?.current) {
      const emailRect = emailInputRef.current.getBoundingClientRect();
      const owlX = emailRect.right - 45;
      const owlY = emailRect.top - 20;
      const light = getLightLevel(owlX, owlY);
      setOwlLight(light);

      const dx = originX - owlX;
      const dy = originY - owlY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const isLit = light > 0.08;
      const normX = isLit ? dx / distance : 0;
      const normY = isLit ? dy / distance : 0;

      setOwlGaze({
        x: normX * 3.5,
        y: normY * 2.8,
        headX: normX * 2.2,
        headY: normY * 1.4,
        tilt: normX * 10,
        isLit
      });
    }
  }, [nightMode, activeEye, passwordButtonRef, passwordInputRef, confirmPasswordButtonRef, confirmPasswordInputRef, emailInputRef]);

  // Lắng nghe di chuột
  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!nightMode) return;
      setPointer({ x: e.clientX, y: e.clientY });
      updatePhysics(e.clientX, e.clientY);
    };

    const handleResize = () => {
      if (nightMode) updatePhysics(pointer.x, pointer.y);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [nightMode, updatePhysics, pointer]);

  // Khởi tạo hướng đèn pin khi bật chế độ đêm
  useEffect(() => {
    if (nightMode) {
      const targetInput =
        activeEye === 'confirm'
          ? confirmPasswordInputRef?.current || passwordInputRef?.current
          : passwordInputRef?.current || confirmPasswordInputRef?.current;

      if (targetInput) {
        const rect = targetInput.getBoundingClientRect();
        angleRadRef.current = Math.PI;
        const initX = rect.left + 20;
        const initY = rect.top + rect.height / 2;
        setPointer({ x: initX, y: initY });
        setTimeout(() => updatePhysics(initX, initY), 50);
      }
    } else {
      setOwlLight(0);
      setOwlGaze({ x: 0, y: 0, headX: 0, headY: 0, tilt: 0, isLit: false });
    }
  }, [nightMode, activeEye, updatePhysics, passwordInputRef, confirmPasswordInputRef]);

  // Cập nhật lại vị trí và độ sáng khi passwordValue hoặc confirmPasswordValue thay đổi
  useEffect(() => {
    if (nightMode) {
      const raf = requestAnimationFrame(() => {
        updatePhysics(pointer.x, pointer.y);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [passwordValue, confirmPasswordValue, activeEye, nightMode, updatePhysics, pointer]);

  const charsArray = Array.from(passwordValue || '');
  const confirmCharsArray = Array.from(confirmPasswordValue || '');

  return (
    <div className={`flashlight-container ${nightMode ? 'night' : ''}`}>
      {/* Background Parallax Landscape */}
      <div className="page-landscape scene-day" />
      <div className="page-landscape scene-night" />

      {/* Chùm sáng đèn pin */}
      <div className="flash-beam" style={beamStyle} />

      {/* Đèn pin xoay theo chuột */}
      <div className="flashlight-prop" style={flashlightStyle}>
        <img src="/flashlight-assets/flashlight.svg" alt="Flashlight" className="w-full h-full" />
      </div>

      {/* Overlay ký tự mật khẩu chính phát sáng */}
      {passwordInputRef?.current && (
        <div className="password-reveal-overlay" style={overlayStyle}>
          <span>
            {charsArray.map((letter, idx) => {
              const lit = litLevels[idx] || 0;
              return (
                <span
                  key={`pw-${idx}`}
                  ref={(el) => (charRefs.current[idx] = el)}
                  className="reveal-char"
                  style={{ '--lit': String(lit) }}
                >
                  <span className="masked-char">•</span>
                  <span className="plain-char">{letter}</span>
                </span>
              );
            })}
          </span>
        </div>
      )}

      {/* Overlay ký tự xác nhận mật khẩu phát sáng */}
      {confirmPasswordInputRef?.current && (
        <div className="password-reveal-overlay" style={confirmOverlayStyle}>
          <span>
            {confirmCharsArray.map((letter, idx) => {
              const lit = confirmLitLevels[idx] || 0;
              return (
                <span
                  key={`cpw-${idx}`}
                  ref={(el) => (confirmCharRefs.current[idx] = el)}
                  className="reveal-char"
                  style={{ '--lit': String(lit) }}
                >
                  <span className="masked-char">•</span>
                  <span className="plain-char">{letter}</span>
                </span>
              );
            })}
          </span>
        </div>
      )}

      {/* The Central Glassmorphism Card */}
      <div className="flashlight-card">
        {/* Left Scene Panel */}
        <div className="flashlight-scene-panel hidden md:block">
          <div className="flashlight-landscape">
            {/* Vòm trời & Thiên thể */}
            <div className="flashlight-sky-objects">
              <div className="flashlight-sun" />
              <div className="flashlight-moon" />
            </div>

            {/* Đồi núi & Cảnh quan Ngày / Đêm */}
            <div className="flashlight-land day" />
            <div className="flashlight-land night" />
          </div>

          {/* Slogan & Giới thiệu FoodFast */}
          <div className="flashlight-scene-copy">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 mx-auto mb-3 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <h2>{sceneTitle}</h2>
            <p>{sceneDesc}</p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flashlight-form-panel">
          {/* Nút Toggle Chế độ Ngày / Đêm ở góc trên */}
          <div className="flex items-center justify-between mb-4">
            <div className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-md">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-sm tracking-tight text-gray-900 dark:text-white">FOODFAST</span>
            </div>
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => setNightMode(!nightMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  nightMode
                    ? 'bg-slate-800/90 text-amber-300 border-slate-700 hover:bg-slate-700 shadow-inner'
                    : 'bg-white/80 text-gray-700 border-gray-200/80 hover:bg-white shadow-sm'
                }`}
                title={nightMode ? 'Chuyển sang chế độ ban ngày' : 'Bật đèn pin soi sáng ban đêm'}
              >
                {nightMode ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>Ban đêm (Đèn pin bật)</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Ban ngày</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Header Title */}
          <div className="text-center mb-6">
            <h1 className={`text-2xl font-extrabold tracking-tight transition-colors duration-500 ${nightMode ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h1>
            <p className={`text-xs mt-1 transition-colors duration-500 ${nightMode ? 'text-slate-400' : 'text-gray-500'}`}>
              {subtitle}
            </p>
          </div>

          {/* Form Content (Passed from Parent) */}
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Component Chú Cú Tương Tác
 * Đậu trên đầu ô input Email
 */
export function InteractiveOwl({ owlRef, isLit = false, gaze = {} }) {
  return (
    <div
      ref={owlRef}
      className={`email-owl ${isLit ? 'is-lit' : ''}`}
      style={{
        opacity: isLit ? 1 : 0,
        '--owl-gaze-x': `${gaze.x || 0}px`,
        '--owl-gaze-y': `${gaze.y || 0}px`,
        '--owl-head-x': `${gaze.headX || 0}px`,
        '--owl-head-y': `${gaze.headY || 0}px`,
        '--owl-tilt': `${gaze.tilt || 0}deg`
      }}
    >
      <div className="owl-art">
        <img src="/flashlight-assets/owl-perch.svg" alt="Perch" />
        <div className="owl-breath">
          <img src="/flashlight-assets/owl-body.svg" alt="Body" />
          <div className="owl-head">
            <img src="/flashlight-assets/owl-head.svg" alt="Head" />
            <div className="owl-eyes">
              <img src="/flashlight-assets/owl-eyes.svg" alt="Eyes" />
              <div className="owl-gaze">
                <img src="/flashlight-assets/owl-gaze.svg" alt="Gaze" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
