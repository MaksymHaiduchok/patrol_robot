export type StatTone = "ok" | "danger" | "warn" | "accent" | "neutral";

type StatCardProps = {
  label: string;
  value: string;
  tone: StatTone;
  critical?: boolean;
  mono?: boolean;
  bar?: number | null;
};

const DOT_CLASSES: Record<StatTone, string> = {
  ok: "bg-ok",
  danger: "bg-danger",
  warn: "bg-warn",
  accent: "bg-accent",
  neutral: "bg-text-disabled",
};

const VALUE_CLASSES: Record<StatTone, string> = {
  ok: "text-text",
  danger: "text-danger-text",
  warn: "text-warn-text",
  accent: "text-accent-text",
  neutral: "text-text-muted",
};

export function StatCard({ label, value, tone, critical = false, mono = false, bar = null }: StatCardProps) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 rounded-[10px] border p-3 ${
        critical ? "border-danger-border bg-danger-surface" : "border-border bg-surface-2"
      }`}
    >
      <span className={`text-caption ${critical ? "text-danger-text" : "text-text-muted"}`}>{label}</span>
      <span
        className={`flex items-center gap-2 text-heading font-semibold ${VALUE_CLASSES[tone]} ${mono ? "font-mono" : ""}`}
      >
        <span className={`size-2 shrink-0 rounded-full ${DOT_CLASSES[tone]}`} />
        {value}
      </span>
      {bar !== null && (
        <span className="block h-1 overflow-hidden rounded-[2px] bg-border">
          <span className={`block h-1 ${DOT_CLASSES[tone]}`} style={{ width: `${bar}%` }} />
        </span>
      )}
    </div>
  );
}
