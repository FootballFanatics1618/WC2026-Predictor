-- ============================================================
-- ADMIN RLS FIX — Run this in your Supabase SQL Editor
-- This adds the missing write policies so the admin panel
-- can save match results, score predictions, and update standings.
-- ============================================================

-- 1. Allow matches to be updated (admin saves results)
drop policy if exists "matches_update_all" on public.matches;
create policy "matches_update_all"
  on public.matches for update
  using (true)
  with check (true);

-- 2. Allow predictions to be updated by anyone (admin scores all users' predictions)
drop policy if exists "predictions_update_own" on public.predictions;
create policy "predictions_update_all"
  on public.predictions for update
  using (true)
  with check (true);

-- 3. Allow predictions to be inserted by anyone (admin awards golden boot, match_id 9999)
drop policy if exists "predictions_insert_own" on public.predictions;
create policy "predictions_insert_all"
  on public.predictions for insert
  with check (true);

-- 4. Ensure group_standings has full write access
drop policy if exists "standings_read_all"   on public.group_standings;
drop policy if exists "standings_insert_all" on public.group_standings;
drop policy if exists "standings_update_all" on public.group_standings;
drop policy if exists "standings_delete_all" on public.group_standings;
drop policy if exists "standings_write_all"  on public.group_standings;
create policy "standings_read_all"  on public.group_standings for select using (true);
create policy "standings_write_all" on public.group_standings for all    using (true) with check (true);

-- 5. Enable Supabase Realtime for matches table
-- (so predict.js gets live updates when a result is saved)
alter publication supabase_realtime add table public.matches;
