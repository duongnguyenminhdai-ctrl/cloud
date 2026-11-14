import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'foodfast-theme';
const DEFAULT_THEME = 'dark'; // Theo yêu cầu người dùng: Mặc định là 'dark' ("Candlelit Studio")

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {}
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return DEFAULT_THEME;
  });

  const applyThemeToDOM = useCallback((mode) => {
    const isDark = mode === 'dark';
    const root = document.documentElement;
    root.dataset.theme = mode;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Phát tín hiệu 2 chiều tới tất cả iframe con (Meng To Sketchbook)
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({ type: 'foodfast-theme-change', theme: mode }, '*');
      });
    } catch (e) {}
  }, []);

  const setTheme = useCallback((mode) => {
    const validMode = mode === 'light' ? 'light' : 'dark';
    setThemeState(validMode);
    try {
      localStorage.setItem(THEME_KEY, validMode);
    } catch (e) {}
    applyThemeToDOM(validMode);
  }, [applyThemeToDOM]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Khởi tạo và lắng nghe thông điệp 2 chiều từ iframe con
  useEffect(() => {
    applyThemeToDOM(theme);

    const handleMessage = (e) => {
      if (e.data && e.data.type === 'foodfast-theme-change' && e.data.theme) {
        if (e.data.theme !== theme) {
          setTheme(e.data.theme);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [theme, applyThemeToDOM, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
