// ============================================================
// V2 (Matrix) Scoring Logic — Knockout Stages
// ============================================================
// Group Stage & Outright Win: 5 / 3 / 0 (unchanged)
// Draw (Pens): V2 matrix with partial points
// ============================================================

/**
 * Score a single prediction against a match result.
 *
 * @param {Object} pred
 * @param {string}  pred.predicted_result    — 'teamA' | 'teamB' | 'draw'
 * @param {number}  pred.predicted_score_a
 * @param {number}  pred.predicted_score_b
 * @param {boolean} pred.predicted_is_draw   — true if user predicted draw (knockout only)
 *
 * @param {Object} match
 * @param {string}  match.result             — 'teamA' | 'teamB' | 'draw'
 * @param {number}  match.score_a
 * @param {number}  match.score_b
 * @param {boolean} match.won_on_penalties
 * @param {string}  match.stage              — 'Group Stage' | 'Round of 32' | etc.
 *
 * @returns {{ is_result_correct: boolean|null, is_score_correct: boolean|null, points_earned: number }}
 */
export function scorePrediction(pred, match) {
  if (!pred || !match || match.result == null) {
    return { is_result_correct: null, is_score_correct: null, points_earned: null }
  }

  const isKnockout   = match.stage !== 'Group Stage'
  const isDrawPens   = isKnockout && match.won_on_penalties === true
  const predIsDraw   = pred.predicted_is_draw === true

  // ── Draw (Pens) match — user predicted draw ─────────────────────────────
  if (isDrawPens && predIsDraw) {
    const scoreCorrect  = pred.predicted_score_a === match.score_a && pred.predicted_score_b === match.score_b
    const winnerCorrect = pred.predicted_result === match.result
    const is_result_correct = winnerCorrect
    const is_score_correct  = scoreCorrect && winnerCorrect

    let points_earned
    if (scoreCorrect && winnerCorrect)       points_earned = 5
    else if (scoreCorrect)                   points_earned = 4
    else if (winnerCorrect)                  points_earned = 3
    else                                     points_earned = 2

    return { is_result_correct, is_score_correct, points_earned }
  }

  // ── Draw (Pens) match — user predicted outright ─────────────────────────
  if (isDrawPens && !predIsDraw) {
    const winnerCorrect = pred.predicted_result === match.result
    return {
      is_result_correct: winnerCorrect,
      is_score_correct:  false,
      points_earned:     winnerCorrect ? 1 : 0,
    }
  }

  // ── User predicted draw but match was outright ─────────────────────────
  if (predIsDraw) {
    if (!isKnockout) {
      return { is_result_correct: false, is_score_correct: false, points_earned: 0 }
    }
    const winnerCorrect = pred.predicted_result === match.result
    return { is_result_correct: winnerCorrect, is_score_correct: false, points_earned: winnerCorrect ? 1 : 0 }
  }

  // ── Outright Win match or Group Stage (V1 unchanged) ────────────────────
  const rc = pred.predicted_result === match.result
  const sc = rc && pred.predicted_score_a === match.score_a && pred.predicted_score_b === match.score_b
  return {
    is_result_correct: rc,
    is_score_correct:  sc,
    points_earned:     sc ? 5 : rc ? 3 : 0,
  }
}
