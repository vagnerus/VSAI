/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        platinum: "var(--platinum-light)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        silver: {
          base: "#C0C0C0",
          dark: "#848482",
        },
        snow: "#FAFAFA",
      },
      backgroundImage: {
        'silver-gradient': "linear-gradient(145deg, #f0f0f0, #c0c0c0)",
        'platinum-glass': "linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(229, 228, 226, 0.2))",
      },
      animation: {
        shimmer: "shimmer 2s infinite linear",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
}
