import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Caribou Lodge brand colors
        maroon: {
          50: '#fdf2f2',
          100: '#fbe8e8',
          200: '#f5d0d1',
          300: '#edaaad',
          400: '#e07a7e',
          500: '#cf4f55',
          600: '#b73640',
          700: '#982a33',
          800: '#7e262e',
          900: '#280003', // Primary dark maroon
          950: '#1a0002',
        },
        caramel: {
          50: '#fdf9f3',
          100: '#f5ede0', // Footer background
          200: '#ecdcc3',
          300: '#dfc4a0',
          400: '#d0a77a',
          500: '#c28c5a',
          600: '#af6f09', // Gold/brown accent
          700: '#8e5a3d',
          800: '#744a36',
          900: '#5f3e30',
        },
      },
      fontFamily: {
        sans: ['Nunito Sans', 'system-ui', 'sans-serif'],
        heading: ['Jost', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
