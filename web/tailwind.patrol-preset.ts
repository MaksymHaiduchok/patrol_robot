// Patrol Robot — Tailwind preset з токенами дизайн-системи.
// Підключення: tailwind.config.ts → presets: [patrolPreset]
import type { Config } from "tailwindcss";

const patrolPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bg: "#0e0e10",
        surface: { DEFAULT: "#18181b", 2: "#1f1f23", 3: "#26262c" },
        border: { DEFAULT: "#2f2f35", strong: "#3a3a42" },
        text: { DEFAULT: "#efeff1", muted: "#adadb8", disabled: "#6b6b75" },
        accent: { DEFAULT: "#14b8a6", hover: "#2dd4bf", pressed: "#0f8f82", text: "#2dd4bf", on: "#0e0e10" },
        danger: { DEFAULT: "#eb0400", text: "#ff6b63", surface: "#2a1212", border: "#6b1a17" },
        warn: { DEFAULT: "#ffb300", text: "#ffc233", surface: "#3d2c00", border: "#6b4f00" },
        ok: { DEFAULT: "#2ecc71", text: "#5ee08f" },
        // Кольори подій — однакові для рамок на відео, стрічки, журналу й легенди
        ev: {
          person: "#2ecc71",   // Людина в кадрі
          own: "#3b6cff",      // Свій: <ім'я>
          stranger: "#eb0400", // Чужий
          left: "#8b8b96",     // Людина пішла
          unknown: "#ffb300",  // Особу не встановлено
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        caption: ["12px", "16px"],
        small: ["13px", "18px"],
        body: ["14px", "20px"],
        heading: ["15px", "22px"],
        title: ["18px", "26px"],
        display: ["24px", "32px"],
      },
      borderRadius: { xs: "3px", sm: "6px", md: "8px", lg: "12px", xl: "14px" },
      spacing: { 13: "52px" },
      boxShadow: {
        pop: "0 8px 24px rgba(0,0,0,.45)",
        modal: "0 24px 64px rgba(0,0,0,.6)",
        "alarm-ring": "0 0 0 3px #eb0400",
      },
      keyframes: {
        "feed-in": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "live-pulse": { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
      },
      animation: {
        "feed-in": "feed-in 200ms ease-out",
        "live-pulse": "live-pulse 1.6s ease-in-out infinite",
      },
      gridTemplateColumns: { panel: "280px minmax(0,1fr) 360px" },
    },
  },
};

export default patrolPreset;

// Мапа типу події → класи (використовувати в FeedItem, EventsTable, VideoLegend)
export type EventType = "person" | "own" | "stranger" | "left" | "unknown";

export const EVENT_STYLE: Record<EventType, { label: string; dot: string; text: string; tint: string; box: string; onBox: string }> = {
  person:   { label: "Людина в кадрі",       dot: "bg-ev-person",   text: "text-ok-text",     tint: "bg-ev-person/10",   box: "border-ev-person",   onBox: "text-bg" },
  own:      { label: "Свій",                 dot: "bg-ev-own",      text: "text-[#93a8ff]",   tint: "bg-ev-own/10",      box: "border-ev-own",      onBox: "text-bg" },
  stranger: { label: "Чужий",                dot: "bg-ev-stranger", text: "text-danger-text", tint: "bg-ev-stranger/15", box: "border-ev-stranger", onBox: "text-white" },
  left:     { label: "Людина пішла",         dot: "bg-ev-left",     text: "text-[#b8b8c2]",   tint: "bg-ev-left/10",     box: "border-ev-left",     onBox: "text-bg" },
  unknown:  { label: "Особу не встановлено", dot: "bg-ev-unknown",  text: "text-warn-text",   tint: "bg-ev-unknown/10",  box: "border-ev-unknown",  onBox: "text-bg" },
};

// Поріг відстані до перешкоди
export const distanceTone = (cm: number) => (cm < 25 ? "danger" : cm <= 50 ? "warn" : "ok");
