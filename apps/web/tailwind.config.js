/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: v('app'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        line: v('line'),
        fg: v('fg'),
        muted: v('muted'),
        primary: { DEFAULT: v('primary'), soft: v('primary-soft'), fg: v('primary-fg'), hover: v('primary-hover') },
        danger: v('danger'),
        success: v('success'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        hand: ['Caveat', 'Patrick Hand', 'cursive'],
      },
      borderRadius: { lg: '10px', xl: '12px' },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 4px 16px rgb(16 24 40 / 0.06)',
        pop: '0 8px 30px rgb(16 24 40 / 0.14)',
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(16px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: { 'slide-in': 'slide-in 160ms ease-out', 'fade-in': 'fade-in 120ms ease-out' },
    },
  },
  plugins: [],
};
