const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// ── Load .env.local manually (no dotenv dep) ──────────────────────────────────
function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const eqIdx = trimmed.indexOf('=')
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = val
    process.env[key] = val
  }
  return env
}

loadEnv(path.join(__dirname, '..', '.env.local'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// ── Inline scorePrediction (pure function, no deps) ──────────────────────────
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

// ── Paginate predictions (same as leaderboard.js) ────────────────────────────
async function fetchAllPredictions() {
  let all = []
  let from = 0
  const pageSize = 999
  while (true) {
    const { data: chunk } = await supabase
      .from('predictions')
      .select('*')
      .range(from, from + pageSize)
    if (!chunk || chunk.length === 0) break
    all = all.concat(chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return all
}

// ── Main verification ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══ FETCHING DATA ═══\n')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, first_name, last_name, golden_boot_pick, golden_boot_correct')
  console.log(`  Profiles: ${profiles?.length || 0}`)

  const { data: matches } = await supabase
    .from('matches')
    .select('id, team_a, team_b, stage, result, score_a, score_b, won_on_penalties, match_date')
    .order('match_date').order('match_time')
  console.log(`  Matches:  ${matches?.length || 0} (${matches?.filter(m => m.result != null).length || 0} completed)`)

  const predictions = await fetchAllPredictions()
  console.log(`  Predictions: ${predictions.length}`)

  // Build lookup maps
  const matchMap = new Map()
  for (const m of matches || []) matchMap.set(m.id, m)

  const completedMatchIds = new Set()
  for (const m of matches || []) {
    if (m.result != null) completedMatchIds.add(m.id)
  }

  // ── Per-prediction verification ───────────────────────────────────────────
  console.log('\n═══ PER-PREDICTION ACCURACY CHECK ═══\n')
  let totalMismatches = 0
  let totalChecked = 0
  const mismatchDetails = []

  for (const pred of predictions) {
    if (pred.match_id === 9999) continue // golden boot prediction
    const match = matchMap.get(pred.match_id)
    if (!match || match.result == null) continue

    totalChecked++
    const recomputed = scorePrediction(pred, match)
    const issues = []

    if (recomputed.points_earned !== pred.points_earned) {
      issues.push(`pts: stored=${pred.points_earned} expected=${recomputed.points_earned}`)
    }
    if (recomputed.is_result_correct !== pred.is_result_correct) {
      issues.push(`cr: stored=${pred.is_result_correct} expected=${recomputed.is_result_correct}`)
    }
    if (recomputed.is_score_correct !== pred.is_score_correct) {
      issues.push(`cs: stored=${pred.is_score_correct} expected=${recomputed.is_score_correct}`)
    }

    if (issues.length > 0) {
      totalMismatches++
      mismatchDetails.push({
        user_id: pred.user_id,
        match_id: pred.match_id,
        match_label: `${match.team_a} v ${match.team_b}`,
        issues: issues.join('; '),
        pred_result: pred.predicted_result,
        pred_score: `${pred.predicted_score_a}-${pred.predicted_score_b}`,
        actual_result: match.result,
        actual_score: `${match.score_a}-${match.score_b}`,
      })
    }
  }

  console.log(`  Predictions checked: ${totalChecked}`)
  console.log(`  Mismatches found:    ${totalMismatches}`)

  if (mismatchDetails.length > 0) {
    console.log('\n  ── Mismatch details ──\n')
    for (const d of mismatchDetails) {
      console.log(`  [User ${d.user_id.slice(0, 8)}…] Match M${d.match_id} (${d.match_label})`)
      console.log(`    Predicted: ${d.pred_result} ${d.pred_score}`)
      console.log(`    Actual:    ${d.actual_result} ${d.actual_score}`)
      console.log(`    Issues:    ${d.issues}\n`)
    }
  }

  // ── Leaderboard verification ─────────────────────────────────────────────
  console.log('\n═══ LEADERBOARD RECOMPUTATION ═══\n')

  const leaderboard = (profiles || []).map(p => {
    const userPreds = predictions.filter(pr => pr.user_id === p.id && pr.match_id !== 9999 && completedMatchIds.has(pr.match_id))
    const matchPreds = predictions.filter(pr => pr.user_id === p.id && pr.match_id !== 9999)

    // Recomputed from scratch
    let computedPts = 0
    let computedCR = 0
    let computedCS = 0
    // Track stored values
    let storedPts = 0
    let storedCR = 0
    let storedCS = 0

    for (const pred of matchPreds) {
      storedPts += pred.points_earned || 0
      if (pred.is_result_correct) storedCR++
      if (pred.is_score_correct) storedCS++
    }

    for (const pred of userPreds) {
      const match = matchMap.get(pred.match_id)
      if (!match) continue
      const s = scorePrediction(pred, match)
      computedPts += s.points_earned || 0
      if (s.is_result_correct) computedCR++
      if (s.is_score_correct) computedCS++
    }

    const name = p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : (p.first_name || p.username || 'Unknown')

    return {
      id: p.id,
      name,
      computedPts,
      storedPts,
      ptDiff: computedPts - storedPts,
      computedCR,
      storedCR,
      crDiff: computedCR - storedCR,
      computedCS,
      storedCS,
      csDiff: computedCS - storedCS,
      mp: userPreds.length,
      totalPreds: matchPreds.length,
    }
  })

  // Sort by computed points (desc), then computed CS (desc), then computed CR (desc)
  leaderboard.sort((a, b) => {
    if (b.computedPts !== a.computedPts) return b.computedPts - a.computedPts
    if (b.computedCS !== a.computedCS) return b.computedCS - a.computedCS
    if (b.computedCR !== a.computedCR) return b.computedCR - a.computedCR
    return a.name.localeCompare(b.name)
  })

  // Print header
  const header = ['Rank', 'Name', 'Computed', 'Stored', '±Pts', 'CR', 'CS', 'MP']
  const colWidths = [6, 22, 9, 8, 7, 6, 6, 5]

  function pad(str, width) {
    const s = String(str)
    return s.length >= width ? s : s + ' '.repeat(width - s.length)
  }

  const sep = '─'.repeat(colWidths.reduce((a, w) => a + w + 3, 1))

  console.log(`  ${header.map((h, i) => pad(h, colWidths[i])).join(' │ ')}`)
  console.log(`  ${sep}`)

  const top10 = leaderboard.slice(0, 10)
  for (let i = 0; i < top10.length; i++) {
    const r = top10[i]
    const row = [
      `#${i + 1}`,
      r.name.length > 21 ? r.name.slice(0, 19) + '…' : r.name,
      r.computedPts,
      r.storedPts,
      r.ptDiff === 0 ? ' 0' : (r.ptDiff > 0 ? `+${r.ptDiff}` : `${r.ptDiff}`),
      r.computedCR,
      r.computedCS,
      r.mp,
    ]
    const line = row.map((v, i) => pad(v, colWidths[i])).join(' │ ')
    const flag = r.ptDiff !== 0 || r.crDiff !== 0 || r.csDiff !== 0 ? '  ⚠️' : ''
    console.log(`  ${line}${flag}`)
  }

  // Summary stats
  console.log(`\n  Verification complete.`)
  console.log(`  Total users:        ${leaderboard.length}`)
  console.log(`  Predictions checked: ${totalChecked}`)
  console.log(`  Per-pred mismatches: ${totalMismatches}`)

  const usersWithDiff = leaderboard.filter(r => r.ptDiff !== 0 || r.crDiff !== 0 || r.csDiff !== 0)
  if (usersWithDiff.length > 0) {
    console.log(`\n  ⚠️ ${usersWithDiff.length} user(s) have mismatches between stored and recomputed totals:`)
    for (const u of usersWithDiff) {
      console.log(`     ${u.name}: pts diff=${u.ptDiff}, CR diff=${u.crDiff}, CS diff=${u.csDiff}`)
    }
  } else {
    console.log(`\n  ✅ All users: stored totals match recomputed values perfectly.`)
  }

  // ── Per-user per-prediction detailed report (optional) ───────────────────
  console.log('\n═══ USER PREDICTION BREAKDOWN (Top 10) ═══\n')

  for (let i = 0; i < top10.length; i++) {
    const u = top10[i]
    const userPreds = predictions
      .filter(pr => pr.user_id === u.id && pr.match_id !== 9999)
      .sort((a, b) => a.match_id - b.match_id)

    console.log(`  #${i + 1}: ${u.name} (total: ${u.computedPts} pts, ${u.computedCR} CR, ${u.computedCS} CS, ${u.totalPreds} preds)`)

    let lastStage = ''
    let printedAny = false
    for (const pred of userPreds) {
      const match = matchMap.get(pred.match_id)
      if (!match) continue
      if (match.result == null) continue

      if (match.stage !== lastStage) {
        lastStage = match.stage
        console.log(`    ── ${lastStage} ──`)
      }

      const s = scorePrediction(pred, match)
      const ptsStr = s.points_earned != null ? `+${s.points_earned}` : '—'
      const predResult = pred.predicted_result === 'teamA' ? match.team_a : pred.predicted_result === 'teamB' ? match.team_b : 'Draw'
      const actualResult = match.result === 'teamA' ? match.team_a : match.result === 'teamB' ? match.team_b : 'Draw'

      const storedPts = pred.points_earned != null ? pred.points_earned : '—'
      const ptsMatch = s.points_earned === pred.points_earned ? '' : ' ⚠️'
      const crMatch = s.is_result_correct === pred.is_result_correct ? '' : ' ⚠️'
      const csMatch = s.is_score_correct === pred.is_score_correct ? '' : ' ⚠️'

      console.log(
        `    M${String(match.id).padEnd(4)} ${match.team_a.padEnd(20)} ${String(match.score_a).padEnd(3)}-${String(match.score_b).padEnd(3)} ${match.team_b.padEnd(20)} │ ` +
        `Pred: ${predResult.padEnd(8)} ${pred.predicted_score_a}-${pred.predicted_score_b} │ ` +
        `Actual: ${actualResult.padEnd(8)} ${match.score_a}-${match.score_b} │ ` +
        `Stored: ${String(storedPts).padEnd(3)} pts${ptsMatch} Recomp: ${String(s.points_earned).padEnd(3)} pts  CR=${s.is_result_correct}${crMatch} CS=${s.is_score_correct}${csMatch}`
      )
      printedAny = true
    }

    if (!printedAny) {
      console.log(`    (no completed match predictions)`)
    }
    console.log()
  }

  console.log('═══ DONE ═══\n')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
