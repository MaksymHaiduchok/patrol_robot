"use client";

import { Check } from "lucide-react";
import { useEffect } from "react";

type ToastProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  durationMs?: number;
};

export function Toast({ message, actionLabel, onAction, onClose, durationMs = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [onClose, durationMs]);

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 flex w-[min(420px,calc(100vw-48px))] items-center gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3.5 py-3 shadow-pop"
    >
      <Check aria-hidden className="size-[18px] text-danger-text" strokeWidth={2.5} />
      <span className="flex-1 text-body font-semibold">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-8 rounded-sm bg-surface-3 px-2.5 text-small font-semibold text-accent-text hover:bg-border"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
