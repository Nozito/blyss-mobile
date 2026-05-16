/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./contexts/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Semantic tokens (mirroring web CSS vars)
        background: "#FFEAF1",
        foreground: "#09090B",
        border: "#EBE6E0",
        input: "#EBE6E0",
        ring: "#FE5D9D",
        primary: {
          DEFAULT: "#FE5D9D",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#DBA970",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F8F5F1",
          foreground: "#6D6D78",
        },
        accent: {
          DEFAULT: "#FFE6F0",
          foreground: "#FE5D9D",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#09090B",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#09090B",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        // Blyss brand tokens
        blyss: {
          pink: "#FE5D9D",
          "pink-light": "#FFE6F0",
          gold: "#DBA970",
          "gold-light": "#F7F0E8",
          cream: "#F8F5F1",
        },
        // Status colors
        success: "#22C55E",
        warning: "#F59E0B",
        // Role colors
        "client-primary": "#FE5D9D",
        "pro-primary": "#8B5CF6",
        "admin-primary": "#F97316",
      },
      fontFamily: {
        sans: ["System", "sans-serif"],
        display: ["System", "sans-serif"],
      },
      borderRadius: {
        sm: 12,
        md: 14,
        lg: 16,
        "3xl": 24,
        "4xl": 32,
      },
    },
  },
  plugins: [],
};
