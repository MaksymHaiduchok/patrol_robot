import type { SystemMode } from "@/lib/protocol";
import type { VisionHealth } from "@/lib/types";

type StatusBarProps = {
  health: VisionHealth | null;
  systemMode: SystemMode;
};

type StatusItemProps = {
  label: string;
  value: string;
  tone: "ok" | "warn" | "off";
};

const TONE_CLASSES: Record<StatusItemProps["tone"], string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  off: "bg-muted",
};

function StatusItem({ label, value, tone }: StatusItemProps) {
  return (
    <div className="rounded-md bg-surface-raised px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 font-medium">
        <span className={`size-2 rounded-full ${TONE_CLASSES[tone]}`} />
        {value}
      </div>
    </div>
  );
}

export function StatusBar({ health, systemMode }: StatusBarProps) {
  const cameraConnected = health?.source_connected ?? false;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold">Патрулювання території</h1>
        <span className="text-sm text-muted">freenove-01</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <StatusItem
          label="Vision"
          value={health ? "онлайн" : "офлайн"}
          tone={health ? "ok" : "off"}
        />
        <StatusItem
          label="Камера"
          value={cameraConnected ? `${health?.fps ?? 0} FPS` : "немає сигналу"}
          tone={cameraConnected ? "ok" : health ? "warn" : "off"}
        />
        <StatusItem label="Робот" value="офлайн" tone="off" />
        <StatusItem label="Відстань" value="—" tone="off" />
        <StatusItem
          label="Режим"
          value={systemMode === "PATROL" ? "патруль" : "стаціонар"}
          tone="ok"
        />
      </div>
    </section>
  );
}
