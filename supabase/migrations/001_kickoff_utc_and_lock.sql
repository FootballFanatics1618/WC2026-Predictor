-- ============================================================
-- Migration 001 — Kickoff UTC + Server-side prediction lock
-- Run in Supabase SQL Editor ONCE
-- ============================================================

-- ── 1. Add kickoff_utc to matches ────────────────────────────────────────────
--
-- This is the single source of truth for all locking logic.
-- match_time stores "HH:MM ET" — we convert to UTC here.
-- World Cup 2026 runs Jun 11 – Jul 19. All times are EDT (UTC-4).

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS kickoff_utc timestamptz;

-- Populate kickoff_utc from existing match_date + match_time
-- Strips " ET" suffix, parses HH:MM, adds 4 hours to get UTC
UPDATE public.matches
SET kickoff_utc = (
  match_date::text || ' ' ||
  regexp_replace(match_time, '\s*ET\s*$', '') ||
  ':00+00'                               -- treat as UTC after +4 correction
)::timestamptz + INTERVAL '4 hours'     -- ET = UTC-4, so add 4h to get UTC
WHERE kickoff_utc IS NULL;

-- Make it NOT NULL now that it's populated
ALTER TABLE public.matches
  ALTER COLUMN kickoff_utc SET NOT NULL;

-- Add sync tracking columns (used by the edge function)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS auto_synced_at  timestamptz,   -- last time sync function touched this match
  ADD COLUMN IF NOT EXISTS sync_source     text;          -- 'api' | 'admin' | null

-- ── 2. Sync log table ────────────────────────────────────────────────────────
-- Tracks every run of the sync function. Useful for debugging.

CREATE TABLE IF NOT EXISTS public.sync_log (
  id          bigserial primary key,
  ran_at      timestamptz default now(),
  matches_checked  integer default 0,
  matches_updated  integer default 0,
  errors      text,
  source      text default 'cron'   -- 'cron' | 'manual'
);

-- Only admins should read sync_log; no public access needed
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_log_admin_only" ON public.sync_log
  FOR ALL USING (false);  -- only service role (edge function) can write


-- ── 3. Drop old prediction policies, replace with time-locked versions ───────

DROP POLICY IF EXISTS "predictions_insert_own"  ON public.predictions;
DROP POLICY IF EXISTS "predictions_update_own"  ON public.predictions;

-- INSERT: only allowed if now() is more than 1 hour before kickoff
CREATE POLICY "predictions_insert_before_lock"
  ON public.predictions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND now() < (
      SELECT kickoff_utc - INTERVAL '1 hour'
      FROM public.matches
      WHERE id = match_id
    )
  );

-- UPDATE: same rule — cannot update after lock time
CREATE POLICY "predictions_update_before_lock"
  ON public.predictions
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND now() < (
      SELECT kickoff_utc - INTERVAL '1 hour'
      FROM public.matches
      WHERE id = match_id
    )
  );

-- ── 4. Score-match DB function ───────────────────────────────────────────────
-- Called by the edge function after updating a match result.
-- Batch-updates all predictions for a match in one SQL statement.

CREATE OR REPLACE FUNCTION public.score_match_predictions(p_match_id integer)
RETURNS integer   -- returns number of predictions scored
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as owner, bypasses RLS
AS $$
DECLARE
  v_result  text;
  v_score_a integer;
  v_score_b integer;
  v_count   integer;
BEGIN
  -- Fetch the match result
  SELECT result, score_a, score_b
  INTO v_result, v_score_a, v_score_b
  FROM public.matches
  WHERE id = p_match_id;

  IF v_result IS NULL THEN
    RETURN 0;
  END IF;

  -- Batch update all predictions for this match
  UPDATE public.predictions
  SET
    is_result_correct = (predicted_result = v_result),
    is_score_correct  = (
      predicted_result = v_result
      AND predicted_score_a = v_score_a
      AND predicted_score_b = v_score_b
    ),
    points_earned = CASE
      WHEN predicted_result = v_result
       AND predicted_score_a = v_score_a
       AND predicted_score_b = v_score_b THEN 5
      WHEN predicted_result = v_result THEN 3
      ELSE 0
    END
  WHERE match_id = p_match_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── 5. Helper: expose kickoff_utc to client safely ───────────────────────────
-- The matches table is already readable by everyone (matches_read_all policy).
-- kickoff_utc is included — clients use it for accurate lock countdown.
-- No extra policy needed.

-- ── 6. Useful index for the sync function ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matches_kickoff_result
  ON public.matches (kickoff_utc, result)
  WHERE result IS NULL;   -- partial index: only unfinished matches

-- ── Done ─────────────────────────────────────────────────────────────────────
-- After running this:
-- 1. Deploy the sync-scores edge function
-- 2. Enable pg_cron in Supabase dashboard (Database → Extensions)
-- 3. Run the cron schedule SQL below in SQL editor
-- ============================================================
