/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          500: '#f97316', // Orange food primary
          600: '#ea580c',
          700: '#c2410c',
        },
        paper: '#ece7dc',
        ink: {
          DEFAULT: '#2b2721',
          soft: 'rgba(43, 39, 33, 0.58)',
          faint: 'rgba(43, 39, 33, 0.36)'
        },
        earth: '#9a6a3e',
        hairline: 'rgba(43, 39, 33, 0.14)'
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Lora', 'Georgia', 'serif'],
        reading: ['Lora', 'Georgia', 'serif'],
        serif: ['Lora', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

