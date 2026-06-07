-- Migration 002 — Golden Boot award/reset DB functions
-- Run in Supabase SQL Editor ONCE

-- Award: set golden_boot_correct = true for all users who picked p_player
CREATE OR REPLACE FUNCTION public.award_golden_boot(p_player text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.profiles
  SET golden_boot_correct = true
  WHERE golden_boot_pick = p_player;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Reset: clear golden_boot_correct for all users
CREATE OR REPLACE FUNCTION public.reset_golden_boot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET golden_boot_correct = false
  WHERE golden_boot_correct = true;
END;
$$;
