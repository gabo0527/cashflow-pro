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
        // Professional Fintech - Muted Gold Accent
        'accent-primary': '#C9A44D',
        'accent-secondary': '#9AA1A9',
        'accent-success': '#1F7A5B',
        'accent-danger': '#8C2F2F',
        'accent-warning': '#C9A44D',
        
        // Dark Theme - Charcoal/Graphite
        'terminal-bg': '#0F1113',
        'terminal-surface': '#161A1D',
        'terminal-border': '#2A3036',
        
        // Extended palette
        'charcoal': '#0F1113',
        'graphite': '#161A1D',
        'dark-slate': '#1E2328',
        'muted-steel': '#2A3036',
        'soft-white': '#E6E8EB',
        'cool-gray': '#9AA1A9',
        'steel-gray': '#5F6A72',
        'muted-gold': '#C9A44D',
        'deep-green': '#1F7A5B',
        'brick-red': '#8C2F2F',
        'muted-olive': '#6E7F4E',
        
        // Chart colors
        'chart': {
          revenue: '#1F7A5B',
          expense: '#8C2F2F',
          overhead: '#C9A44D',
          investment: '#6E7F4E',
          neutral: '#5F6A72',
          line: '#9AA1A9',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(201, 164, 77, 0.2)',
        'glow': '0 0 25px -5px rgba(201, 164, 77, 0.3)',
        'glow-lg': '0 0 35px -5px rgba(201, 164, 77, 0.4)',
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
