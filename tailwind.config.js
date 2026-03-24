/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0a0a0f',
          900: '#111118',
          800: '#1a1a26',
          700: '#242436',
          600: '#2e2e48',
          500: '#3d3d5c',
          400: '#5a5a80',
          300: '#8888aa',
          200: '#bbbbcc',
          100: '#e8e8f0',
          50:  '#f4f4f8',
        },
        amber: {
          500: '#f59e0b',
          400: '#fbbf24',
          300: '#fcd34d',
          200: '#fde68a',
          100: '#fef3c7',
          50:  '#fffbeb',
        },
        emerald: {
          600: '#059669',
          500: '#10b981',
          400: '#34d399',
          100: '#d1fae5',
          50:  '#ecfdf5',
        },
        rose: {
          600: '#e11d48',
          500: '#f43f5e',
          400: '#fb7185',
          100: '#ffe4e6',
          50:  '#fff1f2',
        },
        sky: {
          600: '#0284c7',
          500: '#0ea5e9',
          400: '#38bdf8',
          100: '#e0f2fe',
          50:  '#f0f9ff',
        },
        violet: {
          600: '#7c3aed',
          500: '#8b5cf6',
          400: '#a78bfa',
          100: '#ede9fe',
          50:  '#f5f3ff',
        },
      },
    },
  },
  plugins: [],
}
