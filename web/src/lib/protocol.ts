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

export type OperatorServerMessage =
  | { type: 'event_created'; event: EventRecord }
  | { type: 'event_updated'; event: EventRecord };
