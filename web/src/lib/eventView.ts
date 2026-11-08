import { EVENT_STYLE, type EventType as EventKind } from "../../tailwind.patrol-preset";
import { eventTitle, formatTime, reviewLabel } from "@/lib/eventLabels";
import type { EventRecord, EventType } from "@/lib/protocol";

export { EVENT_STYLE };
export type { EventKind };

const KIND_BY_TYPE: Record<EventType, EventKind> = {
  person_detected: "person",
  known_person: "own",
  stranger_detected: "stranger",
  person_left: "left",
};

export const LEGEND_KINDS: EventKind[] = ["person", "own", "stranger", "left", "unknown"];

const NEW_EVENT_MS = 10_000;

export type FeedItemView = {
  id: string;
  kind: EventKind;
  time: string;
  title: string;
  conf: string;
  verdict: string | null;
  ai: string | null;
  aiLoading: boolean;
  isNew: boolean;
  selected: boolean;
  needsReview: boolean;
};

export function eventKind(event: EventRecord): EventKind {
  return KIND_BY_TYPE[event.type];
}

export function toFeedItem(
  event: EventRecord,
  names: Map<string, string>,
  now: number,
  selectedId: string | null,
): FeedItemView {
  const kind = eventKind(event);
  const verdict = reviewLabel(event, names);
  const needsReview = (kind === "stranger" || kind === "unknown") && !verdict;
  return {
    id: event.id,
    kind,
    time: formatTime(event.created_at),
    title: eventTitle(event, names),
    conf: event.confidence === null ? "" : `${Math.round(event.confidence * 100)}%`,
    verdict,
    ai: event.description,
    // TODO: показувати «Аналізую сцену…», поки Claude генерує опис (етап 6).
    aiLoading: false,
    isNew: needsReview && now - new Date(event.created_at).getTime() < NEW_EVENT_MS,
    selected: event.id === selectedId,
    needsReview,
  };
}
