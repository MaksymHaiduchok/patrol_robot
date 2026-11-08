export type SystemMode = "PATROL" | "STATIONARY";

export type ControlMode = "AUTO" | "MANUAL";

export type Direction = "forward" | "backward" | "left" | "right";

export type VisionHealth = {
  status: string;
  source_connected: boolean;
  fps: number;
};
