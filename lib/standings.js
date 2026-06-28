// ============================================================
// Group Standings Logic + Best 3rd Place Team Resolution
// ============================================================
import { supabase } from './supabase'
import { BEST_3RD_GROUP_TO_MATCH, BEST_3RD_MATCH_IDS, BEST_3RD_SLOTS_BY_MATCH } from './data'

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

// All teams per group (must match data.js GROUPS)
export const GROUP_TEAMS = {
  A: ["Mexico","South Korea","Czechia","South Africa"],
  B: ["Switzerland","Canada","Qatar","Bosnia and Herzegovina"],
  C: ["Brazil","Morocco","Haiti","Scotland"],
  D: ["USA","Turkey","Australia","Paraguay"],
  E: ["Germany","Ecuador","Ivory Coast","Curacao"],
  F: ["Netherlands","Japan","Sweden","Tunisia"],
  G: ["Belgium","Egypt","Iran","New Zealand"],
  H: ["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I: ["France","Senegal","Iraq","Norway"],
  J: ["Argentina","Algeria","Austria","Jordan"],
  K: ["Portugal","DR Congo","Uzbekistan","Colombia"],
  L: ["England","Croatia","Ghana","Panama"],
}

// Recalculate group standings from all completed group stage matches
export async function recalculateGroupStandings(allMatches) {
  const standings = buildStandings(allMatches)

  const rows = []
  for (const g of GROUPS) {
    for (const [team, s] of Object.entries(standings[g])) {
      rows.push({
        group_name: g, team,
        played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
        goals_for: s.goals_for, goals_against: s.goals_against, points: s.points,
        updated_at: new Date().toISOString(),
      })
    }
  }

  const { error } = await supabase.from('group_standings').upsert(rows, { onConflict: 'group_name,team' })
  if (error) throw new Error(`group_standings upsert failed: ${error.message}`)
  return standings
}

// Sort teams within a group by: Points → GD → GF → alphabetical
export function sortGroup(teamsObj) {
  return Object.entries(teamsObj)
    .map(([team, s]) => ({ team, ...s, gd: s.goals_for - s.goals_against }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
      return a.team.localeCompare(b.team)
    })
}

// ─── Internal helper: build standings from completed group matches ────────────

function buildStandings(allMatches) {
  const groupMatches = allMatches.filter(m => m.stage === 'Group Stage' && m.result !== null)
  const standings = {}
  for (const g of GROUPS) {
    standings[g] = {}
    for (const team of GROUP_TEAMS[g]) {
      standings[g][team] = { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 }
    }
  }
  for (const m of groupMatches) {
    const g = m.group_name
    if (!g || !standings[g]) continue
    const tA = standings[g][m.team_a]
    const tB = standings[g][m.team_b]
    if (!tA || !tB) continue
    tA.played++; tB.played++
    tA.goals_for += m.score_a; tA.goals_against += m.score_b
    tB.goals_for += m.score_b; tB.goals_against += m.score_a
    if (m.result === 'teamA') { tA.won++; tA.points += 3; tB.lost++ }
    else if (m.result === 'teamB') { tB.won++; tB.points += 3; tA.lost++ }
    else { tA.drawn++; tA.points++; tB.drawn++; tB.points++ }
  }
  return standings
}

// ─── Clinch detection ─────────────────────────────────────────────────────────
// Determine which teams in each group have mathematically guaranteed positions.

export function clinchedGroupPositions(standings) {
  const result = {}
  for (const g of GROUPS) {
    result[g] = {}
    const teamNames = GROUP_TEAMS[g]
    const entries = teamNames.map(t => ({ team: t, ...standings[g][t], gd: standings[g][t].goals_for - standings[g][t].goals_against }))
    const sorted = [...entries].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
      return a.team.localeCompare(b.team)
    })

    for (const t of entries) {
      if (t.played === 0 && t.points === 0) {
        result[g][t.team] = 'in_contention'
        continue
      }

      const remT = 3 - t.played
      const maxT = t.points + 3 * remT

      // Count teams that can equal or exceed T's best possible
      const maxPossible = entries.filter(s => s.team !== t.team)
        .map(s => s.points + 3 * (3 - s.played))
      const aheadOrEqual = maxPossible.filter(mp => mp >= maxT)
      if (aheadOrEqual.length >= 2) {
        result[g][t.team] = 'eliminated'
        continue
      }

      // Count teams that can exceed T's CURRENT points in the worst case for T
      // (T loses all remaining, others win all remaining)
      const canExceed = entries.filter(s => s.team !== t.team)
        .map(s => s.points + 3 * (3 - s.played))
        .filter(mp => mp > t.points)

      if (canExceed.length === 0) {
        result[g][t.team] = 'clinched_1st'
      } else if (canExceed.length === 1) {
        result[g][t.team] = 'clinched_top2'
      } else {
        result[g][t.team] = 'in_contention'
      }
    }
  }
  return result
}

