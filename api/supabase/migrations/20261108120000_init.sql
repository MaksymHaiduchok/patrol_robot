create extension if not exists vector;

create table persons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table face_embeddings (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references persons(id) on delete cascade,
  embedding vector(128) not null,
  photo_path text,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('person_detected','known_person','stranger_detected','person_left')),
  person_id uuid references persons(id) on delete set null,
  confidence real,
  snapshot_path text,
  description text,
  mode text check (mode in ('PATROL','STATIONARY')),
  created_at timestamptz default now()
);

create index events_created_at_idx on events (created_at desc);
create index face_embeddings_person_id_idx on face_embeddings (person_id);

alter table persons enable row level security;
alter table face_embeddings enable row level security;
alter table events enable row level security;
