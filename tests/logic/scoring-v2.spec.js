const { test, expect } = require('@playwright/test')

// ══════════════════════════════════════════════════════════════════════════════
// V2 (Matrix) Scoring Logic — extracted from lib/scoring.js for testing.
// Pure logic, no Supabase calls.
// ══════════════════════════════════════════════════════════════════════════════

function scorePrediction(pred, match) {
  if (!pred || !match || match.result == null) {
    return { is_result_correct: null, is_score_correct: null, points_earned: null }
  }

  const isKnockout   = match.stage !== 'Group Stage'
  const isDrawPens   = isKnockout && match.won_on_penalties === true
  const predIsDraw   = pred.predicted_is_draw === true

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

  if (isDrawPens && !predIsDraw) {
    const winnerCorrect = pred.predicted_result === match.result
    return {
      is_result_correct: winnerCorrect,
      is_score_correct:  false,
      points_earned:     winnerCorrect ? 1 : 0,
    }
  }

  if (predIsDraw) {
    if (!isKnockout) {
      return { is_result_correct: false, is_score_correct: false, points_earned: 0 }
    }
    const winnerCorrect = pred.predicted_result === match.result
    return { is_result_correct: winnerCorrect, is_score_correct: false, points_earned: winnerCorrect ? 1 : 0 }
  }

  const rc = pred.predicted_result === match.result
  const sc = rc && pred.predicted_score_a === match.score_a && pred.predicted_score_b === match.score_b
  return {
    is_result_correct: rc,
    is_score_correct:  sc,
    points_earned:     sc ? 5 : rc ? 3 : 0,
  }
}

// ── Helper factories ──────────────────────────────────────────────────────