// ─── Best 3rd-place locking ───────────────────────────────────────────────────
// Check if the top-8 best third-placed teams are mathematically locked.
// Returns { locked, top8 } where top8 = [{ team, group, points, gd, gf }].

export function isBestThirdLocked(standings) {
  const thirds = []
  for (const g of GROUPS) {
    const sorted = sortGroup(standings[g])
    if (sorted.length < 3) continue
    const t = sorted[2]
    const allPlayed = GROUPS[g]
      ? GROUP_TEAMS[g].every(team => standings[g][team].played === 3)
      : t.played === 3
    thirds.push({ team: t.team, group: g, points: t.points, gd: t.gd, gf: t.goals_for, complete: allPlayed })
  }

  const complete = thirds.filter(t => t.complete).sort(compareThird)
  const incomplete = thirds.filter(t => !t.complete)

  if (complete.length < 8) {
    // Not enough groups complete — check if even then, the top 8 can't change
    // This happens when the 8th best dead teams are so far ahead that
    // incomplete groups can't catch up
    if (complete.length === 0) return { locked: false, top8: [] }
    const eighth = complete[Math.min(7, complete.length - 1)]
    const canDisplace = incomplete.some(t => {
      const team = standings[t.group][t.team]
      if (!team) return true
      const maxPts = team.points + 3 * (3 - team.played)
      return maxPts >= eighth.points
    })
    if (canDisplace) return { locked: false, top8: complete.slice(0, 8) }
    // Locked! But we don't have 8 complete groups, so "top 8" includes some incomplete groups
    return { locked: true, top8: complete.slice(0, 8) }
  }

  // We have 8+ complete groups — check if incomplete groups can break in
  const eighth = complete[7]
  for (const t of incomplete) {
    const team = standings[t.group]?.[t.team]
    if (!team) continue
    // Compute max possible 3rd-place points for this group
    const allMaxes = GROUP_TEAMS[t.group]
      .map(name => ({ name, ...standings[t.group][name] }))
      .map(s => s.points + 3 * (3 - s.played))
    allMaxes.sort((a, b) => b - a)
    const bestPossible3rdPts = allMaxes[2] // 3rd highest max = upper bound of 3rd place

    if (bestPossible3rdPts > eighth.points) return { locked: false, top8: complete.slice(0, 8) }
    if (bestPossible3rdPts === eighth.points) return { locked: false, top8: complete.slice(0, 8) }
  }

  return { locked: true, top8: complete.slice(0, 8) }
}

// Compare two best-3rd-place teams by pts → GD → GF.
// FIFA also uses disciplinary records and drawing of lots as deeper tiebreakers,
// but we don't track card data. Returning 0 preserves insertion order (stable sort).
export function compareThird(a, b) {
  if (b.points !== a.points) return b.points - a.points
  if ((b.gd ?? b.goals_for - b.goals_against) !== (a.gd ?? a.goals_for - a.goals_against))
    return (b.gd ?? b.goals_for - b.goals_against) - (a.gd ?? a.goals_for - a.goals_against)
  if ((b.gf ?? b.goals_for) !== (a.gf ?? a.goals_for)) return (b.gf ?? b.goals_for) - (a.gf ?? a.goals_for)
  return 0
}

// ─── Progressive placeholder resolution ───────────────────────────────────────
// Resolve R32 placeholders (Winner/Runner-up/Best 3rd) as soon as positions
// are mathematically guaranteed, instead of waiting for all 72 group matches.

