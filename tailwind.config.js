/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'terminal': {
          'bg': '#0a0a0f',
          'surface': '#12121a',
          'border': '#1e1e2e',
          'muted': '#3a3a4a',
        },
        'accent': {
          'primary': '#00ff88',
          'secondary': '#00d4ff',
          'warning': '#ffaa00',
          'danger': '#ff4466',
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'display': ['Syne', 'sans-serif'],
        'body': ['IBM Plex Sans', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 136, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 136, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
