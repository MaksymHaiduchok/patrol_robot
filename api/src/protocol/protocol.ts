export type EventType = 'person_detected' | 'known_person' | 'stranger_detected' | 'person_left';

export type SystemMode = 'PATROL' | 'STATIONARY';

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
  created_at: string;
};

export type EventsPage = {
  items: EventRecord[];
  total: number;
};
