import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
      },
      colors: {
        sber: {
          DEFAULT: "#21a038",
          dark: "#198030",
          muted: "rgba(33, 160, 56, 0.14)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
