export type RobotState = "IDLE" | "PATROL" | "ALERT" | "MANUAL";

export type RobotStatus = {
  id: string;
  online: boolean;
  state: RobotState;
  distanceCm: number | null;
};

// TODO: отримувати через WebSocket /operator (robot_status), коли з'явиться RobotGateway (етап 7).
export const ROBOT_STUB: RobotStatus = {
  id: "freenove-01",
  online: false,
  state: "IDLE",
  distanceCm: null,
};
