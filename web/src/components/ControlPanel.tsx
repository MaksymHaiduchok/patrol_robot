"use client";

import { type ReactNode, useEffect, useState } from "react";
import type { SystemMode } from "@/lib/protocol";
import type { ControlMode, Direction } from "@/lib/types";

const KEY_DIRECTIONS: Record<string, Direction> = {
  w: "forward",
  arrowup: "forward",
  s: "backward",
  arrowdown: "backward",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};

type ControlPanelProps = {
  systemMode: SystemMode;
  onSystemModeChange: (mode: SystemMode) => void;
  controlMode: ControlMode;
  onControlModeChange: (mode: ControlMode) => void;
};

type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-md bg-bg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded px-2 py-1.5 text-sm font-medium transition-colors ${
            option.value === value ? "bg-accent text-white" : "text-muted hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type DirectionButtonProps = {
  direction: Direction;
  label: string;
  active: boolean;
  disabled: boolean;
  className: string;
};

function DirectionButton({ direction, label, active, disabled, className }: DirectionButtonProps) {
  return (
    <button
      type="button"
      aria-label={direction}
      disabled={disabled}
      className={`flex size-12 items-center justify-center rounded-md text-lg transition-colors disabled:opacity-40 ${className} ${
        active ? "bg-accent text-white" : "bg-surface-raised hover:bg-border"
      }`}
    >
      {label}
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{children}</h2>;
}

export function ControlPanel({
  systemMode,
  onSystemModeChange,
  controlMode,
  onControlModeChange,
}: ControlPanelProps) {
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [speed, setSpeed] = useState(40);
  const manual = controlMode === "MANUAL" && systemMode === "PATROL";

  useEffect(() => {
    if (!manual) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault();
      setActiveDirection(direction);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (KEY_DIRECTIONS[event.key.toLowerCase()]) setActiveDirection(null);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [manual]);

  return (
    <aside className="flex flex-col gap-6 border-border bg-surface p-4 lg:w-60 lg:shrink-0 lg:border-r">
      <section>
        <SectionTitle>Режим системи</SectionTitle>
        <Segmented
          options={[
            { value: "PATROL", label: "Патруль" },
            { value: "STATIONARY", label: "Стаціонар" },
          ]}
          value={systemMode}
          onChange={onSystemModeChange}
        />
      </section>

      <section>
        <SectionTitle>Керування</SectionTitle>
        <Segmented
          options={[
            { value: "AUTO", label: "Авто" },
            { value: "MANUAL", label: "Ручне" },
          ]}
          value={controlMode}
          onChange={onControlModeChange}
        />
      </section>

      <section>
        <SectionTitle>Рух</SectionTitle>
        <div className="grid w-fit grid-cols-3 gap-1.5">
          <DirectionButton direction="forward" label="▲" active={activeDirection === "forward"} disabled={!manual} className="col-start-2" />
          <DirectionButton direction="left" label="◀" active={activeDirection === "left"} disabled={!manual} className="col-start-1 row-start-2" />
          <DirectionButton direction="backward" label="▼" active={activeDirection === "backward"} disabled={!manual} className="col-start-2 row-start-2" />
          <DirectionButton direction="right" label="▶" active={activeDirection === "right"} disabled={!manual} className="col-start-3 row-start-2" />
        </div>
        <p className="mt-2 text-xs text-muted">
          {manual ? "WASD або стрілки на клавіатурі" : "Доступно в ручному режимі патруля"}
        </p>
      </section>

      <section>
        <SectionTitle>Швидкість: {speed}%</SectionTitle>
        <input
          type="range"
          min={0}
          max={100}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          disabled={!manual}
          className="w-full accent-accent disabled:opacity-40"
        />
      </section>

      <section className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          className="rounded-md bg-live py-2.5 font-semibold text-white hover:opacity-90"
        >
          Стоп
        </button>
        <button
          type="button"
          className="rounded-md bg-surface-raised py-2.5 font-semibold hover:bg-border"
        >
          Продовжити патруль
        </button>
      </section>
    </aside>
  );
}
