/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1a1f2e',
          light: '#232936',
          border: '#3a4150',
        },
        primary: '#5b8def',
        success: '#4ade80',
        warning: '#fbbf24',
        danger: '#f87171',
        muted: '#8b93a7',
      },
    },
  },
  plugins: [],
};
