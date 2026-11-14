export type RobotState = "IDLE" | "PATROL" | "ALERT" | "MANUAL";

export type Direction = "forward" | "backward" | "left" | "right";

export type HubStatus = "online" | "offline";

export type RobotCommand =
  | { type: "command"; cmd: "move"; dir: Direction; speed: number }
  | { type: "command"; cmd: "turn"; dir: Direction; speed: number }
  | { type: "command"; cmd: "stop" }
  | { type: "command"; cmd: "servo"; pan: number; tilt: number }
  | { type: "command"; cmd: "set_state"; state: RobotState }
  | { type: "command"; cmd: "alert" }
  | { type: "command"; cmd: "resume" }
  | { type: "command"; cmd: "hide" };

export type ApiToRobotMessage = RobotCommand | { type: "ping"; ts: number };

export type RobotToApiMessage =
  | { type: "hello"; robot_id: string }
  | {
      type: "telemetry";
      state: RobotState;
      distance_cm: number | null;
      hub: HubStatus;
      battery: number | null;
      ts: number;
    }
  | { type: "pong"; ts: number }
  | { type: "ack"; cmd: RobotCommand["cmd"]; ts: number };
