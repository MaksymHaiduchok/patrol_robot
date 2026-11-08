"use client";

import { Play, RotateCw, TriangleAlert, VideoOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { VISION_STREAM_URL } from "@/lib/config";

export type AlarmInfo = {
  time: string;
  secondsAgo: number;
  who: string;
};

type VideoPanelProps = {
  cameraOnline: boolean;
  fps: number | null;
  clock: string;
  alarm: AlarmInfo | null;
  onResume: () => void;
};

function LiveBadge() {
  return (
    <span className="absolute bottom-3 left-3 inline-flex h-6 items-center gap-1.5 rounded-xs bg-danger px-2 text-caption font-bold text-white">
      <span className="size-1.5 animate-live-pulse rounded-full bg-white" />
      LIVE
    </span>
  );
}

function NoSignal({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface p-6 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-2 text-text-muted">
        <VideoOff aria-hidden className="size-[26px]" />
      </span>
      <span className="text-title font-semibold">Немає сигналу з камери</span>
      <span className="max-w-[380px] text-body text-text-muted">
        Vision-сервер не отримує кадри зі смартфона. Перевірте, чи відкрита камера на телефоні та чи є Wi-Fi.
      </span>
      <Button variant="secondary" className="mt-1" icon={<RotateCw aria-hidden className="size-4" />} onClick={onRetry}>
        Перепідключити
      </Button>
      <span className="absolute bottom-3 left-3 inline-flex h-6 items-center gap-1.5 rounded-xs bg-border-strong px-2 text-caption font-bold text-text-muted">
        <span className="size-1.5 rounded-full bg-ev-left" />
        Offline
      </span>
    </div>
  );
}

function AlarmBanner({ alarm, onResume }: { alarm: AlarmInfo; onResume: () => void }) {
  return (
    <div
      role="alert"
      className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-3 rounded-md bg-danger px-3.5 py-3 text-white shadow-pop"
    >
      <TriangleAlert aria-hidden className="size-6" strokeWidth={2.2} />
      <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
        <span className="text-[17px] font-bold">Робот зупинено: людина в кадрі</span>
        <span className="text-small opacity-90">
          О <span className="font-mono">{alarm.time}</span> · {alarm.secondsAgo} с тому · {alarm.who}
        </span>
      </div>
      <button
        type="button"
        onClick={onResume}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-body font-bold text-danger"
      >
        <Play aria-hidden className="size-3.5 fill-current" />
        Продовжити патруль
      </button>
    </div>
  );
}

export function VideoPanel({ cameraOnline, fps, clock, alarm, onResume }: VideoPanelProps) {
  const [attempt, setAttempt] = useState(0);
  const [streamFailed, setStreamFailed] = useState(false);
  const showVideo = cameraOnline && !streamFailed;

  const retry = () => {
    setStreamFailed(false);
    setAttempt((value) => value + 1);
  };

  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-[10px] bg-black ${
        alarm ? "shadow-alarm-ring" : "ring-1 ring-border"
      }`}
    >
      {showVideo ? (
        <>
          <img
            key={attempt}
            src={`${VISION_STREAM_URL}?attempt=${attempt}`}
            alt="Відео з камери робота"
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => setStreamFailed(true)}
          />
          <LiveBadge />
          <span className="absolute bottom-3 right-3 rounded-xs bg-bg/75 px-2 py-[3px] font-mono text-caption text-text">
            {clock} · {fps === null ? "—" : Math.round(fps)} FPS
          </span>
        </>
      ) : (
        <NoSignal onRetry={retry} />
      )}
      {alarm && <AlarmBanner alarm={alarm} onResume={onResume} />}
    </div>
  );
}
