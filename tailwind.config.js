/** @type {import('tailwindcss').Config} */
export default {
  content: ['./public/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        // Radiation Green Theme
        'terminal': {
          'green': '#33ff00',
          'green-dim': '#1a8000',
          'green-glow': '#66ff33',
        },
        // Industrial Amber Theme
        'amber': {
          'terminal': '#ffb000',
          'dim': '#805800',
          'glow': '#ffc433',
        },
        // CRT Background
        'crt': {
          'black': '#0a0a0a',
          'dark': '#111111',
          'scanline': 'rgba(0, 0, 0, 0.3)',
        },
        // Threat Levels
        'threat': {
          'low': '#33ff00',
          'medium': '#ffb000',
          'high': '#ff6600',
          'critical': '#ff0033',
        },
      },
      fontFamily: {
        'mono': ['IBM Plex Mono', 'Courier New', 'monospace'],
        'terminal': ['VT323', 'monospace'],
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
        'scanline': 'scanline 8s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.95' },
        },
        glow: {
          '0%': { textShadow: '0 0 5px currentColor' },
          '100%': { textShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
      },
      boxShadow: {
        'terminal': '0 0 10px rgba(51, 255, 0, 0.5), inset 0 0 60px rgba(51, 255, 0, 0.1)',
        'amber': '0 0 10px rgba(255, 176, 0, 0.5), inset 0 0 60px rgba(255, 176, 0, 0.1)',
      },
    },
  },
  plugins: [],
};
