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
        // Blyss brand palette (from web CSS vars)
        primary: "#FF5EA0",       // blyss-pink hsl(336 99% 68%)
        "primary-light": "#FFE5EF", // blyss-pink-light
        secondary: "#C9934A",     // blyss-gold hsl(32 60% 65%)
        "secondary-light": "#FAF1E6",
        cream: "#F7F3EF",         // blyss-cream
        background: "#FFEAF1",    // app background
        card: "#FFFFFF",
        border: "#EDE7E0",        // hsl(30 20% 90%)
        muted: "#F7F3EF",
        "muted-foreground": "#6E7280", // hsl(240 5% 45%)
        foreground: "#09090B",    // near-black
        destructive: "#EF4444",
        success: "#22C55E",
        warning: "#F59E0B",
        // Role colors
        "client-primary": "#FF5EA0",
        "pro-primary": "#8B5CF6",
        "admin-primary": "#F97316",
      },
      fontFamily: {
        sans: ["System"],
        display: ["System"],
      },
      borderRadius: {
        "2xl": 16,
        "3xl": 24,
        "4xl": 32,
      },
    },
  },
  plugins: [],
};
