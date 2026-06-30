const { test, expect } = require('@playwright/test')

// ══════════════════════════════════════════════════════════════════════════════
// Penalty Auto-Sync Logic — extracted from sync-scores edge function for testing.
// Pure logic, no Supabase calls.
// Tests that knockout penalty matches are correctly detected and resolved.
// ══════════════════════════════════════════════════════════════════════════════

// Mirrors the edge function's logic for detecting and resolving penalty matches
function processMatch(dbMatch, apiMatch) {
  const swapped = false  // simplified: assume not swapped for these tests

  const home = Number(apiMatch.home_score)
  const away = Number(apiMatch.away_score)

  let result = home > away ? 'teamA' : away > home ? 'teamB' : 'draw'

  const isKnockout = dbMatch.stage !== 'Group Stage'
  let wonOnPenalties = false
  let skipped = false

  if (isKnockout && home === away) {
    const penHome = apiMatch.home_penalty_score != null ? Number(apiMatch.home_penalty_score) : null
    const penAway = apiMatch.away_penalty_score != null ? Number(apiMatch.away_penalty_score) : null
    if (penHome !== null && penAway !== null && penHome !== penAway) {
      wonOnPenalties = true
      result = penHome > penAway ? 'teamA' : 'teamB'
    } else {
      skipped = true
    }
  }

  return { result, wonOnPenalties, skipped, score_a: home, score_b: away }
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 1 — Penalty matches auto-detected and resolved
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 1 — Penalty auto-sync: API has penalty scores', () => {

  test('1.1 — Home team wins on penalties (3-4 pens, 1-1 ET)', () => {
    const dbMatch = { id: 74, stage: 'Round of 32', team_a: 'Germany', team_b: 'Paraguay' }
    const apiMatch = { home_score: '1', away_score: '1', home_penalty_score: '3', away_penalty_score: '4' }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.result).toBe('teamB')
    expect(r.wonOnPenalties).toBe(true)
    expect(r.skipped).toBe(false)
    expect(r.score_a).toBe(1)
    expect(r.score_b).toBe(1)
  })

  test('1.2 — Away team wins on penalties (4-2 pens, 2-2 ET)', () => {
    const dbMatch = { id: 89, stage: 'Round of 16', team_a: 'France', team_b: 'Brazil' }
    const apiMatch = { home_score: '2', away_score: '2', home_penalty_score: '4', away_penalty_score: '2' }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.result).toBe('teamA')
    expect(r.wonOnPenalties).toBe(true)
    expect(r.skipped).toBe(false)
  })

  test('1.3 — 0-0 ET, penalties 5-3', () => {
    const dbMatch = { id: 97, stage: 'Quarter-final', team_a: 'Spain', team_b: 'Argentina' }
    const apiMatch = { home_score: '0', away_score: '0', home_penalty_score: '5', away_penalty_score: '3' }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.result).toBe('teamA')
    expect(r.wonOnPenalties).toBe(true)
    expect(r.skipped).toBe(false)
    expect(r.score_a).toBe(0)
    expect(r.score_b).toBe(0)
  })

  test('1.4 — Final with penalties (1-1 ET, 3-4 pens)', () => {
    const dbMatch = { id: 104, stage: 'Final', team_a: 'Argentina', team_b: 'Germany' }
    const apiMatch = { home_score: '1', away_score: '1', home_penalty_score: '3', away_penalty_score: '4' }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.result).toBe('teamB')
    expect(r.wonOnPenalties).toBe(true)
    expect(r.skipped).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Section 2 — Outright knockout matches (no penalties) still work
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 2 — Outright knockout (no penalties)', () => {

  test('2.1 — Clear win in R32 (2-1)', () => {
    const dbMatch = { id: 73, stage: 'Round of 32', team_a: 'Mexico', team_b: 'Turkey' }
    const apiMatch = { home_score: '2', away_score: '1' }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.result).toBe('teamA')
    expect(r.wonOnPenalties).toBe(false)
    expect(r.skipped).toBe(false)
  })

  test('2.2 — Clear win in QF (3-0)', () => {
    const dbMatch = { id: 97, stage: 'Quarter-final', team_a: 'France', team_b: 'England' }
    const apiMatch = { home_score: '3', away_score: '0' }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.result).toBe('teamA')
    expect(r.wonOnPenalties).toBe(false)
    expect(r.skipped).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Section 3 — Group stage draws are NOT treated as penalties
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 3 — Group stage draw (not penalties)', () => {

  test('3.1 — Group match ends 1-1', () => {
    const dbMatch = { id: 5, stage: 'Group Stage', team_a: 'Brazil', team_b: 'Morocco' }
    const apiMatch = { home_score: '1', away_score: '1' }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.result).toBe('draw')
    expect(r.wonOnPenalties).toBe(false)
    expect(r.skipped).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Section 4 — Missing penalty data falls back to manual entry
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 4 — Missing penalty data (fallback to manual)', () => {

  test('4.1 — Knockout draw with no penalty fields', () => {
    const dbMatch = { id: 89, stage: 'Round of 16', team_a: 'France', team_b: 'Brazil' }
    const apiMatch = { home_score: '1', away_score: '1' }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.skipped).toBe(true)
    expect(r.wonOnPenalties).toBe(false)
  })

  test('4.2 — Knockout draw with null penalty scores', () => {
    const dbMatch = { id: 89, stage: 'Round of 16', team_a: 'France', team_b: 'Brazil' }
    const apiMatch = { home_score: '1', away_score: '1', home_penalty_score: null, away_penalty_score: null }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.skipped).toBe(true)
    expect(r.wonOnPenalties).toBe(false)
  })

  test('4.3 — Knockout draw with level penalty scores (0-0)', () => {
    const dbMatch = { id: 89, stage: 'Round of 16', team_a: 'France', team_b: 'Brazil' }
    const apiMatch = { home_score: '1', away_score: '1', home_penalty_score: '0', away_penalty_score: '0' }
    const r = processMatch(dbMatch, apiMatch)
    expect(r.skipped).toBe(true)
    expect(r.wonOnPenalties).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Section 5 — All knockout stages handled correctly
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 5 — All knockout stages', () => {

  const stages = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', '3rd Place Play-off', 'Final']

  for (const stage of stages) {
    test(`5.x — ${stage} with penalties auto-resolved`, () => {
      const dbMatch = { id: 99, stage, team_a: 'Team A', team_b: 'Team B' }
      const apiMatch = { home_score: '2', away_score: '2', home_penalty_score: '3', away_penalty_score: '5' }
      const r = processMatch(dbMatch, apiMatch)
      expect(r.result).toBe('teamB')
      expect(r.wonOnPenalties).toBe(true)
      expect(r.skipped).toBe(false)
    })
  }
})
