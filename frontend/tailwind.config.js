/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#15385B',
          dark: '#0B2545',
        },
        'blue-primary': '#0866C6',
        'blue-light': '#EAF3FC',
        'page-bg': '#F4F7FB',
        'card-bg': '#FFFFFF',
        'text-main': '#18324F',
        'text-secondary': '#64748B',
        border: '#D9E2EC',
        success: '#15803D',
        warning: '#B45309',
        error: '#B91C1C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(11, 37, 69, 0.05), 0 1px 2px -1px rgba(11, 37, 69, 0.05)',
        'card': '0 4px 6px -1px rgba(11, 37, 69, 0.07), 0 2px 4px -2px rgba(11, 37, 69, 0.05)',
        'card-hover': '0 10px 15px -3px rgba(11, 37, 69, 0.08), 0 4px 6px -4px rgba(11, 37, 69, 0.04)',
      }
    },
  },
  plugins: [],
}