function drawPensMatch(scoreA, scoreB, winner) {
  return { result: winner, score_a: scoreA, score_b: scoreB, won_on_penalties: true, stage: 'Round of 32' }
}
function outrightMatch(winner, scoreA, scoreB) {
  return { result: winner, score_a: scoreA, score_b: scoreB, won_on_penalties: false, stage: 'Round of 32' }
}
function groupMatch(result, scoreA, scoreB) {
  return { result, score_a: scoreA, score_b: scoreB, won_on_penalties: false, stage: 'Group Stage' }
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 1 — Draw (Pens) + User Predicted Draw (V2 Matrix)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 1 — V2 Draw (Pens): User predicted draw', () => {

  test('1.1 — Draw + Correct Score + Correct Winner = 5pts', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 2, predicted_score_b: 2, predicted_is_draw: true }
    const match = drawPensMatch(2, 2, 'teamA')
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(5)
    expect(s.is_result_correct).toBe(true)
    expect(s.is_score_correct).toBe(true)
  })

  test('1.2 — Draw + Correct Score + Wrong Winner = 4pts', () => {
    const pred  = { predicted_result: 'teamB', predicted_score_a: 1, predicted_score_b: 1, predicted_is_draw: true }
    const match = drawPensMatch(1, 1, 'teamA')
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(4)
    expect(s.is_result_correct).toBe(false)
    expect(s.is_score_correct).toBe(false)
  })

  test('1.3 — Draw + Wrong Score + Correct Winner = 3pts', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 0, predicted_score_b: 0, predicted_is_draw: true }
    const match = drawPensMatch(2, 2, 'teamA')
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(3)
    expect(s.is_result_correct).toBe(true)
    expect(s.is_score_correct).toBe(false)
  })

  test('1.4 — Draw + Wrong Score + Wrong Winner = 2pts', () => {
    const pred  = { predicted_result: 'teamB', predicted_score_a: 0, predicted_score_b: 0, predicted_is_draw: true }
    const match = drawPensMatch(2, 2, 'teamA')
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(2)
    expect(s.is_result_correct).toBe(false)
    expect(s.is_score_correct).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Section 2 — Draw (Pens) + User Predicted Outright (V2 consolation)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 2 — V2 Draw (Pens): User predicted outright', () => {

  test('2.1 — Outright prediction, correct team advances = 1pt', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 2, predicted_score_b: 1, predicted_is_draw: false }
    const match = drawPensMatch(1, 1, 'teamA')
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(1)
    expect(s.is_result_correct).toBe(true)
    expect(s.is_score_correct).toBe(false)
  })

  test('2.2 — Outright prediction, wrong team = 0pts', () => {
    const pred  = { predicted_result: 'teamB', predicted_score_a: 2, predicted_score_b: 1, predicted_is_draw: false }
    const match = drawPensMatch(1, 1, 'teamA')
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(0)
    expect(s.is_result_correct).toBe(false)
    expect(s.is_score_correct).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Section 3 — Outright Win matches (V1 unchanged)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 3 — V1 Outright Win (knockout, no penalties)', () => {

  test('3.1 — Correct Team + Correct Score = 5pts', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 3, predicted_score_b: 1, predicted_is_draw: false }
    const match = outrightMatch('teamA', 3, 1)
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(5)
    expect(s.is_result_correct).toBe(true)
    expect(s.is_score_correct).toBe(true)
  })

  test('3.2 — Correct Team + Wrong Score = 3pts', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 2, predicted_score_b: 0, predicted_is_draw: false }
    const match = outrightMatch('teamA', 3, 1)
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(3)
    expect(s.is_result_correct).toBe(true)
    expect(s.is_score_correct).toBe(false)
  })

  test('3.3 — Wrong Team = 0pts', () => {
    const pred  = { predicted_result: 'teamB', predicted_score_a: 2, predicted_score_b: 1, predicted_is_draw: false }
    const match = outrightMatch('teamA', 3, 1)
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(0)
    expect(s.is_result_correct).toBe(false)
    expect(s.is_score_correct).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Section 4 — Group Stage (V1 unchanged)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 4 — Group Stage (V1 unchanged)', () => {

  test('4.1 — Correct result + correct score = 5pts', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 2, predicted_score_b: 1, predicted_is_draw: false }
    const match = groupMatch('teamA', 2, 1)
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(5)
    expect(s.is_result_correct).toBe(true)
    expect(s.is_score_correct).toBe(true)
  })

  test('4.2 — Correct result + wrong score = 3pts', () => {
    const pred  = { predicted_result: 'draw', predicted_score_a: 1, predicted_score_b: 1, predicted_is_draw: false }
    const match = groupMatch('draw', 0, 0)
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(3)
    expect(s.is_result_correct).toBe(true)
    expect(s.is_score_correct).toBe(false)
  })

  test('4.3 — Wrong result = 0pts', () => {
    const pred  = { predicted_result: 'teamB', predicted_score_a: 1, predicted_score_b: 0, predicted_is_draw: false }
    const match = groupMatch('teamA', 2, 1)
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(0)
    expect(s.is_result_correct).toBe(false)
    expect(s.is_score_correct).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Section 5 — Edge Cases
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 5 — Edge Cases', () => {

  test('5.1 — Null match result returns nulls', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 2, predicted_score_b: 1, predicted_is_draw: false }
    const match = { result: null, score_a: null, score_b: null, won_on_penalties: false, stage: 'Round of 32' }
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBeNull()
    expect(s.is_result_correct).toBeNull()
    expect(s.is_score_correct).toBeNull()
  })

  test('5.2 — Backward compat: NULL predicted_is_draw on knockout pens = outright prediction (1pt)', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 2, predicted_score_b: 1, predicted_is_draw: null }
    const match = drawPensMatch(1, 1, 'teamA')
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(1)
    expect(s.is_result_correct).toBe(true)
  })

  test('5.3 — Draw (Pens) with 0-0 score: correct score + correct winner = 5pts', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 0, predicted_score_b: 0, predicted_is_draw: true }
    const match = drawPensMatch(0, 0, 'teamA')
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(5)
    expect(s.is_result_correct).toBe(true)
    expect(s.is_score_correct).toBe(true)
  })

  test('5.4 — Draw (Pens) with 0-0 score: correct score + wrong winner = 4pts', () => {
    const pred  = { predicted_result: 'teamB', predicted_score_a: 0, predicted_score_b: 0, predicted_is_draw: true }
    const match = drawPensMatch(0, 0, 'teamA')
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(4)
    expect(s.is_result_correct).toBe(false)
    expect(s.is_score_correct).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Section 6 — Draw prediction on Outright match (bug fix)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 6 — Draw prediction on Outright match', () => {

  test('6.1 — Predicted draw on outright KO, correct team = 1pt', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 2, predicted_score_b: 1, predicted_is_draw: true }
    const match = outrightMatch('teamA', 2, 1)
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(1)
    expect(s.is_result_correct).toBe(true)
    expect(s.is_score_correct).toBe(false)
  })

  test('6.2 — Predicted draw on outright KO, wrong team = 0pts', () => {
    const pred  = { predicted_result: 'teamB', predicted_score_a: 2, predicted_score_b: 1, predicted_is_draw: true }
    const match = outrightMatch('teamA', 2, 1)
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(0)
    expect(s.is_result_correct).toBe(false)
    expect(s.is_score_correct).toBe(false)
  })

  test('6.3 — Predicted draw on group stage outright = 0pts', () => {
    const pred  = { predicted_result: 'teamA', predicted_score_a: 1, predicted_score_b: 1, predicted_is_draw: true }
    const match = groupMatch('teamA', 1, 1)
    const s = scorePrediction(pred, match)
    expect(s.points_earned).toBe(0)
    expect(s.is_result_correct).toBe(false)
    expect(s.is_score_correct).toBe(false)
  })
})
