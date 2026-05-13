/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './constants.tsx', './index.tsx', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
