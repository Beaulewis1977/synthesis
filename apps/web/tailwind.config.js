/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light mode colors per UI spec
        'bg-primary': '#ffffff',
        'bg-secondary': '#f5f5f5',
        'bg-hover': '#e8e8e8',
        'text-primary': '#1a1a1a',
        'text-secondary': '#666666',
        border: '#e0e0e0',
        accent: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
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
