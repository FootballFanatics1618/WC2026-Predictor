// ============================================================
// Group Standings Logic + Best 3rd Place Team Resolution
// ============================================================
import { supabase } from './supabase'

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
  const groupMatches = allMatches.filter(m => m.stage === 'Group Stage' && m.result !== null)

  // Build standings map: { group: { team: { p, w, d, l, gf, ga, pts } } }
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

    if (m.result === 'teamA') {
      tA.won++; tA.points += 3; tB.lost++
    } else if (m.result === 'teamB') {
      tB.won++; tB.points += 3; tA.lost++
    } else {
      tA.drawn++; tA.points++; tB.drawn++; tB.points++
    }
  }

  // Upsert into Supabase
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

// After all 3 group matchdays complete, determine R32 teams:
// Winner = 1st in group, Runner-up = 2nd, Best 3rd = best of 12 third-placed teams
// Returns map of slot → actual team name, e.g. { "Winner A": "Spain", "Runner-up B": "Canada", ... }
export async function resolveGroupStageKnockouts(allMatches, allGroupMatches) {
  const standings = {}
  for (const g of GROUPS) {
    standings[g] = {}
    for (const team of GROUP_TEAMS[g]) {
      standings[g][team] = { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 }
    }
  }

  for (const m of allGroupMatches) {
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

  const slotMap = {}
  const thirdPlacedTeams = [] // { team, group, points, gd, gf }

  for (const g of GROUPS) {
    const sorted = sortGroup(standings[g])
    if (sorted.length >= 1) slotMap[`Winner ${g}`] = sorted[0].team
    if (sorted.length >= 2) slotMap[`Runner-up ${g}`] = sorted[1].team
    if (sorted.length >= 3) {
      const t = sorted[2]
      thirdPlacedTeams.push({ team: t.team, group: g, points: t.points, gd: t.gd, gf: t.goals_for })
    }
  }

  // Sort third-placed teams to find best 8 (WC2026 has 8 best 3rds advancing to R32)
  thirdPlacedTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.group.localeCompare(b.group)
  })

  // The best 8 third-placed teams advance
  // They fill the "Best 3rd" slots in R32. The exact slot assignment depends
  // on which groups they come from — stored as ordered list for simplicity
  const best3rds = thirdPlacedTeams.slice(0, 8)
  best3rds.forEach((t, i) => {
    slotMap[`Best3rd_${i + 1}`] = t.team
  })

  return slotMap
}

// Update all knockout matches in Supabase once group stage is fully done
export async function propagateGroupWinners(allMatches) {
  const groupMatches = allMatches.filter(m => m.stage === 'Group Stage' && m.result !== null)
  const slotMap = await resolveGroupStageKnockouts(allMatches, groupMatches)

  // Build ranked best-3rds array from the slotMap (Best3rd_1..8 + their groups)
  // resolveGroupStageKnockouts stores group info separately — rebuild it here
  // by re-computing from standings
  const { data: standingRows } = await supabase.from('group_standings').select('*')
  const best3rdsArr = []
  for (const g of GROUPS) {
    const rows = (standingRows || [])
      .filter(r => r.group_name === g)
      .sort((a,b) => {
        if (b.points !== a.points) return b.points - a.points
        const gdA = a.goals_for-a.goals_against, gdB = b.goals_for-b.goals_against
        if (gdB !== gdA) return gdB - gdA
        if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
        return a.team.localeCompare(b.team)
      })
    if (rows[2]) best3rdsArr.push({ team: rows[2].team, group: g, points: rows[2].points, gd: rows[2].goals_for-rows[2].goals_against, gf: rows[2].goals_for })
  }
  best3rdsArr.sort((a,b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.group.localeCompare(b.group)
  })

  // For each R32 match, find which slots need updating
  const r32Matches = allMatches.filter(m => m.stage === 'Round of 32')
  const updates = []

  for (const m of r32Matches) {
    const upd = {}
    // team_a: check if it matches a slot key
    const newA = resolveSlot(m.team_a, slotMap, best3rdsArr)
    const newB = resolveSlot(m.team_b, slotMap, best3rdsArr)
    if (newA && newA !== m.team_a) upd.team_a = newA
    if (newB && newB !== m.team_b) upd.team_b = newB
    if (Object.keys(upd).length > 0) {
      updates.push(supabase.from('matches').update(upd).eq('id', m.id))
    }
  }

  await Promise.all(updates)
  return slotMap
}

// Try to resolve a placeholder like "Winner A", "Runner-up B", "Best 3rd (A/B/C/D/F)"
// best3rdsArr: mutable array of { team, group } sorted best-first (consumed as assigned)
function resolveSlot(placeholder, slotMap, best3rdsArr) {
  if (!placeholder) return null
  // Direct match: "Winner A", "Runner-up B"
  if (slotMap[placeholder]) return slotMap[placeholder]
  // Best 3rd: "Best 3rd (A/B/C/D/F)" — pick highest-ranked 3rd from allowed groups
  if (placeholder.startsWith('Best 3rd')) {
    const match = placeholder.match(/\(([^)]+)\)/)
    if (match) {
      const allowedGroups = match[1].split('/').map(s => s.trim())
      const idx = best3rdsArr.findIndex(t => allowedGroups.includes(t.group))
      if (idx !== -1) {
        const [pick] = best3rdsArr.splice(idx, 1)
        return pick.team
      }
    }
    // Fallback: best available regardless of group
    if (best3rdsArr.length > 0) return best3rdsArr.shift().team
  }
  return null
}
