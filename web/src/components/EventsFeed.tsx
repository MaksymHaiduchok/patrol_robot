import type { EventRecord } from "@/lib/protocol";
import { EVENT_LABELS, eventTitle, formatTime, reviewLabel } from "@/lib/eventLabels";

type EventsFeedProps = {
  events: EventRecord[];
  connected: boolean;
  names: Map<string, string>;
};

const LEGEND = [
  EVENT_LABELS.person_detected,
  EVENT_LABELS.known_person,
  EVENT_LABELS.stranger_detected,
];

function EventItem({ event, names }: { event: EventRecord; names: Map<string, string> }) {
  const label = EVENT_LABELS[event.type];
  const review = reviewLabel(event, names);

  return (
    <li className="rounded-md px-3 py-2 hover:bg-surface-raised">
      <div className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${label.dotClassName}`} />
        <span className="text-xs text-muted">{formatTime(event.created_at)}</span>
        <span className="text-sm font-medium">{eventTitle(event, names)}</span>
        {event.confidence !== null && (
          <span className="ml-auto text-xs text-muted">{Math.round(event.confidence * 100)}%</span>
        )}
      </div>
      {review && <div className="mt-1 pl-4 text-xs text-accent">{review}</div>}
      {event.description && <p className="mt-1 pl-4 text-xs text-muted">{event.description}</p>}
    </li>
  );
}

export function EventsFeed({ events, connected, names }: EventsFeedProps) {
  return (
    <aside className="flex min-h-80 flex-col border-border bg-surface lg:w-80 lg:shrink-0 lg:border-l">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Алерти</h2>
          <span
            title={connected ? "Підключено до api" : "Немає з'єднання з api"}
            className={`size-2 rounded-full ${connected ? "bg-ok" : "bg-live"}`}
          />
        </div>
        <span className="rounded bg-surface-raised px-2 py-0.5 text-xs text-muted">
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="text-muted">Подій поки немає</span>
          <span className="text-xs text-muted">
            Тут з&apos;являтимуться люди в кадрі, свої й чужі з описом сцени
          </span>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2 lg:min-h-0">
          {events.map((event) => (
            <EventItem key={event.id} event={event} names={names} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-3">
        {LEGEND.map((item) => (
          <span key={item.text} className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`size-2 rounded-full ${item.dotClassName}`} />
            {item.text}
          </span>
        ))}
      </div>
    </aside>
  );
}