export async function resolveProgressivePlaceholders(allMatches) {
  const standings = buildStandings(allMatches)
  const clinch = clinchedGroupPositions(standings)

  // ── Step 1: Build slotMap from clinched teams ────────────────────────────
  // Only populate slots that are mathematically guaranteed.
  const slotMap = {}
  const best3rdsArr = []

  for (const g of GROUPS) {
    const teams = Object.entries(standings[g]).map(([team, s]) => ({
      team, ...s, gd: s.goals_for - s.goals_against,
      status: clinch[g]?.[team] ?? 'in_contention'
    }))
    teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
      return a.team.localeCompare(b.team)
    })

    // Winner: if 1st place is clinched, resolve it
    if (teams[0] && teams[0].status === 'clinched_1st') {
      slotMap[`Winner ${g}`] = teams[0].team
    }

    // Runner-up: if 2nd place is clinched (and 1st is also known, or 1st is clinched too)
    // Actually, we can resolve runner-up if:
    //   - 1st is clinched AND 2nd is clinched_top2, OR
    //   - Two teams have clinched_top2 (they occupy 1st and 2nd, but order is unknown)
    const clinchedTeams = teams.filter(t => t.status === 'clinched_1st' || t.status === 'clinched_top2')
    if (clinchedTeams.length === 2 && teams[1] && clinchedTeams.includes(teams[1])) {
      // Both 1st and 2nd are clinched, and we know the order
      if (teams[0] && teams[0].status === 'clinched_1st') {
        slotMap[`Winner ${g}`] = teams[0].team
        slotMap[`Runner-up ${g}`] = teams[1].team
      } else if (teams[0] && teams[0].status === 'clinched_top2' && teams[1] && teams[1].status === 'clinched_top2') {
        // Two teams clinched top 2 but order unknown — can't resolve individual slots
      }
    } else if (clinchedTeams.length === 2 && teams[0] && clinchedTeams.includes(teams[0]) && teams[1] && clinchedTeams.includes(teams[1])) {
      // Same as above but recheck
      if (teams[0].status === 'clinched_1st' && teams[1].status === 'clinched_top2') {
        slotMap[`Winner ${g}`] = teams[0].team
        slotMap[`Runner-up ${g}`] = teams[1].team
      }
    }

    // Collect 3rd-place team for best-3rd qualification
    if (teams[2]) {
      const allPlayed = GROUP_TEAMS[g].every(n => standings[g][n].played === 3)
      best3rdsArr.push({
        team: teams[2].team,
        group: g,
        points: teams[2].points,
        gd: teams[2].gd,
        gf: teams[2].goals_for,
        complete: allPlayed,
      })
    }
  }

  // ── Step 2: Determine top-8 best 3rd places ─────────────────────────────
  let resolvedThirds = []
  const locked = isBestThirdLocked(standings)
  if (locked.locked) {
    resolvedThirds = [...locked.top8]
    resolvedThirds.sort(compareThird)
  }

  // ── Step 3: Reset best-3rd slots to original placeholder text ───────────
  // Stale team names from previous partial resolutions must be cleared.
  const r32Matches = allMatches.filter(m => m.stage === 'Round of 32')
  for (const m of r32Matches) {
    const orig = BEST_3RD_SLOTS_BY_MATCH[m.id]
    if (orig) m.team_b = orig
  }

  // ── Step 4: Assign best 3rds via FIFA's predetermined group→match table ──
  // The 2026 World Cup uses a fixed mapping (not ranking-based consumption).
  const updates = []
  for (const t of resolvedThirds) {
    const targetId = BEST_3RD_GROUP_TO_MATCH[t.group]
    if (!targetId) continue
    const match = r32Matches.find(m => m.id === targetId)
    if (!match || match.team_b === t.team) continue
    updates.push(supabase.from('matches').update({ team_b: t.team }).eq('id', targetId))
  }

  // ── Step 5: Resolve Winner/Runner-up placeholders via slotMap ───────────
  const bestCopy = [...resolvedThirds]
  for (const m of r32Matches) {
    if (BEST_3RD_MATCH_IDS.has(m.id)) continue // already handled above
    const newA = resolveGroupSlot(m.team_a, slotMap, bestCopy)
    const newB = resolveGroupSlot(m.team_b, slotMap, bestCopy)
    const upd = {}
    if (newA && newA !== m.team_a) upd.team_a = newA
    if (newB && newB !== m.team_b) upd.team_b = newB
    if (Object.keys(upd).length > 0) updates.push(supabase.from('matches').update(upd).eq('id', m.id))
  }

  if (updates.length > 0) {
    await Promise.all(updates)
  }

  return { slotMap, resolvedThirds, updatedCount: updates.length }
}

// ─── Placeholder resolution ───────────────────────────────────────────────────
// Try to resolve a placeholder like "Winner A", "Runner-up B", "Best 3rd (A/B/C/D/F)"
// best3rds: mutable array of { team, group } sorted best-first (consumed as assigned)

export function resolveGroupSlot(placeholder, slotMap, best3rds) {
  if (!placeholder) return null
  if (slotMap[placeholder]) return slotMap[placeholder]
  if (placeholder.startsWith('Best 3rd')) {
    const match = placeholder.match(/\(([^)]+)\)/)
    if (match) {
      const allowed = match[1].split('/').map(s => s.trim())
      const idx = best3rds.findIndex(t => allowed.includes(t.group))
      if (idx !== -1) {
        const [pick] = best3rds.splice(idx, 1)
        return pick.team
      }
    }
    if (best3rds.length > 0) return best3rds.shift().team
  }
  return null
}
