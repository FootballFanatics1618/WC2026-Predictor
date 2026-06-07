-- ============================================================
-- RESET ALL RESULTS FOR TESTING
-- Run this in Supabase SQL Editor to wipe all match results,
-- prediction scores, and group standings back to zero.
-- ============================================================

-- 1. Clear all match results
UPDATE public.matches
SET result = NULL, score_a = NULL, score_b = NULL
WHERE result IS NOT NULL;

-- 2. Reset all prediction scores
UPDATE public.predictions
SET is_result_correct = NULL,
    is_score_correct  = NULL,
    points_earned     = 0;

-- 3. Reset group standings to zero
UPDATE public.group_standings
SET played = 0,
    won    = 0,
    drawn  = 0,
    lost   = 0,
    goals_for     = 0,
    goals_against = 0,
    points        = 0;

-- 4. Reset golden boot correct flag on profiles
UPDATE public.profiles
SET golden_boot_correct = false;

-- 5. Remove the golden boot prediction row (match_id = 9999) if awarded
DELETE FROM public.predictions WHERE match_id = 9999;

-- Done! All results cleared.
SELECT 'Reset complete. Matches: ' || COUNT(*) || ' cleared.'
FROM public.matches WHERE result IS NULL;
