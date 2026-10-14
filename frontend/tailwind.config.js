/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fondos
        surface: {
          DEFAULT: 'var(--color-surface)',
          light: 'var(--color-surface-light)',
          lighter: 'var(--color-surface-lighter)',
          border: 'var(--color-surface-border)',
        },
        // Primario (esmeralda)
        primary: {
          DEFAULT: '#10b981',
          dark: '#059669',
          light: 'var(--color-primary-text)',
          text: 'var(--color-primary-text)',
        },
        // Secundario (cobre/ámbar)
        secondary: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
          light: '#fbbf24',
        },
        // Estados
        success: '#10b981',
        warning: '#f59e0b',
        danger: {
          DEFAULT: '#ef4444',
          text: 'var(--color-danger-text)',
        },
        'warning-text': 'var(--color-warning-text)',
        info: '#06b6d4',
        // Texto
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          light: 'var(--color-text-light)',
        },
      },
    },
  },
  plugins: [],
};