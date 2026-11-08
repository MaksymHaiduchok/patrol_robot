"use client";

import { useState } from "react";
import { VISION_STREAM_URL } from "@/lib/config";

type VideoPlayerProps = {
  online: boolean;
};

export function VideoPlayer({ online }: VideoPlayerProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  const retry = () => {
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
          onError={() => setFailed(true)}
        />
      )}
      {online && !failed && (
        <span className="absolute left-3 top-3 rounded bg-live px-2 py-0.5 text-xs font-bold uppercase">
          Live
        </span>
      )}
    </div>
  );
}
