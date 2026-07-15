import type { Config } from "tailwindcss";

// 5280 Auto Studio brand palette — navy base, blue + gold accents, red for warnings only.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#020B14",       // midnight navy background
        deep: "#061B2E",       // deep navy
        surface: "#0B1F35",    // card navy
        surface2: "#0E2A45",   // raised / hover
        line: "#1F3A56",       // border blue-gray
        blue: "#0A66B2",       // brand blue
        accent: "#1683E2",     // bright blue accent (operational KPIs)
        gold: "#F5C542",       // gold accent (money KPIs)
        yellow: "#FFD84D",     // yellow highlight
        silver: "#B8C2CC",     // metallic silver
        ink: "#F8FAFC",        // white text
        muted: "#94A3B8",      // muted text
        danger: "#E11A22",     // red — warnings / past due only
        good: "#22C55E",       // green — active / paid / positive
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -14px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(22,131,226,0.15), 0 8px 30px -10px rgba(22,131,226,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
