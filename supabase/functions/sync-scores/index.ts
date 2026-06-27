/**
 * sync-scores — Supabase Edge Function
 *
 * What it does:
 *   1. Finds all matches that have ended (kickoff_utc + 2h < now) but have no result yet
 *   2. Calls the worldcup26.ir API to get current scores
 *   3. If the API shows a match is finished, writes result + scores to DB
 *   4. Calls score_match_predictions() to batch-score all predictions
 *   5. Resolves knockout progression for the next round
 *   6. Logs the run to sync_log
 *
 * Invoked by:
 *   - pg_cron on a schedule (no-polling: only fires at smart post-match times)
 *   - Admin dashboard "Sync Now" button (source=manual)
 *   - Can also be called via HTTP: POST /functions/v1/sync-scores
 *
 * Deploy: supabase functions deploy sync-scores --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const API_BASE = 'https://worldcup26.ir/get'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

// Supabase client using service role — bypasses RLS entirely
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiMatch {
  id: string | number
  finished: string       // "TRUE" | "FALSE"
  time_elapsed: string   // "finished" | "not started" | time string
  home_score: string | number
  away_score: string | number
  home_team_name_en: string
  away_team_name_en: string
  home_team_label?: string
  away_team_label?: string
}

interface DbMatch {
  id: number
  team_a: string
  team_b: string
  stage: string
  result: string | null
  kickoff_utc: string
  knockout_slot: string | null
}

// ─── Team name aliases ────────────────────────────────────────────────────────
// The API uses different team names than our DB in some cases.
// Map API names → DB names so team-name matching works correctly.

const TEAM_NAME_ALIASES: Record<string, string> = {
  'czech republic': 'czechia',
  'united states': 'usa',
  'curaçao': 'curacao',
  'curacao': 'curacao',
  'dr congo': 'dr congo',
  'democratic republic of congo': 'dr congo',
  'ivory coast': 'ivory coast',
  "côte d'ivoire": 'ivory coast',
}

function normalizeTeam(name: string): string {
  const lower = name.toLowerCase().trim()
  return TEAM_NAME_ALIASES[lower] ?? lower
}

// Proper-cased DB names for all teams — maps normalised API name → DB name
const GROUP_TEAMS_ALL: string[] = [
  "Mexico","South Korea","Czechia","South Africa",
  "Switzerland","Canada","Qatar","Bosnia and Herzegovina",
  "Brazil","Morocco","Haiti","Scotland",
  "USA","Turkey","Australia","Paraguay",
  "Germany","Ecuador","Ivory Coast","Curacao",
  "Netherlands","Japan","Sweden","Tunisia",
  "Belgium","Egypt","Iran","New Zealand",
  "Spain","Cape Verde","Saudi Arabia","Uruguay",
  "France","Senegal","Iraq","Norway",
  "Argentina","Algeria","Austria","Jordan",
  "Portugal","DR Congo","Uzbekistan","Colombia",
  "England","Croatia","Ghana","Panama",
]
const DB_TEAM_NAMES: Record<string, string> = {}
for (const t of GROUP_TEAMS_ALL) DB_TEAM_NAMES[normalizeTeam(t)] = t

function apiNameToDb(apiName: string): string {
  return DB_TEAM_NAMES[normalizeTeam(apiName)] ?? apiName
}

function isPlaceholder(name: string): boolean {
  if (!name) return true
  return name.includes('Winner') || name.includes('Runner-up') || name.includes('Best 3rd') || name.includes('3rd Group')
}

// Normalise a label from either API or DB to a common form for comparison:
// "Runner-up Group A" → "runner-up a"
// "Runner-up A"       → "runner-up a"
// "3rd Group A/B/C"  → "3rd a/b/c"
// "Best 3rd (A/B/C)" → "3rd a/b/c"
// "Winner Group E"   → "winner e"
// "Winner E"         → "winner e"
function normalizeLabel(s: string): string {
  return s.toLowerCase()
    .replace(/\bgroup\s+/g, '')  // remove "Group "
    .replace(/\bbest\s+/g, '')   // remove "best " → "3rd ..."
    .replace(/[()]/g, '')         // remove parentheses
    .trim()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
      return res
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_BACKOFF_MS * 2 ** (attempt - 1)
        console.log(`[sync-scores] Fetch attempt ${attempt} failed, retrying in ${delay}ms…`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw lastErr
}

function extractScore(m: ApiMatch): { home: number | null; away: number | null } {
  const home = m.home_score != null ? Number(m.home_score) : null
  const away = m.away_score != null ? Number(m.away_score) : null
  return { home, away }
}

function isFinished(m: ApiMatch): boolean {
  if (m.finished === 'TRUE') return true
  const t = (m.time_elapsed ?? '').toLowerCase()
  return t.includes('finished') || t.includes('ft')
}

function deriveResult(home: number, away: number): 'teamA' | 'teamB' | 'draw' {
  if (home > away) return 'teamA'
  if (away > home) return 'teamB'
  return 'draw'
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const source = new URL(req.url).searchParams.get('source') ?? 'cron'
  const log = { matched: 0, updated: 0, scored: 0, errors: [] as string[] }

  try {
    // ── Step 1: Find matches that should be finished but aren't scored yet ──
    // Group stage: 2h buffer (90 min + stoppage)
    // Knockout: 3.5h buffer (extra time + penalties + API lag)
    const KNOCKOUT_STAGES = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', '3rd Place Play-off', 'Final']
    const BUFFER_GROUP = 2 * 60 * 60 * 1000          // 2 hours
    const BUFFER_KNOCKOUT = 3.5 * 60 * 60 * 1000     // 3.5 hours

    const groupCutoff = new Date(Date.now() - BUFFER_GROUP).toISOString()
    const knockoutCutoff = new Date(Date.now() - BUFFER_KNOCKOUT).toISOString()

    const { data: pendingMatches, error: fetchErr } = await supabase
      .from('matches')
      .select('id, team_a, team_b, stage, result, kickoff_utc, knockout_slot')
      .is('result', null)
      .or(`and(stage.eq.Group Stage,kickoff_utc.lt.${groupCutoff}),and(stage.neq.Group Stage,kickoff_utc.lt.${knockoutCutoff})`)
      .order('kickoff_utc')

    if (fetchErr) throw new Error(`DB fetch failed: ${fetchErr.message}`)

    log.matched = pendingMatches?.length ?? 0
    if (log.matched > 0) console.log(`[sync-scores] Found ${log.matched} unresolved past matches`)

    // ── Step 2: Fetch all matches from API ───────────────────────────────────
    let apiMatches: ApiMatch[] = []
    try {
      const apiRes = await fetchWithRetry(`${API_BASE}/games`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      })
      if (!apiRes.ok) throw new Error(`API error: ${apiRes.status}`)
      const apiData = await apiRes.json()
      apiMatches = apiData.games ?? []
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr)
      console.error('[sync-scores] API fetch failed:', msg)
      log.errors.push(`API unavailable: ${msg}`)
      await writeLog(log.matched, 0, log.errors.join('; '), source)
      return json({ source, matchesChecked: log.matched, matchesUpdated: 0, errors: log.errors })
    }

    // Build lookups: by team-name pair AND by label pair (for placeholder resolution)
    const apiMap: Record<string, ApiMatch> = {}
    const apiLabelMap: Record<string, ApiMatch> = {}
    for (const m of apiMatches) {
      if (m.home_team_name_en && m.away_team_name_en) {
        const home = normalizeTeam(m.home_team_name_en)
        const away = normalizeTeam(m.away_team_name_en)
        apiMap[`${home}|${away}`] = m
      }
      if (m.home_team_label && m.away_team_label) {
        const la = normalizeLabel(m.home_team_label)
        const lb = normalizeLabel(m.away_team_label)
        apiLabelMap[`${la}|${lb}`] = m
      }
    }

    // ── Step 2b: Resolve placeholder team names in upcoming knockout matches ──
    // Runs before score sync — uses API labels to resolve "Runner-up A" → real team
    // without needing group stage to be complete or ID matching.
    const { data: placeholderMatches } = await supabase
      .from('matches')
      .select('id, team_a, team_b')
      .neq('stage', 'Group Stage')
      .is('result', null)

    for (const m of (placeholderMatches ?? [])) {
      if (!isPlaceholder(m.team_a) && !isPlaceholder(m.team_b)) continue
      const la = normalizeLabel(m.team_a)
      const lb = normalizeLabel(m.team_b)
      const apiM = apiLabelMap[`${la}|${lb}`]
      if (!apiM) continue
      // Resolve whichever side the API knows — keep unknown side as current placeholder
      const resolvedA = (isPlaceholder(m.team_a) && apiM.home_team_name_en)
        ? apiNameToDb(apiM.home_team_name_en) : m.team_a
      const resolvedB = (isPlaceholder(m.team_b) && apiM.away_team_name_en)
        ? apiNameToDb(apiM.away_team_name_en) : m.team_b
      if (resolvedA === m.team_a && resolvedB === m.team_b) continue
      await supabase.from('matches').update({ team_a: resolvedA, team_b: resolvedB }).eq('id', m.id)
      console.log(`[sync-scores] Resolved match ${m.id}: ${resolvedA} vs ${resolvedB}`)
    }

    // ── Step 3: For each pending DB match, check if API says it's done ───────
    for (const dbMatch of (pendingMatches ?? []) as DbMatch[]) {
      if (!dbMatch.team_a || !dbMatch.team_b) continue
      const keyAB = `${normalizeTeam(dbMatch.team_a)}|${normalizeTeam(dbMatch.team_b)}`
      const keyBA = `${normalizeTeam(dbMatch.team_b)}|${normalizeTeam(dbMatch.team_a)}`
      const apiMatch = apiMap[keyAB] ?? apiMap[keyBA]
      // Track whether home/away are swapped so we assign scores correctly
      const swapped = !apiMap[keyAB] && !!apiMap[keyBA]

      if (!apiMatch) {
        // API doesn't have this match yet — skip silently
        console.log(`[sync-scores] Match ${dbMatch.id} (${dbMatch.team_a} vs ${dbMatch.team_b}) not found in API response`)
        continue
      }

      if (!isFinished(apiMatch)) {
        console.log(`[sync-scores] Match ${dbMatch.id} not yet finished (status: ${apiMatch.time_elapsed})`)
        continue
      }

      const { home: rawHome, away: rawAway } = extractScore(apiMatch)
      if (rawHome === null || rawAway === null) {
        log.errors.push(`Match ${dbMatch.id}: finished but scores missing in API`)
        continue
      }

      // If API has teams in opposite order, swap so score_a = team_a, score_b = team_b
      const home = swapped ? rawAway : rawHome
      const away = swapped ? rawHome : rawAway

      const result = deriveResult(home, away)

      // Knockout draw = penalties — API can't provide the winner, skip for manual admin entry
      const isKnockout = dbMatch.stage !== 'Group Stage'
      if (isKnockout && home === away) {
        log.errors.push(`Match ${dbMatch.id}: penalties detected (scores level ${home}-${away}) — requires manual entry`)
        console.log(`[sync-scores] Match ${dbMatch.id}: skipping penalty match for manual admin entry`)
        continue
      }

      // ── Step 4: Write result to DB ─────────────────────────────────────────
      const { error: updateErr } = await supabase
        .from('matches')
        .update({
          result,
          score_a: home,
          score_b: away,
          auto_synced_at: new Date().toISOString(),
          sync_source: 'api',
        })
        .eq('id', dbMatch.id)

      if (updateErr) {
        log.errors.push(`Match ${dbMatch.id} update failed: ${updateErr.message}`)
        continue
      }

      log.updated++
      console.log(`[sync-scores] Match ${dbMatch.id}: ${dbMatch.team_a} ${home}–${away} ${dbMatch.team_b} (${result})`)

      // ── Step 5: Batch-score all predictions via DB function ────────────────
      const { data: scoredCount, error: scoreErr } = await supabase
        .rpc('score_match_predictions', { p_match_id: dbMatch.id })

      if (scoreErr) {
        log.errors.push(`Match ${dbMatch.id} scoring failed: ${scoreErr.message}`)
      } else {
        log.scored += (scoredCount as number) ?? 0
        console.log(`[sync-scores] Scored ${scoredCount} predictions for match ${dbMatch.id}`)
      }

      // ── Step 6: Knockout progression ──────────────────────────────────────
      if (dbMatch.stage !== 'Group Stage') {
        await resolveKnockoutProgression(dbMatch.id, result, dbMatch.team_a, dbMatch.team_b)
      }
    }

    // ── Step 7: Recalculate group standings from all completed matches ──────
    await recalculateGroupStandings()

    // ── Step 8: Write sync log ───────────────────────────────────────────────
    await writeLog(log.matched, log.updated, log.errors.length ? log.errors.join('; ') : null, source)

    return json({
      source,
      matchesChecked: log.matched,
      matchesUpdated: log.updated,
      predictionsScored: log.scored,
      errors: log.errors,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-scores] Fatal error:', msg)
    await writeLog(0, 0, msg, source)
    return json({ error: msg }, 500)
  }
})

// ─── Knockout progression ─────────────────────────────────────────────────────
// After a knockout match result, update the placeholder text in the next round
// e.g. "Winner M73" → "France"

async function resolveKnockoutProgression(
  matchId: number,
  result: string,
  teamA: string,
  teamB: string
) {
  const winner = result === 'teamA' ? teamA : teamB
  const loser  = result === 'teamA' ? teamB : teamA

  // Find any future match that references this match number in its team fields
  const { data: futureMathces } = await supabase
    .from('matches')
    .select('id, team_a, team_b')
    .or(`team_a.ilike.%M${matchId}%,team_b.ilike.%M${matchId}%`)

  for (const fm of (futureMathces ?? [])) {
    const updates: Record<string, string> = {}
    if (fm.team_a?.includes(`M${matchId}`)) {
      updates.team_a = fm.team_a.includes('Loser') ? loser : winner
    }
    if (fm.team_b?.includes(`M${matchId}`)) {
      updates.team_b = fm.team_b.includes('Loser') ? loser : winner
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('matches').update(updates).eq('id', fm.id)
      console.log(`[sync-scores] Resolved knockout match ${fm.id}:`, updates)
    }
  }
}

// ─── Group standings recalculation ────────────────────────────────────────────

async function recalculateGroupStandings() {
  const { data: allMatches } = await supabase
    .from('matches')
    .select('group_name, team_a, team_b, stage, result, score_a, score_b')
    .eq('stage', 'Group Stage')
    .not('result', 'is', null)

  const GROUP_TEAMS: Record<string, string[]> = {
    A: ["Mexico", "South Korea", "Czechia", "South Africa"],
    B: ["Switzerland", "Canada", "Qatar", "Bosnia and Herzegovina"],
    C: ["Brazil", "Morocco", "Haiti", "Scotland"],
    D: ["USA", "Turkey", "Australia", "Paraguay"],
    E: ["Germany", "Ecuador", "Ivory Coast", "Curacao"],
    F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
    G: ["Belgium", "Egypt", "Iran", "New Zealand"],
    H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    I: ["France", "Senegal", "Iraq", "Norway"],
    J: ["Argentina", "Algeria", "Austria", "Jordan"],
    K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
    L: ["England", "Croatia", "Ghana", "Panama"],
  }

  const standings: Record<string, Record<string, { played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number }>> = {}
  for (const [g, teams] of Object.entries(GROUP_TEAMS)) {
    standings[g] = {}
    for (const team of teams) standings[g][team] = { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 }
  }

  for (const m of (allMatches || [])) {
    const g = m.group_name
    if (!g || !standings[g]) continue
    const tA = standings[g][m.team_a]
    const tB = standings[g][m.team_b]
    if (!tA || !tB) continue

    tA.played++
    tB.played++
    tA.goals_for += m.score_a
    tA.goals_against += m.score_b
    tB.goals_for += m.score_b
    tB.goals_against += m.score_a

    if (m.result === 'teamA') { tA.won++; tA.points += 3; tB.lost++ }
    else if (m.result === 'teamB') { tB.won++; tB.points += 3; tA.lost++ }
    else { tA.drawn++; tA.points++; tB.drawn++; tB.points++ }
  }

  const rows: Array<Record<string, unknown>> = []
  for (const [g, teams] of Object.entries(standings)) {
    for (const [team, s] of Object.entries(teams)) {
      rows.push({
        group_name: g, team,
        played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
        goals_for: s.goals_for, goals_against: s.goals_against, points: s.points,
        updated_at: new Date().toISOString(),
      })
    }
  }

  const { error } = await supabase.from('group_standings').upsert(rows, { onConflict: 'group_name,team' })
  if (error) console.error('[sync-scores] Group standings upsert failed:', error.message)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function writeLog(checked: number, updated: number, errors: string | null, source: string) {
  await supabase.from('sync_log').insert({
    matches_checked: checked,
    matches_updated: updated,
    errors,
    source,
  })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
