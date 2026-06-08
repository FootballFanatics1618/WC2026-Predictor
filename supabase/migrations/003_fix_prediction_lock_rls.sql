-- Migration 003 — Fix prediction lock RLS using SECURITY DEFINER function
-- Run in Supabase SQL Editor ONCE
--
-- The original RLS policies used a correlated subquery which PostgREST
-- doesn't evaluate correctly. This replaces them with a function-based check.

-- Drop the broken policies
DROP POLICY IF EXISTS "predictions_insert_before_lock" ON public.predictions;
DROP POLICY IF EXISTS "predictions_update_before_lock" ON public.predictions;

-- SECURITY DEFINER function: runs as DB owner, can query matches freely
CREATE OR REPLACE FUNCTION public.is_prediction_allowed(p_user_id uuid, p_match_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches
    WHERE id = p_match_id
      AND now() < (kickoff_utc - INTERVAL '1 hour')
  );
$$;

-- INSERT policy: must own the row AND prediction must be allowed
CREATE POLICY "predictions_insert_before_lock"
  ON public.predictions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_prediction_allowed(user_id, match_id)
  );

-- UPDATE policy: must own the row AND prediction must be allowed
CREATE POLICY "predictions_update_before_lock"
  ON public.predictions
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.is_prediction_allowed(user_id, match_id)
  );
