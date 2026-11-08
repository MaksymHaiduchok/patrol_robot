insert into storage.buckets (id, name, public)
values ('faces', 'faces', false)
on conflict (id) do nothing;
