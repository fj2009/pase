import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F5F2EA",
        "paper-raised": "#FBF9F4",
        "paper-deep": "#EDE8DC",
        ink: "#1E211C",
        "ink-soft": "#55594F",
        "ink-faint": "#7C8074",
        line: "#D8D2C4",
        "line-strong": "#B9B2A2",
        olive: "#3E4A33",
        "olive-deep": "#2E3726",
        "olive-soft": "#E3E7D8",
        terracotta: "#A24A2B",
        "terracotta-soft": "#F2E1D8",
        amber: "#9A6714",
        "amber-soft": "#F4E8CB",
        danger: "#8B2E2E",
        "danger-soft": "#F4DEDC",
        ok: "#3F6449",
        "ok-soft": "#DDE9DF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-newsreader)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.95rem", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        xs: "2px",
        sm: "3px",
        md: "5px",
      },
      boxShadow: {
        lift: "0 1px 0 rgba(30,33,28,0.06), 0 8px 24px -18px rgba(30,33,28,0.5)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "fade-up": "fade-up 280ms ease-out both",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
