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
        // Modern Enterprise - Electric Green Accent
        'accent-primary': '#00d4aa',
        'accent-secondary': '#94a3b8',
        'accent-success': '#22c55e',
        'accent-danger': '#ef4444',
        'accent-warning': '#f59e0b',
        
        // Dark Theme - Deep Navy
        'terminal-bg': '#0c1222',
        'terminal-surface': '#141c2e',
        'terminal-border': '#2a3a55',
        
        // Extended palette
        'navy': {
          900: '#0c1222',
          800: '#141c2e',
          700: '#1c2740',
          600: '#2a3a55',
          500: '#3a4a65',
        },
        
        // Chart colors
        'chart': {
          revenue: '#22c55e',
          expense: '#ef4444',
          overhead: '#f59e0b',
          investment: '#3b82f6',
          primary: '#00d4aa',
          secondary: '#94a3b8',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(0, 212, 170, 0.2)',
        'glow': '0 0 25px -5px rgba(0, 212, 170, 0.3)',
        'glow-lg': '0 0 35px -5px rgba(0, 212, 170, 0.4)',
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
