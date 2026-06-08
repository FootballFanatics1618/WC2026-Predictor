const { test, expect } = require('@playwright/test')

// ══════════════════════════════════════════════════════════════════════════════
// Pure logic extracted from pages/admin.js for testing in isolation.
// These are exact copies of the production functions — no Supabase calls.
// ══════════════════════════════════════════════════════════════════════════════

const GROUP_TEAMS = {
  A:["Mexico","South Korea","Czechia","South Africa"],
  B:["Switzerland","Canada","Qatar","Bosnia and Herzegovina"],
  C:["Brazil","Morocco","Haiti","Scotland"],
  D:["USA","Turkey","Australia","Paraguay"],
  E:["Germany","Ecuador","Ivory Coast","Curacao"],
  F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Egypt","Iran","New Zealand"],
  H:["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I:["France","Senegal","Iraq","Norway"],
  J:["Argentina","Algeria","Austria","Jordan"],
  K:["Portugal","DR Congo","Uzbekistan","Colombia"],
  L:["England","Croatia","Ghana","Panama"],
}

function sortStandings(rows) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.goals_for - a.goals_against
    const gdB = b.goals_for - b.goals_against
    if (gdB !== gdA) return gdB - gdA
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
    return a.team.localeCompare(b.team)
  })
}

function resolveGroupSlot(placeholder, slotMap, best3rds) {
  if (!placeholder) return null
  if (slotMap[placeholder]) return slotMap[placeholder]
  if (placeholder.startsWith('Best 3rd')) {
    const match = placeholder.match(/\(([^)]+)\)/)
    if (match) {
      const allowed = match[1].split('/').map(s => s.trim())
      const pick = best3rds.find(t => allowed.includes(t.group))
      if (pick) {
        best3rds.splice(best3rds.indexOf(pick), 1)
        return pick.team
      }
    }
    if (best3rds.length > 0) { const p = best3rds.shift(); return p.team }
  }
  return null
}

function resolveKnockoutProgression(allMatches, completedMatchId, result) {
  const completed = allMatches.find(m => m.id === completedMatchId)
  if (!completed) return allMatches
  const winner = result === 'teamA' ? completed.team_a : completed.team_b
  const loser  = result === 'teamA' ? completed.team_b : completed.team_a
  const id = completed.id

  // Find future matches referencing this match
  const updated = allMatches.map(fm => {
    if (fm.id <= id) return fm
    const upd = {}
    if (fm.team_a && fm.team_a.includes(`M${id}`)) upd.team_a = fm.team_a.includes('Loser') ? loser : winner
    if (fm.team_b && fm.team_b.includes(`M${id}`)) upd.team_b = fm.team_b.includes('Loser') ? loser : winner
    if (Object.keys(upd).length > 0) return { ...fm, ...upd }
    return fm
  })
  return updated
}

// ══════════════════════════════════════════════════════════════════════════════
// Helper: build standings rows from match results
// ══════════════════════════════════════════════════════════════════════════════

