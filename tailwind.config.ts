/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcd9ff",
          300: "#8ec1ff",
          400: "#599dff",
          500: "#3377ff",
          600: "#1c57f5",
          700: "#1543e1",
          800: "#1837b6",
          900: "#19348f",
        },
      },
    },
  },
  plugins: [],
};
