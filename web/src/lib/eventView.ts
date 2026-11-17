import { EVENT_STYLE, type EventType as EventKind } from "../../tailwind.patrol-preset";
import { snapshotUrl } from "@/lib/api";
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

export const LEGEND_KINDS: EventKind[] = ["person", "own", "stranger", "left"];

const NEW_EVENT_MS = 10_000;
const DESCRIPTION_WAIT_MS = 30_000;

export type FeedItemView = {
  id: string;
  kind: EventKind;
  time: string;
  title: string;
  conf: string;
  verdict: string | null;
  ai: string | null;
  aiLoading: boolean;
  snapshot: string | null;
  isNew: boolean;
  selected: boolean;
  needsReview: boolean;
};

export function eventKind(event: EventRecord): EventKind {
  return KIND_BY_TYPE[event.type];
}

export function descriptionPending(event: EventRecord, now: number): boolean {
  return (
    event.type === "stranger_detected" &&
    !event.description &&
    now - new Date(event.created_at).getTime() < DESCRIPTION_WAIT_MS
  );
}

export function toFeedItem(
  event: EventRecord,
  names: Map<string, string>,
  now: number,
  selectedId: string | null,
): FeedItemView {
  const kind = eventKind(event);
  const verdict = reviewLabel(event, names);
  const needsReview = kind === "stranger" && !verdict;
  return {
    id: event.id,
    kind,
    time: formatTime(event.created_at),
    title: eventTitle(event, names),
    conf: event.confidence === null ? "" : `${Math.round(event.confidence * 100)}%`,
    verdict,
    ai: event.description,
    aiLoading: descriptionPending(event, now),
    snapshot: snapshotUrl(event),
    isNew: needsReview && now - new Date(event.created_at).getTime() < NEW_EVENT_MS,
    selected: event.id === selectedId,
    needsReview,
  };
}
