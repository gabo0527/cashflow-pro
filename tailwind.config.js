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
        // Professional Fintech Primary - Royal Blue
        'accent-primary': '#3b82f6',
        'accent-secondary': '#94a3b8',
        'accent-success': '#10b981',
        'accent-danger': '#ef4444',
        'accent-warning': '#f59e0b',
        
        // Dark Theme - Slate tones for sophisticated look
        'terminal-bg': '#0f172a',      // Slate 900 - Deep navy
        'terminal-surface': '#1e293b', // Slate 800 - Card background
        'terminal-border': '#334155',  // Slate 700 - Borders
        
        // Extended palette
        'slate': {
          850: '#1a2234',
          950: '#0a0f1a',
        },
        
        // Chart colors
        'chart': {
          revenue: '#10b981',
          expense: '#ef4444',
          overhead: '#f59e0b',
          investment: '#8b5cf6',
          payroll: '#ec4899',
          opex: '#f97316',
          net: '#06b6d4',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(59, 130, 246, 0.3)',
        'glow': '0 0 25px -5px rgba(59, 130, 246, 0.4)',
        'glow-lg': '0 0 35px -5px rgba(59, 130, 246, 0.5)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-shine': 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.05) 50%, transparent 75%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
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
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};

export default config;
