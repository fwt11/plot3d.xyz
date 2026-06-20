/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        brand: {
          dark: '#1a1a2e',
          deeper: '#0f0f1a',
          accent: '#0ea5e9',
          highlight: '#f97316',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Source Sans 3', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
