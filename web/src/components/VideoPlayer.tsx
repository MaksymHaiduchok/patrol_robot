"use client";

import { useEffect, useState } from "react";
import { VISION_STREAM_URL } from "@/lib/config";

const FIRST_FRAME_TIMEOUT_MS = 5000;

type VideoPlayerProps = {
  online: boolean;
};

export function VideoPlayer({ online }: VideoPlayerProps) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), FIRST_FRAME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [attempt, loaded, failed]);

  const retry = () => {
    setLoaded(false);
    setFailed(false);
    setAttempt((value) => value + 1);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
      {failed ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
          <span>Немає сигналу з камери</span>
          <button
            type="button"
            onClick={retry}
            className="rounded bg-surface-raised px-3 py-1.5 text-sm text-foreground hover:bg-border"
          >
            Перепідключитись
          </button>
        </div>
      ) : (
        <img
          key={attempt}
          src={`${VISION_STREAM_URL}?attempt=${attempt}`}
          alt="Відео з камери робота"
          className="h-full w-full object-contain"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {online && loaded && !failed && (
        <span className="absolute left-3 top-3 rounded bg-live px-2 py-0.5 text-xs font-bold uppercase">
          Live
        </span>
      )}
    </div>
  );
}
