alter table events
  add column review_status text check (review_status in ('known','known_pending','stranger')),
  add column reviewed_at timestamptz;
