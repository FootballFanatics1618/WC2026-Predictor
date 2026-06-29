-- ============================================================
-- Golden Boot Live Tracker — run in Supabase SQL Editor
-- ============================================================

create table if not exists public.goal_tracker (
  id serial primary key,
  player_name text not null,
  goals integer default 0,
  last_updated timestamp with time zone default timezone('utc', now())
);
create unique index if not exists idx_goal_tracker_player on public.goal_tracker (player_name);

alter table public.goal_tracker enable row level security;
drop policy if exists "goal_tracker_read_all" on public.goal_tracker;
create policy "goal_tracker_read_all" on public.goal_tracker for select using (true);
create policy "goal_tracker_write_all" on public.goal_tracker for all using (true);

create table if not exists public.sync_meta (
  key text primary key,
  value text
);
alter table public.sync_meta enable row level security;
drop policy if exists "sync_meta_read_all" on public.sync_meta;
create policy "sync_meta_read_all" on public.sync_meta for select using (true);
create policy "sync_meta_write_all" on public.sync_meta for all using (true);

insert into public.sync_meta (key, value) values ('scorers_last_sync', 'never')
on conflict (key) do nothing;
