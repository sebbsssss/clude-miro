/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        clude: '#455cfa',
        bg: '#fafaf8',
        dark: '#111111',
        muted: '#8a8a8a',
        surface: '#ffffff',
        border: '#e8e8e6',
        'sys-default': '#c4c4c4',
        'sys-viking': '#e8a849',
        'sys-clude': '#455cfa',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
