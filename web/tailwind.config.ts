import type { Config } from "tailwindcss";
import patrolPreset from "./tailwind.patrol-preset";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./tailwind.patrol-preset.ts"],
  presets: [patrolPreset],
};

export default config;
