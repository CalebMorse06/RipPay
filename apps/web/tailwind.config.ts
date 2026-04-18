import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f17",
        surface: "#121826",
        border: "#1f2a3d",
        ink: "#e6ebf4",
        subtle: "#8a93a6",
        accent: "#4cc9f0",
        success: "#2ecc71",
        warn: "#f5b301",
        danger: "#ef4444",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
