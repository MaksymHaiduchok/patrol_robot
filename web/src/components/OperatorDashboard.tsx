"use client";

import { useState } from "react";
import { ControlPanel } from "@/components/ControlPanel";
import { EventsFeed } from "@/components/EventsFeed";
import { Header } from "@/components/Header";
import { IdentifyPersonModal } from "@/components/IdentifyPersonModal";
import { StatusBar } from "@/components/StatusBar";
import { VideoPlayer } from "@/components/VideoPlayer";
import type { SystemMode } from "@/lib/protocol";
import type { ControlMode } from "@/lib/types";
import { useOperatorEvents } from "@/lib/useOperatorEvents";
import { usePersons } from "@/lib/usePersons";
import { useVisionHealth } from "@/lib/useVisionHealth";

export function OperatorDashboard() {
  const [systemMode, setSystemMode] = useState<SystemMode>("PATROL");
  const [controlMode, setControlMode] = useState<ControlMode>("AUTO");
  const health = useVisionHealth();
  const online = health?.source_connected ?? false;
  const { events, connected, pendingReview, applyUpdate, dismissReview } = useOperatorEvents();
  const { names, refresh: refreshPersons } = usePersons();
  const reviewTarget = pendingReview[0];

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <Header online={online} />
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <ControlPanel
          systemMode={systemMode}
          onSystemModeChange={setSystemMode}
          controlMode={controlMode}
          onControlModeChange={setControlMode}
        />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:min-h-0 lg:overflow-y-auto">
          <VideoPlayer online={online} />
          <StatusBar health={health} systemMode={systemMode} />
        </main>
        <EventsFeed events={events} connected={connected} names={names} />
      </div>
      {reviewTarget && (
        <IdentifyPersonModal
          key={reviewTarget.id}
          event={reviewTarget}
          onReviewed={applyUpdate}
          onPersonsChanged={refreshPersons}
          onDismiss={() => dismissReview(reviewTarget.id)}
        />
      )}
    </div>
  );
}
