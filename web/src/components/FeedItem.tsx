import { Check } from "lucide-react";
import { EVENT_STYLE, type FeedItemView } from "@/lib/eventView";

type FeedItemProps = {
  item: FeedItemView;
  onSelect?: () => void;
};

function Snapshot({ src }: { src: string | null }) {
  if (!src) return <SnapshotPlaceholder />;
  return (
    <img src={src} alt="Знімок події" className="h-12 w-[72px] shrink-0 rounded-xs bg-surface-3 object-cover" />
  );
}

function SnapshotPlaceholder() {
  return (
    <span className="relative h-12 w-[72px] shrink-0 overflow-hidden rounded-xs bg-surface-3">
      <svg width="72" height="48" viewBox="0 0 72 48" aria-hidden="true" className="text-border-strong">
        <circle cx="36" cy="16" r="7" fill="currentColor" />
        <path d="M24 48V34a12 12 0 0 1 24 0v14z" fill="currentColor" />
        <rect x="22" y="6" width="28" height="40" fill="none" strokeWidth="2" className="stroke-ev-stranger" />
      </svg>
    </span>
  );
}

export function FeedItem({ item, onSelect }: FeedItemProps) {
  const style = EVENT_STYLE[item.kind];
  const isStranger = item.kind === "stranger";
  const hasAi = !item.aiLoading && !!item.ai;
  const container = item.isNew
    ? `${style.tint} ${style.box}`
    : item.selected
      ? "border-accent bg-surface-3"
      : "border-transparent bg-surface-2";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full animate-feed-in gap-2.5 rounded-md border px-3 py-2.5 text-left text-text ${container}`}
    >
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${style.dot}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-caption text-text-muted">{item.time}</span>
          <span className={`truncate text-body font-semibold ${style.text}`}>{item.title}</span>
          {item.isNew && (
            <span className="rounded-xs bg-danger px-[5px] py-px text-[11px] font-bold text-white">Нова</span>
          )}
          <span className="ml-auto font-mono text-caption text-text-muted">{item.conf}</span>
        </span>

        {item.verdict && (
          <span className="inline-flex items-center gap-1.5 self-start rounded-xs bg-surface-3 px-1.5 py-0.5 text-caption text-text">
            <Check aria-hidden className="size-3" strokeWidth={2.5} />
            {item.verdict}
          </span>
        )}

        {item.needsReview && (
          <span className="self-start rounded-xs border border-dashed border-border-strong px-1.5 py-px text-caption text-text-muted">
            Не оцінено
          </span>
        )}

        {(item.snapshot || (isStranger && (item.aiLoading || hasAi))) && (
          <span className="flex items-start gap-2.5">
            <Snapshot src={item.snapshot} />
            {item.aiLoading && (
              <span className="flex flex-1 flex-col gap-1.5 pt-0.5">
                <span className="block h-2 w-[92%] rounded-xs bg-border" />
                <span className="block h-2 w-[70%] rounded-xs bg-border" />
                <span className="text-caption text-text-muted">Опис формується…</span>
              </span>
            )}
            {hasAi && <span className="line-clamp-3 flex-1 text-caption text-text">{item.ai}</span>}
          </span>
        )}
      </span>
    </button>
  );
}
