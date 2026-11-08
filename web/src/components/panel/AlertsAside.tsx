import { FeedItem } from "@/components/FeedItem";
import { EVENT_STYLE, type FeedItemView, LEGEND_KINDS } from "@/lib/eventView";

type AlertsAsideProps = {
  items: FeedItemView[];
  connected: boolean;
  onSelect: (id: string) => void;
};

export function AlertsAside({ items, connected, onSelect }: AlertsAsideProps) {
  return (
    <aside
      aria-label="Алерти"
      className="flex h-[900px] min-w-0 flex-[1_1_340px] flex-col rounded-lg border border-border bg-surface"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="text-heading font-semibold">Алерти</span>
        <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-caption font-semibold">{items.length}</span>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 text-caption ${
            connected ? "text-text-muted" : "text-danger-text"
          }`}
        >
          <span className={`size-2 rounded-full ${connected ? "bg-ok" : "bg-danger"}`} />
          {connected ? "Підключено" : "Немає з’єднання"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-auto p-2.5">
        {items.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
            <span className="text-body text-text-muted">Подій поки немає</span>
          </div>
        )}
        {items.map((item) => (
          <FeedItem key={item.id} item={item} onSelect={() => onSelect(item.id)} />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 border-t border-border px-4 py-3 text-caption text-text-muted">
        {LEGEND_KINDS.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${EVENT_STYLE[kind].dot}`} />
            {EVENT_STYLE[kind].label}
          </span>
        ))}
      </div>
    </aside>
  );
}
