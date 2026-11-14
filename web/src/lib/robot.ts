import type { RobotStatus as ApiRobotStatus, HomeState, RobotState } from "@/lib/protocol";

export type RobotStatus = {
  id: string;
  online: boolean;
  bridgeConnected: boolean;
  state: RobotState;
  distanceCm: number | null;
  battery: number | null;
  home: HomeState;
};

export function toRobotStatus(robot: ApiRobotStatus): RobotStatus {
  return {
    id: robot.robot_id ?? "робот",
    online: robot.connected && robot.hub === "online",
    bridgeConnected: robot.connected,
    state: robot.state,
    distanceCm: robot.distance_cm,
    battery: robot.battery,
    home: robot.home,
  };
}

export const ROBOT_OFFLINE: RobotStatus = toRobotStatus({
  robot_id: null,
  connected: false,
  hub: "offline",
  state: "IDLE",
  distance_cm: null,
  battery: null,
  home: "none",
});
