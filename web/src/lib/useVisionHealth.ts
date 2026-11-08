"use client";

import { useEffect, useState } from "react";
import { VISION_URL } from "@/lib/config";
import type { VisionHealth } from "@/lib/types";

const POLL_INTERVAL_MS = 2000;

export function useVisionHealth(): VisionHealth | null {
  const [health, setHealth] = useState<VisionHealth | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`${VISION_URL}/health`, { cache: "no-store" });
        const data: VisionHealth = await response.json();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth(null);
      }
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return health;
}
