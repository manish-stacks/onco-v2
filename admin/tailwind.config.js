/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // deep petrol-slate — sab text aur chrome ka base
        ink: {
          DEFAULT: '#12212B',
          700: '#2A3E4B',
          500: '#546A78',
          300: '#8DA0AB',
          100: '#C9D5DC',
        },
        // clinical teal — primary action colour
        teal: {
          DEFAULT: '#0E7C7B',
          dark: '#0A5F5E',
          light: '#E3F1F1',
        },
        paper: {
          DEFAULT: '#F5F7F7',
          card: '#FFFFFF',
          sunk: '#EDF1F1',
        },
        line: {
          DEFAULT: '#DDE5E7',
          strong: '#C3D0D4',
        },
        // signal system — inventory + order states
        signal: {
          ok: '#1B7F4D',
          okBg: '#E6F4EC',
          warn: '#A9610B',
          warnBg: '#FDF1E1',
          danger: '#B3261E',
          dangerBg: '#FBEAE9',
          info: '#1D5FA8',
          infoBg: '#E8F0FA',
          idle: '#546A78',
          idleBg: '#EDF1F1',
        },
      },
      fontFamily: {
        // IBM Plex — pharmacy software ki vernacular: engineered, data-first
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '5px',
        lg: '7px',
      },
      boxShadow: {
        pop: '0 8px 28px -6px rgba(18, 33, 43, 0.18), 0 2px 6px -2px rgba(18, 33, 43, 0.1)',
        rail: 'inset 3px 0 0 0 var(--rail)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: 0, transform: 'translateY(4px)' },
          to: { opacity: 1, transform: 'none' },
        },
        'slide-in': {
          from: { opacity: 0, transform: 'translateX(12px)' },
          to: { opacity: 1, transform: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.16s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