function computeGroupStandings(groupResults) {
  // groupResults: { A: [{ teamA, teamB, scoreA, scoreB, result }, ...], ... }
  const standings = {}
  for (const [g, teams] of Object.entries(GROUP_TEAMS)) {
    standings[g] = {}
    for (const team of teams) {
      standings[g][team] = { team, group_name: g, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 }
    }
  }
  for (const [g, matches] of Object.entries(groupResults)) {
    for (const m of matches) {
      const tA = standings[g][m.teamA]
      const tB = standings[g][m.teamB]
      if (!tA || !tB) continue
      tA.played++; tB.played++
      tA.goals_for += m.scoreA; tA.goals_against += m.scoreB
      tB.goals_for += m.scoreB; tB.goals_against += m.scoreA
      if (m.result === 'teamA') { tA.won++; tA.points += 3; tB.lost++ }
      else if (m.result === 'teamB') { tB.won++; tB.points += 3; tA.lost++ }
      else { tA.drawn++; tA.points++; tB.drawn++; tB.points++ }
    }
  }
  return standings
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Group Standings Sorting
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 1 — Group Standings Sorting', () => {
  test('1.1 — Sorts by points descending', () => {
    const rows = [
      { team: 'Brazil', points: 4, goals_for: 5, goals_against: 1 },
      { team: 'Germany', points: 9, goals_for: 7, goals_against: 0 },
      { team: 'Japan', points: 6, goals_for: 3, goals_against: 2 },
    ]
    const sorted = sortStandings(rows)
    expect(sorted.map(r => r.team)).toEqual(['Germany', 'Japan', 'Brazil'])
  })

  test('1.2 — Breaks points tie by goal difference', () => {
    const rows = [
      { team: 'France', points: 6, goals_for: 5, goals_against: 3 },  // GD +2
      { team: 'Spain', points: 6, goals_for: 4, goals_against: 1 },   // GD +3
      { team: 'Italy', points: 6, goals_for: 3, goals_against: 2 },   // GD +1
    ]
    const sorted = sortStandings(rows)
    expect(sorted.map(r => r.team)).toEqual(['Spain', 'France', 'Italy'])
  })

  test('1.3 — Breaks GD tie by goals for', () => {
    const rows = [
      { team: 'Argentina', points: 6, goals_for: 3, goals_against: 1 },  // GD +2, GF 3
      { team: 'Brazil', points: 6, goals_for: 4, goals_against: 2 },     // GD +2, GF 4
    ]
    const sorted = sortStandings(rows)
    expect(sorted.map(r => r.team)).toEqual(['Brazil', 'Argentina'])
  })

  test('1.4 — Breaks GF tie alphabetically', () => {
    const rows = [
      { team: 'Turkey', points: 4, goals_for: 3, goals_against: 3 },
      { team: 'Tunisia', points: 4, goals_for: 3, goals_against: 3 },
      { team: 'Thailand', points: 4, goals_for: 3, goals_against: 3 },
    ]
    const sorted = sortStandings(rows)
    expect(sorted.map(r => r.team)).toEqual(['Thailand', 'Tunisia', 'Turkey'])
  })

  test('1.5 — Full 4-team group sort matches FIFA rules', () => {
    const rows = [
      { team: 'Mexico', points: 6, goals_for: 4, goals_against: 2 },    // W2 L1, GD+2, GF4
      { team: 'South Korea', points: 6, goals_for: 3, goals_against: 1 }, // W2 L1, GD+2, GF3
      { team: 'Czechia', points: 3, goals_for: 2, goals_against: 3 },   // W1 L2, GD-1
      { team: 'South Africa', points: 1, goals_for: 1, goals_against: 4 }, // W0 D1 L2
    ]
    const sorted = sortStandings(rows)
    expect(sorted[0].team).toBe('Mexico')      // 1st: more GF
    expect(sorted[1].team).toBe('South Korea') // 2nd: less GF but same points+GD
    expect(sorted[2].team).toBe('Czechia')     // 3rd
    expect(sorted[3].team).toBe('South Africa') // 4th
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Group → R32 Propagation
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 2 — Group to R32 Propagation', () => {
  test('2.1 — Resolves Winner/Runner-up slots', () => {
    const slotMap = {
      'Winner A': 'Mexico',
      'Runner-up A': 'South Korea',
    }
    const best3rds = []
    expect(resolveGroupSlot('Winner A', slotMap, best3rds)).toBe('Mexico')
    expect(resolveGroupSlot('Runner-up A', slotMap, best3rds)).toBe('South Korea')
  })

  test('2.2 — Returns null for unknown slot', () => {
    const slotMap = { 'Winner A': 'Mexico' }
    const best3rds = []
    expect(resolveGroupSlot('Winner Z', slotMap, best3rds)).toBeNull()
    expect(resolveGroupSlot(null, slotMap, best3rds)).toBeNull()
  })

  test('2.3 — Resolves Best 3rd with allowed groups', () => {
    const slotMap = {}
    const best3rds = [
      { team: 'Czechia', group: 'A', points: 4, gd: 0, gf: 3 },
      { team: 'Scotland', group: 'C', points: 4, gd: 1, gf: 5 },
      { team: 'Paraguay', group: 'D', points: 3, gd: -1, gf: 2 },
    ]
    // Slot allows groups A, B, C, D, F — should pick Czechia (highest-ranked from allowed)
    const result = resolveGroupSlot('Best 3rd (A/B/C/D/F)', slotMap, best3rds)
    expect(result).toBe('Czechia')
    // Czechia consumed — best3rds should now have Scotland, Paraguay
    expect(best3rds.length).toBe(2)
    expect(best3rds[0].team).toBe('Scotland')
  })

  test('2.4 — Best 3rd falls back when no allowed group match', () => {
    const slotMap = {}
    const best3rds = [
      { team: 'Japan', group: 'F', points: 4, gd: 2, gf: 5 },
      { team: 'Norway', group: 'I', points: 3, gd: 0, gf: 2 },
    ]
    // Slot allows groups A, B, C — neither F nor I match
    const result = resolveGroupSlot('Best 3rd (A/B/C)', slotMap, best3rds)
    // Fallback: returns next available best 3rd (Japan)
    expect(result).toBe('Japan')
    expect(best3rds.length).toBe(1)
  })

  test('2.5 — Best 3rd consumed in order, not reused', () => {
    const slotMap = {}
    const best3rds = [
      { team: 'Czechia', group: 'A', points: 4, gd: 0, gf: 3 },
      { team: 'Scotland', group: 'C', points: 4, gd: 1, gf: 5 },
      { team: 'Norway', group: 'I', points: 3, gd: 0, gf: 2 },
    ]
    // First slot: A/B/C/D/F → picks Czechia
    const r1 = resolveGroupSlot('Best 3rd (A/B/C/D/F)', slotMap, best3rds)
    expect(r1).toBe('Czechia')
    // Second slot: A/C/E → should pick Scotland (Czechia consumed, Scotland is from C)
    const r2 = resolveGroupSlot('Best 3rd (A/C/E)', slotMap, best3rds)
    expect(r2).toBe('Scotland')
    // Third slot: anything → picks Norway (last remaining)
    const r3 = resolveGroupSlot('Best 3rd (F/G/H/I/J)', slotMap, best3rds)
    expect(r3).toBe('Norway')
    expect(best3rds.length).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Knockout Progression (R32 → R16 → QF → SF → Final)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 3 — Knockout Progression', () => {
  // Minimal bracket: R32 → R16 → QF → SF → Final + 3rd Place
  const INITIAL_BRACKET = [
    // R32
    { id: 73, stage: 'Round of 32', team_a: 'Mexico', team_b: 'Brazil' },
    { id: 74, stage: 'Round of 32', team_a: 'Germany', team_b: 'France' },
    // R16
    { id: 89, stage: 'Round of 16', team_a: 'Winner M73', team_b: 'Winner M74' },
    // QF
    { id: 97, stage: 'Quarter-final', team_a: 'Winner M89', team_b: 'Winner M90' },
    // SF
    { id: 101, stage: 'Semi-final', team_a: 'Winner M97', team_b: 'Winner M98' },
    { id: 102, stage: 'Semi-final', team_a: 'Winner M99', team_b: 'Winner M100' },
    // 3rd Place
    { id: 103, stage: '3rd Place Play-off', team_a: 'Loser M101', team_b: 'Loser M102' },
    // Final
    { id: 104, stage: 'Final', team_a: 'Winner M101', team_b: 'Winner M102' },
  ]

  test('3.1 — R32 winner fills R16 slot', () => {
    let matches = INITIAL_BRACKET.map(m => ({ ...m }))
    matches = resolveKnockoutProgression(matches, 73, 'teamA')
    expect(matches.find(m => m.id === 89).team_a).toBe('Mexico')
    // M74 still unresolved
    expect(matches.find(m => m.id === 89).team_b).toBe('Winner M74')
  })

  test('3.2 — Both R32 results fill R16 match', () => {
    let matches = INITIAL_BRACKET.map(m => ({ ...m }))
    matches = resolveKnockoutProgression(matches, 73, 'teamA')  // Mexico wins
    matches = resolveKnockoutProgression(matches, 74, 'teamB')  // France wins
    const m89 = matches.find(m => m.id === 89)
    expect(m89.team_a).toBe('Mexico')
    expect(m89.team_b).toBe('France')
  })

  test('3.3 — R16 winner fills QF slot', () => {
    let matches = INITIAL_BRACKET.map(m => ({ ...m }))
    matches = resolveKnockoutProgression(matches, 73, 'teamA')  // Mexico
    matches = resolveKnockoutProgression(matches, 74, 'teamB')  // France
    matches = resolveKnockoutProgression(matches, 89, 'teamA')  // Mexico wins R16
    const m97 = matches.find(m => m.id === 97)
    expect(m97.team_a).toBe('Mexico')
  })

  test('3.4 — Full cascade: R32 → R16 → QF → SF → Final', () => {
    // Full bracket tree — both halves through to Final
    const fullBracket = [
      // R32 (4 representative matches covering both SF paths)
      { id: 73, stage: 'Round of 32', team_a: 'Mexico', team_b: 'Brazil' },
      { id: 74, stage: 'Round of 32', team_a: 'Germany', team_b: 'France' },
      { id: 75, stage: 'Round of 32', team_a: 'Spain', team_b: 'Argentina' },
      { id: 76, stage: 'Round of 32', team_a: 'Italy', team_b: 'England' },
      { id: 77, stage: 'Round of 32', team_a: 'Portugal', team_b: 'Netherlands' },
      { id: 78, stage: 'Round of 32', team_a: 'Belgium', team_b: 'Japan' },
      { id: 79, stage: 'Round of 32', team_a: 'USA', team_b: 'Morocco' },
      { id: 80, stage: 'Round of 32', team_a: 'Senegal', team_b: 'Ecuador' },
      // R16
      { id: 89, stage: 'Round of 16', team_a: 'Winner M73', team_b: 'Winner M74' },
      { id: 90, stage: 'Round of 16', team_a: 'Winner M75', team_b: 'Winner M76' },
      { id: 91, stage: 'Round of 16', team_a: 'Winner M77', team_b: 'Winner M78' },
      { id: 92, stage: 'Round of 16', team_a: 'Winner M79', team_b: 'Winner M80' },
      // QF
      { id: 97, stage: 'Quarter-final', team_a: 'Winner M89', team_b: 'Winner M90' },
      { id: 98, stage: 'Quarter-final', team_a: 'Winner M91', team_b: 'Winner M92' },
      // SF
      { id: 101, stage: 'Semi-final', team_a: 'Winner M97', team_b: 'Winner M98' },
      { id: 102, stage: 'Semi-final', team_a: 'Winner M99', team_b: 'Winner M100' },
      // 3rd Place
      { id: 103, stage: '3rd Place Play-off', team_a: 'Loser M101', team_b: 'Loser M102' },
      // Final
      { id: 104, stage: 'Final', team_a: 'Winner M101', team_b: 'Winner M102' },
    ]
    let matches = fullBracket.map(m => ({ ...m }))
    // R32 results
    matches = resolveKnockoutProgression(matches, 73, 'teamA') // Mexico
    matches = resolveKnockoutProgression(matches, 74, 'teamA') // Germany
    matches = resolveKnockoutProgression(matches, 75, 'teamB') // Argentina
    matches = resolveKnockoutProgression(matches, 76, 'teamB') // England
    matches = resolveKnockoutProgression(matches, 77, 'teamA') // Portugal
    matches = resolveKnockoutProgression(matches, 78, 'teamA') // Belgium
    matches = resolveKnockoutProgression(matches, 79, 'teamA') // USA
    matches = resolveKnockoutProgression(matches, 80, 'teamA') // Senegal
    // R16 results
    matches = resolveKnockoutProgression(matches, 89, 'teamA') // Mexico
    matches = resolveKnockoutProgression(matches, 90, 'teamA') // Argentina
    matches = resolveKnockoutProgression(matches, 91, 'teamA') // Portugal
    matches = resolveKnockoutProgression(matches, 92, 'teamA') // USA
    // QF results
    matches = resolveKnockoutProgression(matches, 97, 'teamA') // Mexico
    matches = resolveKnockoutProgression(matches, 98, 'teamA') // Portugal
    // SF results
    matches = resolveKnockoutProgression(matches, 101, 'teamA') // Mexico beats Portugal
    matches = resolveKnockoutProgression(matches, 102, 'teamA') // (opponent unresolved, but that's ok for this path)
    // Verify the full chain for the Mexico path
    expect(matches.find(m => m.id === 89).team_a).toBe('Mexico')   // R16
    expect(matches.find(m => m.id === 97).team_a).toBe('Mexico')   // QF
    expect(matches.find(m => m.id === 101).team_a).toBe('Mexico')  // SF
    expect(matches.find(m => m.id === 104).team_a).toBe('Mexico')  // Final
    // 3rd place gets the loser of M101
    expect(matches.find(m => m.id === 103).team_a).toBe('Portugal')
  })

  test('3.5 — Loser routing for 3rd place match', () => {
    // Extended bracket with both halves
    const fullBracket = [
      { id: 73, stage: 'Round of 32', team_a: 'Mexico', team_b: 'Brazil' },
      { id: 74, stage: 'Round of 32', team_a: 'Germany', team_b: 'France' },
      { id: 75, stage: 'Round of 32', team_a: 'Spain', team_b: 'Argentina' },
      { id: 76, stage: 'Round of 32', team_a: 'Italy', team_b: 'England' },
      { id: 89, stage: 'Round of 16', team_a: 'Winner M73', team_b: 'Winner M74' },
      { id: 90, stage: 'Round of 16', team_a: 'Winner M75', team_b: 'Winner M76' },
      { id: 97, stage: 'Quarter-final', team_a: 'Winner M89', team_b: 'Winner M90' },
      { id: 101, stage: 'Semi-final', team_a: 'Winner M97', team_b: 'Winner M98' },
      { id: 102, stage: 'Semi-final', team_a: 'Winner M99', team_b: 'Winner M100' },
      { id: 103, stage: '3rd Place Play-off', team_a: 'Loser M101', team_b: 'Loser M102' },
      { id: 104, stage: 'Final', team_a: 'Winner M101', team_b: 'Winner M102' },
    ]
    let matches = fullBracket.map(m => ({ ...m }))
    // R32
    matches = resolveKnockoutProgression(matches, 73, 'teamA') // Mexico
    matches = resolveKnockoutProgression(matches, 74, 'teamA') // Germany
    matches = resolveKnockoutProgression(matches, 75, 'teamB') // Argentina
    matches = resolveKnockoutProgression(matches, 76, 'teamB') // England
    // R16
    matches = resolveKnockoutProgression(matches, 89, 'teamA') // Mexico
    matches = resolveKnockoutProgression(matches, 90, 'teamA') // Argentina
    // QF: Mexico beats Argentina
    matches = resolveKnockoutProgression(matches, 97, 'teamA')
    // SF: teamA wins M101 → Mexico wins, Loser M98 is the opponent
    // But M98 was never resolved, so the loser is "Winner M98"
    // We need M98 resolved too. Let's set up the other half.
    // For simplicity, set M101 and M102 to have real team names
    matches = matches.map(m => {
      if (m.id === 101) return { ...m, team_a: 'Mexico', team_b: 'Germany' }
      if (m.id === 102) return { ...m, team_a: 'France', team_b: 'Argentina' }
      return m
    })
    // SF1: Mexico beats Germany
    matches = resolveKnockoutProgression(matches, 101, 'teamA')
    // SF2: Argentina beats France
    matches = resolveKnockoutProgression(matches, 102, 'teamB')

    const m103 = matches.find(m => m.id === 103)
    const m104 = matches.find(m => m.id === 104)
    expect(m103.team_a).toBe('Germany')    // Loser of M101
    expect(m103.team_b).toBe('France')     // Loser of M102
    expect(m104.team_a).toBe('Mexico')     // Winner of M101
    expect(m104.team_b).toBe('Argentina')  // Winner of M102
  })

  test('3.6 — teamB winning also works', () => {
    let matches = INITIAL_BRACKET.map(m => ({ ...m }))
    // R32: Brazil beats Mexico (teamB wins M73)
    matches = resolveKnockoutProgression(matches, 73, 'teamB')
    const m89 = matches.find(m => m.id === 89)
    expect(m89.team_a).toBe('Brazil')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Full Tournament Simulation
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 4 — Full Tournament Simulation', () => {
  test('4.1 — Complete group stage → R32 slot resolution', () => {
    // Simulate all 6 matches in Group A
    const groupA = [
      { teamA: 'Mexico', teamB: 'South Africa', scoreA: 2, scoreB: 1, result: 'teamA' },
      { teamA: 'South Korea', teamB: 'Czechia', scoreA: 1, scoreB: 0, result: 'teamA' },
      { teamA: 'South Africa', teamB: 'Czechia', scoreA: 0, scoreB: 0, result: 'draw' },
      { teamA: 'Mexico', teamB: 'South Korea', scoreA: 3, scoreB: 1, result: 'teamA' },
      { teamA: 'Czechia', teamB: 'South Africa', scoreA: 2, scoreB: 1, result: 'teamA' },
      { teamA: 'South Korea', teamB: 'Mexico', scoreA: 0, scoreB: 0, result: 'draw' },
    ]
    const standings = computeGroupStandings({ A: groupA })
    const sorted = sortStandings(Object.values(standings.A))

    // Mexico: 2W 1D 0L, GF=5, GA=2, GD=+3, Pts=7 → 1st
    expect(sorted[0].team).toBe('Mexico')
    expect(sorted[0].points).toBe(7)
    // Czechia: 1W 1D 1L, GF=3, GA=2, GD=+1, Pts=4 → 2nd (better GD)
    expect(sorted[1].team).toBe('Czechia')
    expect(sorted[1].points).toBe(4)
    // South Korea: 1W 1D 1L, GF=2, GA=2, GD=0, Pts=4 → 3rd
    expect(sorted[2].team).toBe('South Korea')
    // South Africa: 0W 1D 2L, GF=2, GA=4, GD=-2, Pts=1 → 4th
    expect(sorted[3].team).toBe('South Africa')

    // Build slot map
    const slotMap = { 'Winner A': sorted[0].team, 'Runner-up A': sorted[1].team }
    expect(slotMap['Winner A']).toBe('Mexico')
    expect(slotMap['Runner-up A']).toBe('Czechia')
  })

  test('4.2 — Multiple groups produce correct slot map', () => {
    // Group A
    const groupA = [
      { teamA: 'Mexico', teamB: 'South Africa', scoreA: 2, scoreB: 0, result: 'teamA' },
      { teamA: 'South Korea', teamB: 'Czechia', scoreA: 1, scoreB: 0, result: 'teamA' },
      { teamA: 'Mexico', teamB: 'South Korea', scoreA: 1, scoreB: 0, result: 'teamA' },
      { teamA: 'South Africa', teamB: 'Czechia', scoreA: 0, scoreB: 1, result: 'teamB' },
      { teamA: 'Mexico', teamB: 'Czechia', scoreA: 2, scoreB: 1, result: 'teamA' },
      { teamA: 'South Korea', teamB: 'South Africa', scoreA: 3, scoreB: 0, result: 'teamA' },
    ]
    // Group B
    const groupB = [
      { teamA: 'Switzerland', teamB: 'Qatar', scoreA: 3, scoreB: 1, result: 'teamA' },
      { teamA: 'Canada', teamB: 'Bosnia and Herzegovina', scoreA: 2, scoreB: 2, result: 'draw' },
      { teamA: 'Switzerland', teamB: 'Canada', scoreA: 1, scoreB: 1, result: 'draw' },
      { teamA: 'Qatar', teamB: 'Bosnia and Herzegovina', scoreA: 0, scoreB: 2, result: 'teamB' },
      { teamA: 'Switzerland', teamB: 'Bosnia and Herzegovina', scoreA: 2, scoreB: 0, result: 'teamA' },
      { teamA: 'Canada', teamB: 'Qatar', scoreA: 4, scoreB: 0, result: 'teamA' },
    ]
    const standings = computeGroupStandings({ A: groupA, B: groupB })
    const sortedA = sortStandings(Object.values(standings.A))
    const sortedB = sortStandings(Object.values(standings.B))

    const slotMap = {}
    slotMap['Winner A'] = sortedA[0].team   // Mexico
    slotMap['Runner-up A'] = sortedA[1].team // South Korea
    slotMap['Winner B'] = sortedB[0].team    // Switzerland
    slotMap['Runner-up B'] = sortedB[1].team  // Canada

    expect(slotMap['Winner A']).toBe('Mexico')
    expect(slotMap['Runner-up A']).toBe('South Korea')
    expect(slotMap['Winner B']).toBe('Switzerland')
    expect(slotMap['Runner-up B']).toBe('Canada')
  })

  test('4.3 — Full bracket simulation: group results → final champion', () => {
    // Build slot map for all 12 groups (simplified — same winner for all)
    const slotMap = {}
    const winners = ['Mexico','Switzerland','Brazil','USA','Germany','Netherlands','Belgium','Spain','France','Argentina','Portugal','England']
    const runnersUp = ['South Korea','Canada','Morocco','Turkey','Ecuador','Japan','Egypt','Uruguay','Senegal','Algeria','Colombia','Croatia']
    const groups = 'ABCDEFGHIJKL'.split('')
    groups.forEach((g, i) => {
      slotMap[`Winner ${g}`] = winners[i]
      slotMap[`Runner-up ${g}`] = runnersUp[i]
    })

    // Best 3rd teams (from groups not already in slot map as winners/runners-up)
    const best3rds = [
      { team: 'Czechia', group: 'A', points: 4, gd: 0, gf: 3 },
      { team: 'Qatar', group: 'B', points: 4, gd: 1, gf: 5 },
      { team: 'Haiti', group: 'C', points: 4, gd: 2, gf: 6 },
      { team: 'Paraguay', group: 'D', points: 4, gd: 1, gf: 4 },
      { team: 'Ivory Coast', group: 'E', points: 4, gd: 0, gf: 3 },
      { team: 'Sweden', group: 'F', points: 4, gd: 1, gf: 4 },
      { team: 'Iran', group: 'G', points: 4, gd: 0, gf: 3 },
      { team: 'Cape Verde', group: 'H', points: 4, gd: -1, gf: 2 },
      { team: 'Iraq', group: 'I', points: 3, gd: -1, gf: 2 },
      { team: 'Jordan', group: 'J', points: 3, gd: -2, gf: 1 },
      { team: 'Uzbekistan', group: 'K', points: 3, gd: -1, gf: 2 },
      { team: 'Ghana', group: 'L', points: 4, gd: 1, gf: 4 },
    ]

    // Resolve R32 matches (from lib/data.js)
    const r32Matches = [
      { id: 73, team_a: 'Runner-up A', team_b: 'Runner-up B' },
      { id: 74, team_a: 'Winner E', team_b: 'Best 3rd (A/B/C/D/F)' },
      { id: 75, team_a: 'Winner F', team_b: 'Runner-up C' },
      { id: 76, team_a: 'Winner C', team_b: 'Runner-up F' },
      { id: 77, team_a: 'Winner I', team_b: 'Best 3rd (C/D/F/G/H)' },
      { id: 78, team_a: 'Runner-up E', team_b: 'Runner-up I' },
      { id: 79, team_a: 'Winner A', team_b: 'Best 3rd (C/E/F/H/I)' },
      { id: 80, team_a: 'Winner L', team_b: 'Best 3rd (E/H/I/J/K)' },
      { id: 81, team_a: 'Winner D', team_b: 'Best 3rd (B/E/F/I/J)' },
      { id: 82, team_a: 'Winner G', team_b: 'Best 3rd (A/E/H/I/J)' },
      { id: 83, team_a: 'Runner-up K', team_b: 'Runner-up L' },
      { id: 84, team_a: 'Winner H', team_b: 'Runner-up J' },
      { id: 85, team_a: 'Winner B', team_b: 'Best 3rd (E/F/G/I/J)' },
      { id: 86, team_a: 'Winner J', team_b: 'Runner-up H' },
      { id: 87, team_a: 'Winner K', team_b: 'Best 3rd (D/E/I/J/L)' },
      { id: 88, team_a: 'Runner-up D', team_b: 'Runner-up G' },
    ]

    // Resolve all R32 slots
    for (const m of r32Matches) {
      m.team_a = resolveGroupSlot(m.team_a, slotMap, best3rds)
      m.team_b = resolveGroupSlot(m.team_b, slotMap, best3rds)
    }

    // Verify all R32 matches resolved (no placeholders left)
    for (const m of r32Matches) {
      expect(m.team_a).not.toContain('Winner')
      expect(m.team_a).not.toContain('Runner-up')
      expect(m.team_a).not.toContain('Best 3rd')
      expect(m.team_b).not.toContain('Winner')
      expect(m.team_b).not.toContain('Runner-up')
      expect(m.team_b).not.toContain('Best 3rd')
    }

    // M73: Runner-up A vs Runner-up B
    expect(r32Matches[0].team_a).toBe('South Korea')
    expect(r32Matches[0].team_b).toBe('Canada')
    // M74: Winner E vs Best 3rd (A/B/C/D/F) — should pick Czechia (group A)
    expect(r32Matches[1].team_a).toBe('Germany')
    expect(r32Matches[1].team_b).toBe('Czechia')
    // M79: Winner A vs Best 3rd (C/E/F/H/I) — Haiti(C) consumed by M77, picks Ivory Coast(E)
    expect(r32Matches[6].team_a).toBe('Mexico')
    expect(r32Matches[6].team_b).toBe('Ivory Coast')
  })

  test('4.4 — Best 3rd pool gets fully consumed across all R32 slots', () => {
    const slotMap = {}
    const groups = 'ABCDEFGHIJKL'.split('')
    const winners = ['Mexico','Switzerland','Brazil','USA','Germany','Netherlands','Belgium','Spain','France','Argentina','Portugal','England']
    const runnersUp = ['South Korea','Canada','Morocco','Turkey','Ecuador','Japan','Egypt','Uruguay','Senegal','Algeria','Colombia','Croatia']
    groups.forEach((g, i) => {
      slotMap[`Winner ${g}`] = winners[i]
      slotMap[`Runner-up ${g}`] = runnersUp[i]
    })

    // 12 third-placed teams
    const allThirds = [
      { team: 'Czechia', group: 'A', points: 4, gd: 0, gf: 3 },
      { team: 'Qatar', group: 'B', points: 4, gd: 1, gf: 5 },
      { team: 'Haiti', group: 'C', points: 4, gd: 2, gf: 6 },
      { team: 'Paraguay', group: 'D', points: 4, gd: 1, gf: 4 },
      { team: 'Ivory Coast', group: 'E', points: 4, gd: 0, gf: 3 },
      { team: 'Sweden', group: 'F', points: 4, gd: 1, gf: 4 },
      { team: 'Iran', group: 'G', points: 4, gd: 0, gf: 3 },
      { team: 'Cape Verde', group: 'H', points: 4, gd: -1, gf: 2 },
      { team: 'Iraq', group: 'I', points: 3, gd: -1, gf: 2 },
      { team: 'Jordan', group: 'J', points: 3, gd: -2, gf: 1 },
      { team: 'Uzbekistan', group: 'K', points: 3, gd: -1, gf: 2 },
      { team: 'Ghana', group: 'L', points: 4, gd: 1, gf: 4 },
    ]
    // Best 8 thirds (top 8 by points/GD/GF)
    const best3rds = allThirds.slice(0, 8).map(t => ({ ...t }))

    // 8 Best 3rd slots in R32 (from data.js)
    const best3rdSlots = [
      'Best 3rd (A/B/C/D/F)',
      'Best 3rd (C/D/F/G/H)',
      'Best 3rd (C/E/F/H/I)',
      'Best 3rd (E/H/I/J/K)',
      'Best 3rd (B/E/F/I/J)',
      'Best 3rd (A/E/H/I/J)',
      'Best 3rd (E/F/G/I/J)',
      'Best 3rd (D/E/I/J/L)',
    ]

    let consumed = 0
    for (const slot of best3rdSlots) {
      const remaining = best3rds.length
      resolveGroupSlot(slot, slotMap, best3rds)
      if (best3rds.length < remaining) consumed++
    }

    // All 8 best 3rds should have been consumed
    expect(consumed).toBe(8)
    expect(best3rds.length).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Edge Cases
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Section 5 — Edge Cases', () => {
  test('5.1 — ilike pattern M73 does not false-match other IDs', () => {
    // For the actual knockout IDs (73-104), verify no substring collisions
    const knockoutIds = Array.from({ length: 32 }, (_, i) => 73 + i)
    for (const id of knockoutIds) {
      const pattern = `M${id}`
      // Check that no other knockout ID's pattern is a substring
      for (const otherId of knockoutIds) {
        if (id === otherId) continue
        const otherPattern = `M${otherId}`
        // "Winner M73".includes("M7") should be false for the actual IDs
        // We test: does "M73" appear inside "M74"? No.
        expect(otherPattern.includes(pattern)).toBe(false)
      }
    }
  })

  test('5.2 — 3rd place match gets correct losers', () => {
    let matches = [
      { id: 101, stage: 'Semi-final', team_a: 'Winner M97', team_b: 'Winner M98' },
      { id: 102, stage: 'Semi-final', team_a: 'Winner M99', team_b: 'Winner M100' },
      { id: 103, stage: '3rd Place Play-off', team_a: 'Loser M101', team_b: 'Loser M102' },
      { id: 104, stage: 'Final', team_a: 'Winner M101', team_b: 'Winner M102' },
    ]
    // Set up SF participants
    matches = matches.map(m => {
      if (m.id === 101) return { ...m, team_a: 'Spain', team_b: 'Brazil' }
      if (m.id === 102) return { ...m, team_a: 'France', team_b: 'Argentina' }
      return m
    })
    // SF1: Spain beats Brazil
    matches = resolveKnockoutProgression(matches, 101, 'teamA')
    // SF2: Argentina beats France
    matches = resolveKnockoutProgression(matches, 102, 'teamB')

    const m103 = matches.find(m => m.id === 103)
    const m104 = matches.find(m => m.id === 104)
    expect(m103.team_a).toBe('Brazil')   // Loser of M101
    expect(m103.team_b).toBe('France')   // Loser of M102
    expect(m104.team_a).toBe('Spain')    // Winner of M101
    expect(m104.team_b).toBe('Argentina') // Winner of M102
  })

  test('5.3 — Group draw correctly updates standings', () => {
    const results = [
      { teamA: 'Mexico', teamB: 'South Korea', scoreA: 1, scoreB: 1, result: 'draw' },
    ]
    const standings = computeGroupStandings({ A: results })
    expect(standings.A['Mexico'].points).toBe(1)
    expect(standings.A['South Korea'].points).toBe(1)
    expect(standings.A['Mexico'].drawn).toBe(1)
    expect(standings.A['Mexico'].won).toBe(0)
    expect(standings.A['Mexico'].lost).toBe(0)
  })

  test('5.4 — 3-way tie on points resolved by GD then GF', () => {
    const rows = [
      { team: 'TeamA', points: 6, goals_for: 5, goals_against: 3 },  // GD+2
      { team: 'TeamB', points: 6, goals_for: 4, goals_against: 2 },  // GD+2
      { team: 'TeamC', points: 6, goals_for: 3, goals_against: 1 },  // GD+2
    ]
    const sorted = sortStandings(rows)
    // All GD+2, broken by GF: 5 > 4 > 3
    expect(sorted.map(r => r.team)).toEqual(['TeamA', 'TeamB', 'TeamC'])
  })
})
