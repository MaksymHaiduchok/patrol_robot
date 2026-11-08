"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchEvents } from "@/lib/api";
import { API_WS_URL } from "@/lib/config";
import type { EventRecord, OperatorServerMessage } from "@/lib/protocol";

const FEED_SIZE = 50;
const RECONNECT_DELAY_MS = 2000;

type OperatorEvents = {
  events: EventRecord[];
  connected: boolean;
  pendingReview: EventRecord[];
  applyUpdate: (event: EventRecord) => void;
  dismissReview: (id: string) => void;
};

function upsert(events: EventRecord[], event: EventRecord): EventRecord[] {
  const exists = events.some((item) => item.id === event.id);
  if (exists) return events.map((item) => (item.id === event.id ? event : item));
  return [event, ...events].slice(0, FEED_SIZE);
}

export function useOperatorEvents(): OperatorEvents {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [connected, setConnected] = useState(false);
  const [pendingReview, setPendingReview] = useState<EventRecord[]>([]);

  const applyUpdate = useCallback((event: EventRecord) => {
    setEvents((current) => upsert(current, event));
    if (event.review_status) {
      setPendingReview((current) => current.filter((item) => item.id !== event.id));
    }
  }, []);

  const dismissReview = useCallback((id: string) => {
    setPendingReview((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    fetchEvents(FEED_SIZE, 0)
      .then((page) =>
        setEvents((current) => {
          const known = new Set(current.map((item) => item.id));
          const older = page.items.filter((item) => !known.has(item.id));
          return [...current, ...older].slice(0, FEED_SIZE);
        }),
      )
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(`${API_WS_URL}/operator`);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!closed) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      socket.onmessage = (message: MessageEvent<string>) => {
        const data: OperatorServerMessage = JSON.parse(message.data);
        applyUpdate(data.event);
        if (data.type === "event_created" && data.event.type === "person_detected") {
          setPendingReview((current) => [...current, data.event]);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [applyUpdate]);

  return { events, connected, pendingReview, applyUpdate, dismissReview };
}
