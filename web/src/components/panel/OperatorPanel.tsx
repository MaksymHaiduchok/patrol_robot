"use client";

import { useCallback, useMemo, useState } from "react";
import { distanceTone } from "../../../tailwind.patrol-preset";
import { Header } from "@/components/Header";
import { IdentifyModal } from "@/components/IdentifyModal";
import { AlertsAside } from "@/components/panel/AlertsAside";
import { ControlAside } from "@/components/panel/ControlAside";
import { type AlarmInfo, VideoPanel } from "@/components/panel/VideoPanel";
import { StatCard, type StatTone } from "@/components/ui/StatCard";
import { Toast } from "@/components/ui/Toast";
import { eventTitle, formatTime } from "@/lib/eventLabels";
import { toFeedItem } from "@/lib/eventView";
import type { EventRecord, SystemMode } from "@/lib/protocol";
import type { RobotStatus } from "@/lib/robot";
import type { ControlMode } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { useOperatorEvents } from "@/lib/useOperatorEvents";
import { usePersons } from "@/lib/usePersons";
import { useVisionHealth } from "@/lib/useVisionHealth";

const DISTANCE_SCALE_CM = 120;

type StatCardData = {
  label: string;
  value: string;
  tone: StatTone;
  critical?: boolean;
  mono?: boolean;
  bar?: number | null;
};

type Visit = {
  start: EventRecord;
  who: string;
};

type ToastState = {
  id: number;
  message: string;
  event: EventRecord | null;
};

function findActiveVisit(events: EventRecord[], names: Map<string, string>): Visit | null {
  const startIndex = events.findIndex(
    (event) => event.type === "person_detected" || event.type === "person_left",
  );
  if (startIndex === -1 || events[startIndex].type === "person_left") return null;
  const visitEvents = events.slice(0, startIndex + 1);
  const stranger = visitEvents.some((event) => event.type === "stranger_detected");
  const known = visitEvents.find((event) => event.type === "known_person");
  const who = stranger ? "Чужий" : known ? eventTitle(known, names) : "Людина в кадрі";
  return { start: events[startIndex], who };
}

function buildCards(
  cameraOnline: boolean,
  fps: number | null,
  robot: RobotStatus,
  systemMode: SystemMode,
  manual: boolean,
  alarm: boolean,
): StatCardData[] {
  const patrol = systemMode === "PATROL";
  const camera: StatCardData = cameraOnline
    ? { label: "Камера", value: `${Math.round(fps ?? 0)} FPS`, tone: "ok", mono: true }
    : { label: "Камера", value: "Немає сигналу", tone: "danger", critical: true };

  const robotCard: StatCardData = !patrol
    ? { label: "Робот", value: "Не використовується", tone: "neutral" }
    : robot.online
      ? { label: "Робот", value: "Онлайн", tone: "ok" }
      : { label: "Робот", value: "Офлайн", tone: "neutral" };

  const state: StatCardData = alarm
    ? { label: "Стан робота", value: "Тривога", tone: "danger", critical: true }
    : manual
      ? { label: "Стан робота", value: "Ручне", tone: "accent" }
      : patrol && robot.online
        ? { label: "Стан робота", value: "Патрулює", tone: "ok" }
        : { label: "Стан робота", value: "Очікування", tone: "neutral" };

  const distanceLabel = "Відстань до перешкоди";
  let distance: StatCardData = { label: distanceLabel, value: "—", tone: "neutral", mono: true };
  if (patrol && robot.online && robot.distanceCm !== null) {
    const tone = distanceTone(robot.distanceCm);
    distance = {
      label: distanceLabel,
      value: `${robot.distanceCm} см`,
      tone,
      critical: tone === "danger",
      mono: true,
      bar: Math.min(100, (robot.distanceCm / DISTANCE_SCALE_CM) * 100),
    };
  }

  const mode: StatCardData = { label: "Режим", value: patrol ? "Патруль" : "Стаціонар", tone: "accent" };
  return [camera, robotCard, state, distance, mode];
}

