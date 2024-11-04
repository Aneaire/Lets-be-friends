/** @type {import('tailwindcss').Config} */
export default {
  // darkMode: ["class"],
  // safelist: ["dark"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: "var(--font-itim)",
        accent: ["Itim", "cursive"],
        regular: ["Montserrat Alternates", "sans-serif"],
      },
      colors: {
        accent: {
          1: "hsl(var(--color-accent1) / <alpha-value>)",
          2: "hsl(var(--color-accent2) / <alpha-value>)",
        },
        content: "hsl(var(--color-text) / <alpha-value>)",
        bg: "hsl(var(--color-bkg) / <alpha-value>)",
        bgLight: "hsl(var(--color-accentLight) / <alpha-value>)",
        textLight: "var(--color-textLight)",
        red: "#FF5A5A",
        dark: {
          1: "hsl(240, 5%, 13%)",
        },
        light: {
          1: "hsl(0, 14%, 93%)/60",
        },
        inputss: "hsl(var(--color-input) / <alpha-value>)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
