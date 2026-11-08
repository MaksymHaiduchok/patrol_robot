"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, Play, Square } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import type { SystemMode } from "@/lib/protocol";
import type { RobotStatus } from "@/lib/robot";
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

type ControlAsideProps = {
  systemMode: SystemMode;
  onSystemModeChange: (mode: SystemMode) => void;
  controlMode: ControlMode;
  onControlModeChange: (mode: ControlMode) => void;
  robot: RobotStatus;
  cameraOnline: boolean;
  alarm: boolean;
  onStop: () => void;
  onResume: () => void;
};

type PadButtonProps = {
  direction: Direction;
  label: string;
  icon: ReactNode;
  active: boolean;
  onPress: (direction: Direction | null) => void;
  className: string;
};

function PadButton({ direction, label, icon, active, onPress, className }: PadButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onPointerDown={() => onPress(direction)}
      onPointerUp={() => onPress(null)}
      onPointerLeave={() => active && onPress(null)}
      className={`inline-flex items-center justify-center rounded-[10px] ${className} ${
        active
          ? "bg-accent text-accent-on ring-[3px] ring-accent/35"
          : "border border-border-strong bg-surface-3 text-text hover:bg-border"
      }`}
    >
      {icon}
    </button>
  );
}

function Keycap({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-xs border border-b-2 border-border-strong px-1.5 py-px font-mono text-text">{children}</span>
  );
}

function ManualControls() {
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [speed, setSpeed] = useState(40);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
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
  }, []);

  const iconClass = "size-[22px]";
  const pad = (direction: Direction, label: string, icon: ReactNode, className: string) => (
    <PadButton
      direction={direction}
      label={label}
      icon={icon}
      active={activeDirection === direction}
      onPress={setActiveDirection}
      className={className}
    />
  );

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-heading font-semibold">Рух</span>
      <div className="grid grid-cols-[repeat(3,56px)] grid-rows-[repeat(3,56px)] gap-1.5 self-center">
        {pad("forward", "Вперед", <ChevronUp aria-hidden className={iconClass} strokeWidth={2.5} />, "col-start-2")}
        {pad("left", "Ліворуч", <ChevronLeft aria-hidden className={iconClass} strokeWidth={2.5} />, "col-start-1 row-start-2")}
        <span className="col-start-2 row-start-2 inline-flex items-center justify-center rounded-[10px] border border-border bg-bg font-mono text-[11px] text-ev-left">
          {speed}%
        </span>
        {pad("right", "Праворуч", <ChevronRight aria-hidden className={iconClass} strokeWidth={2.5} />, "col-start-3 row-start-2")}
        {pad("backward", "Назад", <ChevronDown aria-hidden className={iconClass} strokeWidth={2.5} />, "col-start-2 row-start-3")}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-caption text-text-muted">
        <Keycap>W A S D</Keycap>або<Keycap>стрілки</Keycap>· тримайте, щоб їхати
      </div>
      <div className="mt-1 flex flex-col gap-1.5">
        <div className="flex justify-between text-small">
          <label htmlFor="speed" className="text-text-muted">
            Швидкість
          </label>
          <span className="font-mono font-semibold">{speed}%</span>
        </div>
        <input
          id="speed"
          type="range"
          min={10}
          max={100}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className="w-full accent-accent"
        />
      </div>
    </div>
  );
}

export function ControlAside({
  systemMode,
  onSystemModeChange,
  controlMode,
  onControlModeChange,
  robot,
  cameraOnline,
  alarm,
  onStop,
  onResume,
}: ControlAsideProps) {
  const patrol = systemMode === "PATROL";
  const manual = patrol && controlMode === "MANUAL";
  const offline = !robot.online;

  const stopClasses = offline
    ? "bg-surface-3 text-text-disabled"
    : alarm
      ? "bg-danger-surface text-danger-text"
      : "bg-danger text-white hover:opacity-90";
  const resumeClasses = offline
    ? "border border-border bg-surface-2 text-text-disabled"
    : alarm
      ? "bg-accent text-accent-on hover:bg-accent-hover"
      : "border border-border-strong bg-surface-3 text-text hover:bg-border";

  return (
    <aside
      aria-label="Керування"
      className="flex min-w-0 flex-[1_1_260px] flex-col gap-3.5 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-col gap-2">
        <span className="text-heading font-semibold">Режим системи</span>
        <Segmented
          label="Режим системи"
          strong
          options={[
            { value: "PATROL", label: "Патруль" },
            { value: "STATIONARY", label: "Стаціонар" },
          ]}
          value={systemMode}
          onChange={onSystemModeChange}
        />
      </div>

      {!patrol && (
        <div className="flex gap-2.5 rounded-md border border-border bg-surface-2 p-3">
          <Info aria-hidden className="mt-px size-[18px] shrink-0 text-accent-text" />
          <div className="flex flex-col gap-1">
            <span className="text-body font-semibold">Камера стоїть нерухомо</span>
            <span className="text-small text-text-muted">
              Система лише спостерігає й записує події. Керування роботом вимкнене — щоб їздити, перемкніться на
              «Патруль» і закріпіть телефон на машинці.
            </span>
          </div>
        </div>
      )}

      {patrol && (
        <div className="flex flex-col gap-2">
          <span className="text-heading font-semibold">Керування</span>
          <Segmented
            label="Керування"
            disabled={!cameraOnline}
            options={[
              { value: "AUTO", label: "Авто" },
              { value: "MANUAL", label: "Ручне" },
            ]}
            value={controlMode}
            onChange={onControlModeChange}
          />
          <span className="text-small text-text-muted">
            {manual
              ? "Автопілот вимкнено. Ультразвуковий датчик усе одно зупинить робота перед перешкодою."
              : "Робот їздить сам і оминає перешкоди. Зупиняється, коли бачить людину."}
          </span>
        </div>
      )}

      {manual && <ManualControls />}

      {patrol && (
        <div className="mt-auto flex flex-col gap-2.5 border-t border-border pt-3.5">
          <button
            type="button"
            disabled={offline}
            onClick={onStop}
            className={`inline-flex h-13 items-center justify-center gap-2.5 rounded-md text-[16px] font-bold ${stopClasses}`}
          >
            <Square aria-hidden className="size-4 fill-current" />
            Стоп
          </button>
          <button
            type="button"
            disabled={offline}
            onClick={onResume}
            className={`inline-flex h-12 items-center justify-center gap-2.5 rounded-md text-[15px] font-semibold ${resumeClasses}`}
          >
            <Play aria-hidden className="size-3.5 fill-current" />
            Продовжити патруль
          </button>
          {offline && (
            <span className="flex items-center gap-2 text-small text-text-muted">
              <Info aria-hidden className="size-4" />
              Робот не підключений. Увімкніть живлення машинки.
            </span>
          )}
        </div>
      )}
    </aside>
  );
}
