/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./apps/frontend/index.html",
    "./apps/frontend/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#10b981',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
