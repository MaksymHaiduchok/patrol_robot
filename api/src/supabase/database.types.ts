import type { EventRecord, PersonRecord } from '../protocol/protocol.js';

export type FaceEmbeddingRow = {
  id: string;
  person_id: string;
  embedding: string;
  photo_path: string | null;
  created_at: string;
};

type FaceEmbeddingInsert = Pick<
  FaceEmbeddingRow,
  'person_id' | 'embedding' | 'photo_path'
>;

type EventInsert = Pick<
  EventRecord,
  'type' | 'person_id' | 'confidence' | 'mode'
> &
  Partial<Pick<EventRecord, 'snapshot_path' | 'description'>>;

type EventUpdate = Partial<
  Pick<
    EventRecord,
    | 'person_id'
    | 'review_status'
    | 'reviewed_at'
    | 'snapshot_path'
    | 'description'
  >
>;

type PersonInsert = Pick<PersonRecord, 'name'>;

export type Database = {
  public: {
    Tables: {
      events: {
        Row: EventRecord;
        Insert: EventInsert;
        Update: EventUpdate;
        Relationships: [];
      };
      persons: {
        Row: PersonRecord;
        Insert: PersonInsert;
        Update: Partial<PersonInsert>;
        Relationships: [];
      };
      face_embeddings: {
        Row: FaceEmbeddingRow;
        Insert: FaceEmbeddingInsert;
        Update: Partial<FaceEmbeddingInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
