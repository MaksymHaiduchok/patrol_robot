export type RobotState = "IDLE" | "PATROL" | "ALERT" | "MANUAL";

export type Direction = "forward" | "backward" | "left" | "right";

export type SteerDirection = "left" | "right" | "center";

export type HubStatus = "online" | "offline";

export type HomeState = "none" | "recording" | "returning" | "patrolling";

export type RobotCommand =
  | { type: "command"; cmd: "move"; dir: Direction; speed: number }
  | { type: "command"; cmd: "turn"; dir: Direction; speed: number }
  | { type: "command"; cmd: "steer"; dir: SteerDirection }
  | { type: "command"; cmd: "stop" }
  | { type: "command"; cmd: "servo"; pan: number; tilt: number }
  | { type: "command"; cmd: "set_state"; state: RobotState }
  | { type: "command"; cmd: "alert" }
  | { type: "command"; cmd: "resume" }
  | { type: "command"; cmd: "hide" }
  | { type: "command"; cmd: "set_home" }
  | { type: "command"; cmd: "return_home" };

export type ApiToRobotMessage = RobotCommand | { type: "ping"; ts: number };

export type RobotToApiMessage =
  | { type: "hello"; robot_id: string }
  | {
      type: "telemetry";
      state: RobotState;
      distance_cm: number | null;
      hub: HubStatus;
      battery: number | null;
      home: HomeState;
      ts: number;
    }
  | { type: "pong"; ts: number }
  | { type: "ack"; cmd: RobotCommand["cmd"]; ts: number };
