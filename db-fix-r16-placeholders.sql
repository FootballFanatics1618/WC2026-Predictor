-- Fix incorrect R16 placeholder team names in the matches table.
-- The seed data had wrong "Winner M##" references, causing knockout
-- progression to place winners into the wrong downstream matches.
--
-- Run this once in the Supabase SQL Editor or via `psql`.
-- After running, re-submit any completed R32 result via the admin
-- panel to re-trigger resolveKnockoutProgression with the correct targets.

UPDATE public.matches SET team_a = 'Winner M78', team_b = 'Winner M84' WHERE id = 89;
UPDATE public.matches SET team_a = 'Winner M75', team_b = 'Winner M73' WHERE id = 90;
UPDATE public.matches SET team_a = 'Winner M79', team_b = 'Winner M80' WHERE id = 91;
UPDATE public.matches SET team_a = 'Winner M74', team_b = 'Winner M77' WHERE id = 92;
UPDATE public.matches SET team_a = 'Winner M76', team_b = 'Winner M83' WHERE id = 93;
UPDATE public.matches SET team_a = 'Winner M82', team_b = 'Winner M81' WHERE id = 94;
UPDATE public.matches SET team_a = 'Winner M87', team_b = 'Winner M85' WHERE id = 96;