export function OperatorPanel() {
  const [systemMode, setSystemMode] = useState<SystemMode>("PATROL");
  const [controlMode, setControlMode] = useState<ControlMode>("AUTO");
  const [resumedVisitId, setResumedVisitId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const health = useVisionHealth();
  const now = useNow();
  const { persons, names, refresh: refreshPersons } = usePersons();
  const { events, connected, apiDown, pendingReview, robot, sendControl, applyUpdate, dismissReview, reopenReview } =
    useOperatorEvents();

  const cameraOnline = health?.source_connected ?? false;
  const fps = health?.fps ?? null;
  const manual = systemMode === "PATROL" && controlMode === "MANUAL";
  const reviewTarget = pendingReview[0] ?? null;

  const visit = useMemo(() => findActiveVisit(events, names), [events, names]);
  const alarmActive = systemMode === "PATROL" && visit !== null && visit.start.id !== resumedVisitId;
  const alarm: AlarmInfo | null =
    alarmActive && visit
      ? {
          time: formatTime(visit.start.created_at),
          secondsAgo: now === null ? 0 : Math.max(0, Math.floor((now - Date.parse(visit.start.created_at)) / 1000)),
          who: visit.who,
        }
      : null;

  const feed = useMemo(
    () => events.map((event) => toFeedItem(event, names, now ?? 0, reviewTarget?.id ?? null)),
    [events, names, now, reviewTarget],
  );
  const cards = buildCards(cameraOnline, fps, robot, systemMode, manual, alarmActive);
  const clock = now === null ? "--:--:--" : new Date(now).toLocaleTimeString("uk-UA");

  const resume = () => {
    setResumedVisitId(visit?.start.id ?? null);
    sendControl({ type: "command", cmd: "resume" });
  };
  const stop = () => sendControl({ type: "command", cmd: "stop" });

  const setHome = () => {
    sendControl({ type: "command", cmd: "set_home" });
    setToast({
      id: Date.now(),
      message:
        robot.home === "none"
          ? "Точку дому зафіксовано — шлях записується звідси"
          : "Точку дому оновлено — старий шлях стерто, запис почато звідси",
      event: null,
    });
  };

  const changeControlMode = (mode: ControlMode) => {
    setControlMode(mode);
    sendControl({ type: "command", cmd: "stop" });
    sendControl({ type: "command", cmd: "set_state", state: mode === "MANUAL" ? "MANUAL" : "PATROL" });
  };

  const selectFeedItem = (id: string) => {
    const event = events.find((item) => item.id === id);
    const item = feed.find((feedItem) => feedItem.id === id);
    if (event && item?.needsReview) reopenReview(event);
  };

  const markedStranger = useCallback(
    (event: EventRecord) => {
      applyUpdate(event);
      setToast({ id: Date.now(), message: "Позначено як «Чужий (оператор)»", event });
    },
    [applyUpdate],
  );

  const dismissModal = useCallback(() => {
    if (reviewTarget) dismissReview(reviewTarget.id);
  }, [dismissReview, reviewTarget]);

  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div className="relative min-h-screen bg-bg text-text">
      <Header live={cameraOnline} apiDown={apiDown} />

      <main className="flex flex-wrap items-start gap-4 p-4">
        <div className="flex min-w-0 flex-[999_1_820px] flex-row-reverse flex-wrap items-start gap-4">
          <section aria-label="Відео й стан" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-[22px] font-bold leading-[30px]">Патрулювання території</h1>
              <span className="rounded-xs border border-border px-2 py-0.5 font-mono text-caption text-text-muted">
                {robot.id}
              </span>
            </div>

            <VideoPanel cameraOnline={cameraOnline} fps={fps} clock={clock} alarm={alarm} onResume={resume} />

            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
              {cards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
            </div>
          </section>

          <ControlAside
            systemMode={systemMode}
            onSystemModeChange={setSystemMode}
            controlMode={controlMode}
            onControlModeChange={changeControlMode}
            onControl={sendControl}
            onSetHome={setHome}
            robot={robot}
            alarm={alarmActive}
            onStop={stop}
            onResume={resume}
          />
        </div>

        <AlertsAside items={feed} connected={connected} onSelect={selectFeedItem} />
      </main>

      {reviewTarget && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/70 px-4 py-[72px]">
          <IdentifyModal
            key={reviewTarget.id}
            event={reviewTarget}
            queuePosition={1}
            queueTotal={pendingReview.length}
            persons={persons}
            robotId={robot.id}
            onFinished={applyUpdate}
            onMarkedStranger={markedStranger}
            onPersonsChanged={refreshPersons}
            onDismiss={dismissModal}
          />
        </div>
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          actionLabel={toast.event ? "Скасувати" : undefined}
          onAction={() => {
            if (toast.event) reopenReview(toast.event);
            setToast(null);
          }}
          onClose={closeToast}
        />
      )}
    </div>
  );
}
