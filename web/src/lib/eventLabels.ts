import type { EventRecord, EventType, ReviewStatus } from "@/lib/protocol";

type Label = {
  text: string;
  dotClassName: string;
};

export const EVENT_LABELS: Record<EventType, Label> = {
  person_detected: { text: "Людина в кадрі", dotClassName: "bg-ok" },
  known_person: { text: "Свій", dotClassName: "bg-accent" },
  stranger_detected: { text: "Чужий", dotClassName: "bg-live" },
  person_left: { text: "Людина пішла", dotClassName: "bg-muted" },
};

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  known: "Свій",
  known_pending: "Свій, дані пізніше",
  stranger: "Чужий (оператор)",
};

export function eventTitle(event: EventRecord, names: Map<string, string>): string {
  if (event.type === "known_person" && event.person_id) {
    return `Свій: ${names.get(event.person_id) ?? "—"}`;
  }
  return EVENT_LABELS[event.type].text;
}

export function reviewLabel(event: EventRecord, names: Map<string, string>): string | null {
  if (!event.review_status) return null;
  if (event.review_status === "known" && event.person_id) {
    return `Свій: ${names.get(event.person_id) ?? "—"}`;
  }
  return REVIEW_LABELS[event.review_status];
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("uk-UA");
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA");
}
