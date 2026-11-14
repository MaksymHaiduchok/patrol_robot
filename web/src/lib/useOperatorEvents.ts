"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchEvents } from "@/lib/api";
import { API_WS_URL } from "@/lib/config";
import type { EventRecord, OperatorClientMessage, OperatorServerMessage, RobotCommand } from "@/lib/protocol";
import { ROBOT_OFFLINE, type RobotStatus, toRobotStatus } from "@/lib/robot";

const FEED_SIZE = 50;
const RECONNECT_DELAY_MS = 2000;

type OperatorEvents = {
  events: EventRecord[];
  connected: boolean;
  apiDown: boolean;
  pendingReview: EventRecord[];
  robot: RobotStatus;
  sendControl: (command: RobotCommand) => void;
  applyUpdate: (event: EventRecord) => void;
  dismissReview: (id: string) => void;
  reopenReview: (event: EventRecord) => void;
};

function upsert(events: EventRecord[], event: EventRecord): EventRecord[] {
  const exists = events.some((item) => item.id === event.id);
  if (exists) return events.map((item) => (item.id === event.id ? event : item));
  return [event, ...events].slice(0, FEED_SIZE);
}

export function useOperatorEvents(): OperatorEvents {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [pendingReview, setPendingReview] = useState<EventRecord[]>([]);
  const [robot, setRobot] = useState<RobotStatus>(ROBOT_OFFLINE);
  const socketRef = useRef<WebSocket | null>(null);

  const sendControl = useCallback((command: RobotCommand) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    const message: OperatorClientMessage = { type: "control", command };
    socket.send(JSON.stringify(message));
  }, []);

  const applyUpdate = useCallback((event: EventRecord) => {
    setEvents((current) => upsert(current, event));
    if (event.review_status) {
      setPendingReview((current) => current.filter((item) => item.id !== event.id));
    }
  }, []);

  const dismissReview = useCallback((id: string) => {
    setPendingReview((current) => current.filter((item) => item.id !== id));
  }, []);

  const reopenReview = useCallback((event: EventRecord) => {
    setPendingReview((current) =>
      current.some((item) => item.id === event.id) ? current : [event, ...current],
    );
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
      socketRef.current = socket;
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        setRobot(ROBOT_OFFLINE);
        if (!closed) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      socket.onmessage = (message: MessageEvent<string>) => {
        const data: OperatorServerMessage = JSON.parse(message.data);
        if (data.type === "robot_status") {
          setRobot(toRobotStatus(data.robot));
          return;
        }
        applyUpdate(data.event);
        if (data.type === "event_created" && data.event.type === "stranger_detected") {
          setPendingReview((current) => [...current, data.event]);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      socketRef.current = null;
      socket?.close();
    };
  }, [applyUpdate]);

  return {
    events,
    connected: connected === true,
    apiDown: connected === false,
    pendingReview,
    robot,
    sendControl,
    applyUpdate,
    dismissReview,
    reopenReview,
  };
}
