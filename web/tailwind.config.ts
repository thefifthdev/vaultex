import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0e14',
        panel: '#141925',
        accent: '#7c5cff',
        accent2: '#2dd4bf',
      },
    },
  },
  plugins: [],
} satisfies Config;
