import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Forseti brand colors
        'forseti-lime': '#B7FF00',
        'forseti-lime-hover': '#C8FF33',
        'forseti-lime-dim': 'rgba(183, 255, 0, 0.1)',

        // Background colors
        'forseti-bg': {
          primary: '#0A0A0A',
          secondary: '#1A1A1A',
          card: '#1E1E1E',
          elevated: '#252525',
          hover: '#2A2A2A',
        },

        // Text colors
        'forseti-text': {
          primary: '#FFFFFF',
          secondary: '#999999',
          muted: '#666666',
          inverse: '#0A0A0A',
        },

        // Accent colors
        'forseti-success': '#00FF88',
        'forseti-error': '#FF3B30',
        'forseti-warning': '#FFD600',
        'forseti-info': '#0A84FF',

        // Border colors
        'forseti-border': '#333333',
        'forseti-border-subtle': '#252525',
      },
      fontFamily: {
        sans: [
          'Roboto',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Courier New"', 'monospace'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        bold: '700',
      },
      boxShadow: {
        'lime-glow': '0 0 20px rgba(183, 255, 0, 0.3)',
        'lime-glow-lg': '0 0 40px rgba(183, 255, 0, 0.4)',
      },
      borderRadius: {
        'forseti': '12px',
      },
    },
  },
  plugins: [],
}

export default config
