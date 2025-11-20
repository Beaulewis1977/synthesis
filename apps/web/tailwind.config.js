/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light mode colors per UI spec (WCAG AA compliant)
        'bg-primary': '#ffffff',
        'bg-secondary': '#f5f5f5',
        'bg-hover': '#e8e8e8',
        'text-primary': '#1a1a1a',
        'text-secondary': '#666666',
        border: '#e0e0e0',
        accent: '#1d4ed8', // blue-700 (darker for ≥4.5:1 contrast)
        success: '#15803d', // green-700 (darker for ≥4.5:1 contrast)
        warning: '#b45309', // amber-700 (darker for ≥4.5:1 contrast)
        error: '#dc2626', // red-600 (was #ef4444 red-500) - ~4.83:1 contrast
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '24px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
    },
  },
  plugins: [],
};
