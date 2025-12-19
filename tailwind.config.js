import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Professional Fintech Primary - Deep Blue
        'accent-primary': '#1d4ed8',
        'accent-secondary': '#64748b',
        'accent-success': '#10b981',
        'accent-danger': '#dc2626',
        'accent-warning': '#d97706',
        
        // Dark Theme - Deep charcoal/navy
        'terminal-bg': '#0a0f1a',
        'terminal-surface': '#111827',
        'terminal-border': '#1f2937',
        
        // Chart colors - NO purple
        'chart': {
          revenue: '#10b981',
          expense: '#dc2626',
          overhead: '#d97706',
          investment: '#0891b2',
          payroll: '#0d9488',
          opex: '#ea580c',
          net: '#0ea5e9',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(29, 78, 216, 0.3)',
        'glow': '0 0 25px -5px rgba(29, 78, 216, 0.4)',
        'glow-lg': '0 0 35px -5px rgba(29, 78, 216, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
