/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#0071fb', // Official OrtoUnifase Vibrant Blue (#0071FB)
          600: '#005ad1',
          700: '#0045a8',
          800: '#00327f',
          900: '#002057',
        },
      },
    },
  },
  plugins: [],
}
