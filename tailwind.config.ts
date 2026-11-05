import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213D",
        slate2: "#5B677D",
        line: "#DDE2EA",
        surface: "#F4F6FA",
        risk: { high: "#C0392B", medium: "#C98A0B", low: "#2E7D5B" },
      },
    },
  },
  plugins: [],
};
export default config;
