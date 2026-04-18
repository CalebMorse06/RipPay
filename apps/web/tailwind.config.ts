import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light surfaces (primary)
        bg: "#ffffff",
        surface: "#f5f6f8",
        "surface-2": "#f0f2f5",
        border: "#e5e7eb",
        ink: "#111418",
        subtle: "#6b7280",
        tertiary: "#9ca3af",

        // Accent — Square-style blue
        accent: "#0070e0",
        "accent-dim": "#e0eefd",
        "accent-pressed": "#0a5fbe",

        // State
        success: "#10b981",
        "success-dim": "#d1fae5",
        warn: "#f59e0b",
        danger: "#ef4444",

        // Dark receipt palette (buyer success screen / merchant paid)
        "receipt-bg": "#0f1013",
        "receipt-card": "#1a1c21",
        "receipt-row": "#23262c",
        "receipt-ink": "#ffffff",
        "receipt-subtle": "#9ca3af",
        "receipt-border": "#2a2e35",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
      fontSize: {
        hero: ["72px", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "hero-sm": ["44px", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "800" }],
      },
      borderRadius: {
        pill: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
