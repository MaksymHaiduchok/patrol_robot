export type EventType =
  'person_detected' | 'known_person' | 'stranger_detected' | 'person_left';

export type SystemMode = 'PATROL' | 'STATIONARY';

export type ReviewStatus = 'known' | 'known_pending' | 'stranger';

export type VisionEvent = {
  type: EventType;
  confidence: number | null;
  person_id: string | null;
  ts: number;
};

export type EventRecord = {
  id: string;
  type: EventType;
  person_id: string | null;
  confidence: number | null;
  snapshot_path: string | null;
  description: string | null;
  mode: SystemMode | null;
  review_status: ReviewStatus | null;
  reviewed_at: string | null;
  created_at: string;
};

export type EventsPage = {
  items: EventRecord[];
  total: number;
};

export type ReviewEventRequest = {
  status: ReviewStatus;
  person_id: string | null;
};

export type PersonRecord = {
  id: string;
  name: string;
  created_at: string;
};

export type PersonSummary = PersonRecord & {
  photo_count: number;
};

export type CreatePersonRequest = {
  name: string;
};

export type PersonEmbedding = {
  person_id: string;
  name: string;
  embedding: number[];
};

export type FaceFailureReason = 'no_face' | 'multiple_faces' | 'invalid_image';

export type AddPhotosResult = {
  added: number;
  failed: { file: string; reason: FaceFailureReason }[];
};

export type RobotState = 'IDLE' | 'PATROL' | 'ALERT' | 'MANUAL';

export type RobotDirection = 'forward' | 'backward' | 'left' | 'right';

export type HubStatus = 'online' | 'offline';

export type RobotCommand =
  | { type: 'command'; cmd: 'move'; dir: RobotDirection; speed: number }
  | { type: 'command'; cmd: 'turn'; dir: RobotDirection; speed: number }
  | { type: 'command'; cmd: 'stop' }
  | { type: 'command'; cmd: 'servo'; pan: number; tilt: number }
  | { type: 'command'; cmd: 'set_state'; state: RobotState }
  | { type: 'command'; cmd: 'alert' }
  | { type: 'command'; cmd: 'resume' }
  | { type: 'command'; cmd: 'hide' };

export type ApiToRobotMessage = RobotCommand | { type: 'ping'; ts: number };

export type RobotToApiMessage =
  | { type: 'hello'; robot_id: string }
  | {
      type: 'telemetry';
      state: RobotState;
      distance_cm: number | null;
      hub: HubStatus;
      battery: number | null;
      ts: number;
    }
  | { type: 'pong'; ts: number }
  | { type: 'ack'; cmd: RobotCommand['cmd']; ts: number };

export type RobotStatus = {
  robot_id: string | null;
  connected: boolean;
  hub: HubStatus;
  state: RobotState;
  distance_cm: number | null;
  battery: number | null;
};

export type OperatorServerMessage =
  | { type: 'event_created'; event: EventRecord }
  | { type: 'event_updated'; event: EventRecord }
  | { type: 'robot_status'; robot: RobotStatus };

export type OperatorClientMessage = { type: 'control'; command: RobotCommand };
