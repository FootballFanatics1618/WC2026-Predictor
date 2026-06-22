-- ============================================================
-- ADMIN RLS FIX — Run this in your Supabase SQL Editor
--
-- SECURITY FIX (June 2026): The original version created overly
-- permissive INSERT/UPDATE policies on the predictions table that
-- allowed ANY user to modify predictions at any time, completely
-- bypassing the prediction lock. This has been fixed.
--
-- WHAT THIS DOES:
-- 1. Creates admin_users table for server-side admin identification
-- 2. Creates is_admin_user() SECURITY DEFINER function
-- 3. Drops the dangerous open policies and replaces them with
--    admin-scoped policies (admins can bypass lock, regular users cannot)
-- 4. Ensures matches and standings tables are writable by admins
--
-- AFTER RUNNING: seed your admin emails (must match NEXT_PUBLIC_ADMIN_EMAILS):
--   INSERT INTO public.admin_users (email) VALUES ('admin@example.com');
-- ============================================================

-- 1. Admin users table (stores emails for server-side admin check)
create table if not exists public.admin_users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc', now())
);

alter table public.admin_users enable row level security;

-- Everyone can read admin list (needed for RLS check)
drop policy if exists "admin_users_read_all" on public.admin_users;
create policy "admin_users_read_all"
  on public.admin_users for select using (true);

-- 2. SECURITY DEFINER function: is current user an admin?
create or replace function public.is_admin_user()
returns boolean
language sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE email = auth.email()
  );
$$;

-- 3. Drop the DANGEROUS open policies on predictions (the original vulnerability)
drop policy if exists "predictions_update_all" on public.predictions;
drop policy if exists "predictions_insert_all" on public.predictions;
-- Also drop stale names from supabase-schema.sql
drop policy if exists "predictions_update_own" on public.predictions;
drop policy if exists "predictions_insert_own" on public.predictions;

-- 4. Recreate time-locked policies for regular users (server-time enforced)
drop policy if exists "predictions_insert_before_lock" on public.predictions;
drop policy if exists "predictions_update_before_lock" on public.predictions;

CREATE POLICY "predictions_insert_before_lock"
  ON public.predictions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_prediction_allowed(user_id, match_id)
  );

CREATE POLICY "predictions_update_before_lock"
  ON public.predictions
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.is_prediction_allowed(user_id, match_id)
  );

-- 5. Admin-only policies: admins can INSERT/UPDATE at any time
--    (needed for scoring predictions, entering results, golden boot inserts)
CREATE POLICY "predictions_insert_admin"
  ON public.predictions
  FOR INSERT
  WITH CHECK (
    public.is_admin_user()
  );

CREATE POLICY "predictions_update_admin"
  ON public.predictions
  FOR UPDATE
  USING (
    public.is_admin_user()
  )
  WITH CHECK (
    public.is_admin_user()
  );

-- 6. Matches: admin needs to update results (scores, winners)
drop policy if exists "matches_update_all" on public.matches;

CREATE POLICY "matches_update_admin"
  ON public.matches
  FOR UPDATE
  USING (
    public.is_admin_user()
  )
  WITH CHECK (
    public.is_admin_user()
  );

-- 7. Group standings: full write access for standings recalculation
drop policy if exists "standings_read_all"   on public.group_standings;
drop policy if exists "standings_insert_all" on public.group_standings;
drop policy if exists "standings_update_all" on public.group_standings;
drop policy if exists "standings_delete_all" on public.group_standings;
drop policy if exists "standings_write_all"  on public.group_standings;
create policy "standings_read_all"  on public.group_standings for select using (true);
create policy "standings_write_all" on public.group_standings for all    using (true) with check (true);

-- 8. Enable Supabase Realtime for matches table
-- (so predict.js gets live updates when a result is saved)
alter publication supabase_realtime add table public.matches;

-- ============================================================
-- 9. SEED YOUR ADMIN EMAILS (required!)
-- Replace with the same emails from NEXT_PUBLIC_ADMIN_EMAILS
-- ============================================================
-- INSERT INTO public.admin_users (email) VALUES
--   ('your_admin_email@gmail.com'),
--   ('other_admin@gmail.com');
