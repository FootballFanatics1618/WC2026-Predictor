-- Migration 019: Fix draw-prediction scoring on outright knockout matches
-- The "equal scores on knockout" fallback in migration 013 fires for ANY
-- knockout prediction with equal scores, even when the match was an outright
-- win (not draw+penalties). This awards +3 instead of +1 for correct winner.
--
-- Fix: Remove the equal-scores fallback; rely solely on predicted_is_draw.
-- Backfill predicted_is_draw for any remaining old predictions with equal scores,
-- then rescore all completed knockout matches.

-- 1. Backfill: set predicted_is_draw = true for any knockout predictions with equal scores
-- that might have been missed by the migration 014 backfill.
UPDATE public.predictions
SET predicted_is_draw = true
WHERE (predicted_is_draw IS NULL OR predicted_is_draw = false)
  AND predicted_score_a = predicted_score_b
  AND predicted_score_a IS NOT NULL
  AND match_id IN (SELECT id FROM public.matches WHERE stage != 'Group Stage');

-- 2. Replace score_match_predictions RPC — no equal-scores fallback, only predicted_is_draw
CREATE OR REPLACE FUNCTION public.score_match_predictions(p_match_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result        text;
  v_score_a       integer;
  v_score_b       integer;
  v_won_on_pen    boolean;
  v_stage         text;
  v_count         integer;
BEGIN
  SELECT result, score_a, score_b, won_on_penalties, stage
  INTO v_result, v_score_a, v_score_b, v_won_on_pen, v_stage
  FROM public.matches
  WHERE id = p_match_id;

  IF v_result IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.predictions SET
    is_result_correct = CASE
      WHEN v_won_on_pen AND predicted_is_draw THEN
        (predicted_result = v_result)
      WHEN v_won_on_pen AND NOT predicted_is_draw THEN
        (predicted_result = v_result)
      ELSE
        (predicted_result = v_result)
    END,
    is_score_correct = CASE
      -- Draw (Pens) + user predicted draw: score correct only if BOTH score AND winner match
      WHEN v_won_on_pen AND predicted_is_draw THEN
        (predicted_score_a = v_score_a AND predicted_score_b = v_score_b AND predicted_result = v_result)
      -- Draw (Pens) + user predicted outright: score is never correct
      WHEN v_won_on_pen AND NOT predicted_is_draw THEN
        false
      -- Outright / Group: standard check
      ELSE
        (predicted_result = v_result AND predicted_score_a = v_score_a AND predicted_score_b = v_score_b)
    END,
    points_earned = CASE
      -- ── Draw (Pens) match — user predicted draw — V2 matrix ──
      WHEN v_won_on_pen AND predicted_is_draw THEN
        CASE
          WHEN predicted_score_a = v_score_a AND predicted_score_b = v_score_b
               AND predicted_result = v_result THEN 5
          WHEN predicted_score_a = v_score_a AND predicted_score_b = v_score_b THEN 4
          WHEN predicted_result = v_result THEN 3
          ELSE 2
        END
      -- ── Draw (Pens) match — user predicted outright ──
      WHEN v_won_on_pen AND NOT predicted_is_draw THEN
        CASE
          WHEN predicted_result = v_result THEN 1
          ELSE 0
        END
      -- ── User predicted draw but match was outright ──
      WHEN NOT v_won_on_pen AND predicted_is_draw AND v_stage = 'Group Stage' THEN 0
      WHEN NOT v_won_on_pen AND predicted_is_draw THEN
        CASE WHEN predicted_result = v_result THEN 1 ELSE 0 END
      -- ── Outright Win match or Group Stage (V1 unchanged) ──
      ELSE
        CASE
          WHEN predicted_result = v_result
               AND predicted_score_a = v_score_a
               AND predicted_score_b = v_score_b THEN 5
          WHEN predicted_result = v_result THEN 3
          ELSE 0
        END
    END
  WHERE match_id = p_match_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 3. Rescore all completed knockout matches
DO $$
DECLARE
  rec RECORD;
  v_count integer;
BEGIN
  FOR rec IN
    SELECT id FROM public.matches
    WHERE stage != 'Group Stage'
      AND result IS NOT NULL
      AND score_a IS NOT NULL
      AND score_b IS NOT NULL
    ORDER BY id
  LOOP
    v_count := public.score_match_predictions(rec.id);
    RAISE NOTICE 'Rescored match %: % predictions updated', rec.id, v_count;
  END LOOP;
END $$;
