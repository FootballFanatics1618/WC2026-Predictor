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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    if (!pendingMatches || pendingMatches.length === 0) {
      await writeLog(0, 0, null, source)
      return json({ message: 'No pending matches to sync', source })
    }

    log.matched = pendingMatches.length
    console.log(`[sync-scores] Found ${pendingMatches.length} unresolved past matches`)

    // ── Step 2: Fetch all matches from API ───────────────────────────────────
    const apiRes = await fetch(`${API_BASE}/games`)
    if (!apiRes.ok) throw new Error(`API error: ${apiRes.status}`)
    const apiData = await apiRes.json()
    const apiMatches: ApiMatch[] = apiData.games ?? []

    // Build a quick lookup: api_id (string) → api match
    // The API id field may match our DB id directly — depends on the API
    const apiMap: Record<string, ApiMatch> = {}
    for (const m of apiMatches) {
      apiMap[String(m.id)] = m
    }

    // ── Step 3: For each pending DB match, check if API says it's done ───────
    for (const dbMatch of pendingMatches as DbMatch[]) {
      const apiMatch = apiMap[String(dbMatch.id)]

      if (!apiMatch) {
        // API doesn't have this match ID yet — skip silently
        console.log(`[sync-scores] Match ${dbMatch.id} not found in API response`)
        continue
      }

      if (!isFinished(apiMatch)) {
        console.log(`[sync-scores] Match ${dbMatch.id} not yet finished (status: ${apiMatch.time_elapsed})`)
        continue
      }

      const { home, away } = extractScore(apiMatch)
      if (home === null || away === null) {
        log.errors.push(`Match ${dbMatch.id}: finished but scores missing in API`)
        continue
      }

      const result = deriveResult(home, away)

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

    // ── Step 7: Write sync log ───────────────────────────────────────────────
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
