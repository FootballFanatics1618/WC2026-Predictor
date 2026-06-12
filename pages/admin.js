import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import GoldenBootPicker from '../components/GoldenBootPicker'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'
import { ALL_PLAYERS } from '../lib/data'
import { useDragScroll } from '../hooks/useDragScroll'
import { toIST } from '../lib/flags'
import { format, parseISO, formatDistanceToNow, isToday } from 'date-fns'

const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',').map(e => e.trim())
  : []
const STAGE_ORDER = ['Group Stage','Round of 32','Round of 16','Quarter-final','Semi-final','3rd Place Play-off','Final']

// Group teams — must match data.js
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
  return [...rows].sort((a,b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.goals_for - a.goals_against
    const gdB = b.goals_for - b.goals_against
    if (gdB !== gdA) return gdB - gdA
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
    return a.team.localeCompare(b.team)
  })
}

export default function Admin() {
  const router = useRouter()
  const [user, setUser]             = useState(null)
  const [isAdmin, setIsAdmin]       = useState(false)
  const [matches, setMatches]       = useState([])
  const [standings, setStandings]   = useState([])
  const [resultForm, setResultForm] = useState({})
  const [saving, setSaving]         = useState({})
  const [editingMatch, setEditingMatch] = useState(null)
  const [gbSearch, setGbSearch]     = useState('')
  const [gbPick, setGbPick]         = useState('')
  const [gbOpen, setGbOpen]         = useState(false)
  const [gbSaving, setGbSaving]     = useState(false)
  const [gbAwardedName, setGbAwardedName] = useState(null)
  const [message, setMessage]       = useState('')
  const [activeStage, setActiveStage] = useState('Group Stage')
  const [selectedDay, setSelectedDay] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [showStandings, setShowStandings] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [activeTab, setActiveTab]   = useState('results') // 'results' | 'sync' | 'gb'
  // Sync state
  const [syncing, setSyncing]       = useState(false)
  const [syncLog, setSyncLog]       = useState([])
  const [syncLogLoading, setSyncLogLoading] = useState(false)
  const [lastSync, setLastSync]     = useState(null)

  const dayPillRef = useRef(null)
  const dayScrollRef = useDragScroll()
  const scrollRestoreRef = useRef(null)

  function preserveScroll() {
    scrollRestoreRef.current = window.scrollY
  }

  useEffect(() => {
    if (scrollRestoreRef.current !== null) {
      const y = scrollRestoreRef.current
      scrollRestoreRef.current = null
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }))
    }
  })

  useEffect(() => { dayPillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }) }, [selectedDay])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)
    if (!ADMIN_EMAILS.includes(session.user.email)) { setLoading(false); return }
    setIsAdmin(true)
    await Promise.all([loadMatches(), loadStandings(), loadSyncLog(), loadGbStatus()])
    setLoading(false)
  }

  async function loadGbStatus() {
    const { data } = await supabase.from('profiles').select('golden_boot_pick').eq('golden_boot_correct', true).limit(1).maybeSingle()
    if (data?.golden_boot_pick) {
      setGbAwardedName(data.golden_boot_pick)
      setGbPick(data.golden_boot_pick)
      setGbSearch(data.golden_boot_pick)
    }
  }

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_date').order('match_time')
    setMatches(data || [])
  }

  async function loadStandings() {
    const { data } = await supabase.from('group_standings').select('*').order('group_name').order('points', { ascending: false })
    setStandings(data || [])
  }

  const loadSyncLog = useCallback(async () => {
    setSyncLogLoading(true)
    const { data } = await supabase
      .from('sync_log')
      .select('*')
      .order('ran_at', { ascending: false })
      .limit(20)
    setSyncLog(data || [])
    if (data?.[0]) setLastSync(data[0])
    setSyncLogLoading(false)
  }, [])

  // ── Manual "Sync Now" — calls the edge function directly ─────────────────
  async function triggerSync() {
    setSyncing(true)
    setMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-scores?source=manual`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      )
      const result = await res.json()
      if (!res.ok) {
        setMessage(`❌ Sync failed: ${result.message || result.error || `HTTP ${res.status}`}`)
      } else if (result.error) {
        setMessage(`❌ Sync failed: ${result.error}`)
      } else {
        setMessage(
          `✅ Sync complete — ${result.matchesUpdated} match(es) updated, ` +
          `${result.predictionsScored} predictions scored.` +
          (result.errors?.length ? ` ⚠️ ${result.errors.length} error(s).` : '')
        )
        await Promise.all([loadMatches(), loadStandings(), loadSyncLog()])
      }
    } catch (err) {
      setMessage(`❌ Sync error: ${err.message}`)
    }
    setSyncing(false)
  }

  function handleResultInput(matchId, field, value) {
    setResultForm(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: value } }))
  }

  // isEdit=true means we're correcting an already-saved result.
  // We pass the live match object (which still has the old result) so we can reverse standings.
  async function saveResult(match, isEdit = false) {
    const form = resultForm[match.id]
    if (!form?.result || form.scoreA === undefined || form.scoreB === undefined || form.scoreA === '' || form.scoreB === '') {
      alert('Fill in result, score A and score B.'); return
    }
    setSaving(s => ({ ...s, [match.id]: true }))
    const scoreA = parseInt(form.scoreA)
    const scoreB = parseInt(form.scoreB)
    const diff = scoreA - scoreB

    // Score-vs-result consistency check
    if (form.result === 'teamA' && diff <= 0) { alert("Score doesn't match Team A win"); setSaving(s=>({...s,[match.id]:false})); return }
    if (form.result === 'teamB' && diff >= 0) { alert("Score doesn't match Team B win"); setSaving(s=>({...s,[match.id]:false})); return }
    if (form.result === 'draw' && diff !== 0) { alert("Score doesn't match Draw"); setSaving(s=>({...s,[match.id]:false})); return }

    // ── 1. Save result to match row ──────────────────────────────────────────
    const { error: mErr } = await supabase.from('matches').update({
      result: form.result, score_a: scoreA, score_b: scoreB,
    }).eq('id', match.id)
    if (mErr) {
      alert(`❌ Could not save result.\n\n${mErr.message}\n\nCheck that admin-rls-fix.sql has been run in Supabase.`)
      setSaving(s=>({...s,[match.id]:false}))
      return
    }

    // ── 2. Re-score every prediction for this match ──────────────────────────
    const { data: preds } = await supabase.from('predictions').select('*').eq('match_id', match.id)
    let scoredCount = 0
    for (const pred of (preds || [])) {
      const rc = pred.predicted_result === form.result
      const sc = rc && pred.predicted_score_a === scoreA && pred.predicted_score_b === scoreB
      const { error: uErr } = await supabase.from('predictions').update({
        is_result_correct: rc, is_score_correct: sc, points_earned: sc ? 5 : rc ? 3 : 0,
      }).eq('id', pred.id)
      if (!uErr) scoredCount++
    }

    // ── 3. Update group standings ──────────────────────────────────────────────
    if (match.stage === 'Group Stage' && match.group_name) {
      if (isEdit && match.result !== null) {
        // Reverse the old result first, then apply the new one
        const sErr = await updateGroupStandings(
          match, form.result, scoreA, scoreB,
          match.result, match.score_a, match.score_b   // old values to reverse
        )
        if (sErr) console.error('Standings edit failed:', sErr)
      } else {
        const sErr = await updateGroupStandings(match, form.result, scoreA, scoreB)
        if (sErr) console.error('Standings update failed:', sErr)
      }
    }

    // ── 4. Knockout progression (only for new saves, not edits) ────────────────
    if (!isEdit && match.stage !== 'Group Stage') {
      await resolveKnockoutProgression(match, form.result)
    }

    // ── 5. After all 72 group games, propagate winners to R32 ───────────────
    if (!isEdit && match.stage === 'Group Stage') {
      const { data: freshMatches } = await supabase.from('matches').select('*').order('match_date').order('match_time')
      const groupDone = (freshMatches || []).filter(m => m.stage === 'Group Stage' && m.result !== null).length
      if (groupDone === 72) await propagateAllGroupWinners(freshMatches || [])
    }

    setMessage(`✅ ${match.team_a} ${scoreA}–${scoreB} ${match.team_b} ${isEdit ? 'updated' : 'saved'}! ${scoredCount}/${preds?.length || 0} predictions scored.`)
    await Promise.all([loadMatches(), loadStandings()])
    setSaving(s => ({ ...s, [match.id]: false }))
    setShowCompleted(true)
  }

  async function resetResult(match) {
    if (!confirm(`Reset result for ${match.team_a} vs ${match.team_b}?\n\nThis will clear the score and reset all predictions to null.`)) return
    setSaving(s => ({ ...s, [match.id]: true }))

    // 1. Clear match result
    const { error: mErr } = await supabase.from('matches').update({
      result: null, score_a: null, score_b: null,
    }).eq('id', match.id)
    if (mErr) {
      alert(`❌ Could not reset result.\n\n${mErr.message}`)
      setSaving(s => ({ ...s, [match.id]: false }))
      return
    }

    // 2. Reset all predictions for this match
    const { data: preds } = await supabase.from('predictions').select('*').eq('match_id', match.id)
    let resetCount = 0
    for (const pred of (preds || [])) {
      const { error: uErr } = await supabase.from('predictions').update({
        is_result_correct: null, is_score_correct: null, points_earned: null,
      }).eq('id', pred.id)
      if (!uErr) resetCount++
    }

    // 3. Reverse group standings (subtract old result only)
    if (match.stage === 'Group Stage' && match.group_name && match.result) {
      const g = match.group_name
      const tA = match.team_a, tB = match.team_b
      const r = match.result, sA = match.score_a, sB = match.score_b

      const { data: rows } = await supabase
        .from('group_standings')
        .select('team,played,won,drawn,lost,goals_for,goals_against,points')
        .eq('group_name', g).in('team', [tA, tB])

      const rowA = rows?.find(x => x.team === tA)
      const rowB = rows?.find(x => x.team === tB)

      if (rowA) {
        await supabase.from('group_standings').update({
          played: rowA.played - 1,
          goals_for: rowA.goals_for - sA,
          goals_against: rowA.goals_against - sB,
          won: rowA.won - (r === 'teamA' ? 1 : 0),
          drawn: rowA.drawn - (r === 'draw' ? 1 : 0),
          lost: rowA.lost - (r === 'teamB' ? 1 : 0),
          points: rowA.points - (r === 'teamA' ? 3 : r === 'draw' ? 1 : 0),
          updated_at: new Date().toISOString(),
        }).eq('group_name', g).eq('team', tA)
      }
      if (rowB) {
        await supabase.from('group_standings').update({
          played: rowB.played - 1,
          goals_for: rowB.goals_for - sB,
          goals_against: rowB.goals_against - sA,
          won: rowB.won - (r === 'teamB' ? 1 : 0),
          drawn: rowB.drawn - (r === 'draw' ? 1 : 0),
          lost: rowB.lost - (r === 'teamA' ? 1 : 0),
          points: rowB.points - (r === 'teamB' ? 3 : r === 'draw' ? 1 : 0),
          updated_at: new Date().toISOString(),
        }).eq('group_name', g).eq('team', tB)
      }
    }

    setMessage(`🔄 ${match.team_a} vs ${match.team_b} result reset. ${resetCount}/${preds?.length || 0} predictions cleared.`)
    await Promise.all([loadMatches(), loadStandings()])
    setSaving(s => ({ ...s, [match.id]: false }))
    setShowCompleted(true)
  }

  // oldResult/oldScoreA/oldScoreB: when editing, pass the previous values to reverse them first
  async function updateGroupStandings(match, result, scoreA, scoreB, oldResult = null, oldScoreA = null, oldScoreB = null) {
    const g = match.group_name
    const tA = match.team_a
    const tB = match.team_b

    const { data: rows, error: fetchErr } = await supabase
      .from('group_standings')
      .select('team,played,won,drawn,lost,goals_for,goals_against,points')
      .eq('group_name', g)
      .in('team', [tA, tB])
    if (fetchErr) return fetchErr.message

    let rowA = rows?.find(r => r.team === tA) || { played:0,won:0,drawn:0,lost:0,goals_for:0,goals_against:0,points:0 }
    let rowB = rows?.find(r => r.team === tB) || { played:0,won:0,drawn:0,lost:0,goals_for:0,goals_against:0,points:0 }

    // If editing, reverse the old result first so we don't double-count
    if (oldResult !== null && oldScoreA !== null && oldScoreB !== null) {
      rowA = { ...rowA,
        played: rowA.played - 1,
        goals_for: rowA.goals_for - oldScoreA,
        goals_against: rowA.goals_against - oldScoreB,
        won:   rowA.won   - (oldResult === 'teamA' ? 1 : 0),
        drawn: rowA.drawn - (oldResult === 'draw'  ? 1 : 0),
        lost:  rowA.lost  - (oldResult === 'teamB' ? 1 : 0),
        points: rowA.points - (oldResult === 'teamA' ? 3 : oldResult === 'draw' ? 1 : 0),
      }
      rowB = { ...rowB,
        played: rowB.played - 1,
        goals_for: rowB.goals_for - oldScoreB,
        goals_against: rowB.goals_against - oldScoreA,
        won:   rowB.won   - (oldResult === 'teamB' ? 1 : 0),
        drawn: rowB.drawn - (oldResult === 'draw'  ? 1 : 0),
        lost:  rowB.lost  - (oldResult === 'teamA' ? 1 : 0),
        points: rowB.points - (oldResult === 'teamB' ? 3 : oldResult === 'draw' ? 1 : 0),
      }
    }

    // Apply new result
    const newA = {
      played: rowA.played + 1,
      goals_for: rowA.goals_for + scoreA,
      goals_against: rowA.goals_against + scoreB,
      won: rowA.won + (result === 'teamA' ? 1 : 0),
      drawn: rowA.drawn + (result === 'draw' ? 1 : 0),
      lost: rowA.lost + (result === 'teamB' ? 1 : 0),
      points: rowA.points + (result === 'teamA' ? 3 : result === 'draw' ? 1 : 0),
    }
    const newB = {
      played: rowB.played + 1,
      goals_for: rowB.goals_for + scoreB,
      goals_against: rowB.goals_against + scoreA,
      won: rowB.won + (result === 'teamB' ? 1 : 0),
      drawn: rowB.drawn + (result === 'draw' ? 1 : 0),
      lost: rowB.lost + (result === 'teamA' ? 1 : 0),
      points: rowB.points + (result === 'teamB' ? 3 : result === 'draw' ? 1 : 0),
    }

    const { error: errA } = await supabase
      .from('group_standings')
      .update({ ...newA, updated_at: new Date().toISOString() })
      .eq('group_name', g).eq('team', tA)
    if (errA) return errA.message

    const { error: errB } = await supabase
      .from('group_standings')
      .update({ ...newB, updated_at: new Date().toISOString() })
      .eq('group_name', g).eq('team', tB)
    return errB ? errB.message : null
  }

  async function resolveKnockoutProgression(completedMatch, result) {
    const winner = result === 'teamA' ? completedMatch.team_a : completedMatch.team_b
    const loser  = result === 'teamA' ? completedMatch.team_b : completedMatch.team_a
    const id = completedMatch.id

    const { data: future } = await supabase.from('matches').select('*')
      .or(`team_a.ilike.%M${id}%,team_b.ilike.%M${id}%`)

    for (const fm of (future || [])) {
      const upd = {}
      if (fm.team_a && fm.team_a.includes(`M${id}`)) upd.team_a = fm.team_a.includes('Loser') ? loser : winner
      if (fm.team_b && fm.team_b.includes(`M${id}`)) upd.team_b = fm.team_b.includes('Loser') ? loser : winner
      if (Object.keys(upd).length > 0) await supabase.from('matches').update(upd).eq('id', fm.id)
    }
  }

  async function propagateAllGroupWinners(allMatches) {
    const groups = Object.keys(GROUP_TEAMS)
    const { data: standingRows } = await supabase.from('group_standings').select('*')

    const groupSorted = {}
    for (const g of groups) {
      const rows = (standingRows || []).filter(r => r.group_name === g)
      groupSorted[g] = sortStandings(rows)
    }

    const thirds = groups.map(g => {
      const t = groupSorted[g][2]
      if (!t) return null
      return { team: t.team, group: g, points: t.points, gd: t.goals_for - t.goals_against, gf: t.goals_for }
    }).filter(Boolean)

    thirds.sort((a,b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.gf !== a.gf) return b.gf - a.gf
      return a.group.localeCompare(b.group)
    })

    const slotMap = {}
    for (const g of groups) {
      slotMap[`Winner ${g}`] = groupSorted[g][0]?.team
      slotMap[`Runner-up ${g}`] = groupSorted[g][1]?.team
    }

    const best3rds = [...thirds]

    const r32 = allMatches.filter(m => m.stage === 'Round of 32' && m.result === null)
    for (const m of r32) {
      const upd = {}
      const newA = resolveGroupSlot(m.team_a, slotMap, best3rds)
      const newB = resolveGroupSlot(m.team_b, slotMap, best3rds)
      if (newA) upd.team_a = newA
      if (newB) upd.team_b = newB
      if (Object.keys(upd).length > 0) await supabase.from('matches').update(upd).eq('id', m.id)
    }
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

  async function awardGoldenBoot() {
    if (!gbPick.trim()) { alert('Search and select a player first.'); return }
    setGbSaving(true)
    const { data: count, error } = await supabase.rpc('award_golden_boot', { p_player: gbPick.trim() })
    if (error) { alert(`❌ Award failed: ${error.message}`); setGbSaving(false); return }
    setGbAwardedName(gbPick.trim())
    setMessage(`🥇 Golden Boot: ${gbPick}! ${count || 0} players get +10 pts.`)
    setGbSaving(false)
  }

  async function resetGoldenBoot() {
    if (!confirm('Reset Golden Boot award? All users will lose their +10 bonus.')) return
    setGbSaving(true)
    const { error } = await supabase.rpc('reset_golden_boot')
    if (error) { alert(`❌ Reset failed: ${error.message}`); setGbSaving(false); return }
    setGbAwardedName(null)
    setGbPick('')
    setGbSearch('')
    setMessage('🔄 Golden Boot award has been reset.')
    setGbSaving(false)
  }

  if (loading) return <><Navbar user={user}/><div className="page" style={{textAlign:'center',paddingTop:'5rem',color:'var(--gray-500)'}}>Loading...</div></>
  if (!isAdmin) return <><Navbar user={user}/><div className="page" style={{textAlign:'center',paddingTop:'5rem',color:'var(--gray-500)'}}>⛔ No admin access.</div></>

  // ── Derived data ──────────────────────────────────────────────────────────
  const stageMatches = matches.filter(m => m.stage === activeStage)
  const totalDone = matches.filter(m => m.result !== null).length

  // Build a sorted list of unique dates within the current stage
  const stageDates = [...new Set(stageMatches.map(m => m.match_date))].sort()

  // Auto-select the first date in this stage when the stage changes
  const activeDayDate = selectedDay && stageDates.includes(selectedDay)
    ? selectedDay
    : stageDates[0] || null

  // Matches on the selected day
  const dayMatches = stageMatches.filter(m => m.match_date === activeDayDate)
  const pendingOnDay = dayMatches.filter(m => m.result === null)
  const completedOnDay = dayMatches.filter(m => m.result !== null)

  // Pending count across the whole stage (for badge on stage tab)
  const pendingInStage = stageMatches.filter(m => m.result === null)

  // Group standings
  const groups = Object.keys(GROUP_TEAMS)
  const standingsByGroup = {}
  groups.forEach(g => {
    standingsByGroup[g] = sortStandings(standings.filter(s => s.group_name === g))
  })

  function dayLabel(dateStr) {
    const d = parseISO(dateStr)
    const todayFlag = isToday(d)
    return (todayFlag ? '📅 Today · ' : '') + format(d, 'EEE, MMM d')
  }

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">ADMIN PANEL</h1>
        <p style={{color:'var(--gray-500)',marginBottom:'1rem',fontSize:'0.9rem'}}>
          {totalDone}/104 matches completed. Entering a result immediately scores all predictions and updates standings.
        </p>

        {message && (
          <div className="alert alert-success" style={{marginBottom:'1.5rem'}}>
            {message}
            <button onClick={()=>setMessage('')} style={{marginLeft:'1rem',background:'none',border:'none',color:'inherit',cursor:'pointer'}}>×</button>
          </div>
        )}

        {/* Top-level tabs */}
        <div className="tabs" style={{marginBottom:'1.5rem'}}>
          <button className={`tab-btn ${activeTab==='results'?'active':''}`} onClick={() => { preserveScroll(); setActiveTab('results') }}>
            Match Results
          </button>
          <button className={`tab-btn ${activeTab==='sync'?'active':''}`} onClick={() => { preserveScroll(); setActiveTab('sync'); loadSyncLog() }}>
            Auto-Sync
          </button>
          <button className={`tab-btn ${activeTab==='gb'?'active':''}`} onClick={() => { preserveScroll(); setActiveTab('gb') }}>
            Golden Boot
          </button>
        </div>

        {/* ── SYNC TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'sync' && (
          <div>
            <div className="card-gold" style={{marginBottom:'1.5rem'}}>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',color:'var(--gold)',marginBottom:'0.5rem'}}>
                🔄 SCORE SYNC
              </h2>
              <p style={{fontSize:'0.85rem',color:'var(--gray-400)',marginBottom:'1rem',lineHeight:'1.6'}}>
                The sync function runs automatically via pg_cron at 8 scheduled times per day —
                timed to fire ~30 min after each match window ends. No constant polling.
                Use <strong style={{color:'var(--white)'}}>Sync Now</strong> to trigger manually if a result seems delayed.
              </p>

              {/* Schedule display */}
              <div style={{background:'rgba(0,0,0,0.2)',borderRadius:'var(--radius)',padding:'0.875rem 1rem',marginBottom:'1.25rem',fontSize:'0.8rem',color:'var(--gray-400)',lineHeight:'1.8'}}>
                <div style={{color:'var(--gold)',fontWeight:700,marginBottom:'0.4rem',fontSize:'0.75rem',letterSpacing:'0.06em'}}>CRON SCHEDULE (UTC)</div>
                <div>18:30 · 18:50 — after 12:00 ET kick-offs</div>
                <div>21:30 · 21:50 — after 15:00 ET kick-offs</div>
                <div>00:30 · 00:50 — after 18:00 ET kick-offs</div>
                <div>03:30 · 03:50 — after 21:00 ET kick-offs</div>
                <div style={{marginTop:'0.4rem',color:'var(--gray-500)'}}>+ safety catchall every 3 hours</div>
              </div>

              <div style={{display:'flex',gap:'0.75rem',alignItems:'center',flexWrap:'wrap'}}>
                <button
                  className="btn btn-primary"
                  onClick={triggerSync}
                  disabled={syncing}
                  style={{minWidth:'140px'}}
                >
                  {syncing ? '⟳ Syncing...' : '🔄 Sync Now'}
                </button>
                <button
                  className="btn"
                  onClick={loadSyncLog}
                  disabled={syncLogLoading}
                  style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',color:'var(--gray-300)'}}
                >
                  {syncLogLoading ? 'Loading...' : 'Refresh Log'}
                </button>
                {lastSync && (
                  <span style={{fontSize:'0.8rem',color:'var(--gray-500)'}}>
                    Last run: {format(new Date(lastSync.ran_at), 'MMM d, HH:mm')} UTC
                    · source: <strong style={{color:'var(--gray-300)'}}>{lastSync.source}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Sync log table */}
            <h3 style={{fontFamily:'var(--font-display)',fontSize:'1.1rem',marginBottom:'0.75rem',color:'var(--white)'}}>
              RECENT SYNC RUNS
            </h3>
            {syncLog.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'2rem',color:'var(--gray-500)'}}>
                No sync runs yet. Cron will start once deployed.
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
                {/* Header */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 60px 60px 60px 80px',gap:'0.5rem',padding:'0.4rem 1rem',fontSize:'0.72rem',color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                  <span>Time</span><span>Checked</span><span>Updated</span><span>Source</span><span>Status</span>
                </div>
                {syncLog.map(row => (
                  <div key={row.id} className="card" style={{padding:'0.6rem 1rem',display:'grid',gridTemplateColumns:'1fr 60px 60px 60px 80px',gap:'0.5rem',alignItems:'center'}}>
                    <span style={{fontSize:'0.82rem',color:'var(--gray-300)'}}>
                      {format(new Date(row.ran_at), 'MMM d, HH:mm')}
                      <span style={{color:'var(--gray-500)',fontSize:'0.75rem'}}> · {formatDistanceToNow(new Date(row.ran_at), { addSuffix: true })}</span>
                    </span>
                    <span style={{fontSize:'0.82rem',textAlign:'center',color:'var(--gray-400)'}}>{row.matches_checked}</span>
                    <span style={{fontSize:'0.82rem',textAlign:'center',color: row.matches_updated > 0 ? 'var(--success)' : 'var(--gray-500)',fontWeight: row.matches_updated > 0 ? 700 : 400}}>
                      {row.matches_updated > 0 ? `+${row.matches_updated}` : '—'}
                    </span>
                    <span style={{fontSize:'0.75rem',color:'var(--gray-500)'}}>{row.source}</span>
                    <span style={{fontSize:'0.75rem'}}>
                      {row.errors
                        ? <span style={{color:'var(--danger)'}}>⚠ Error</span>
                        : <span style={{color:'var(--success)'}}>✓ OK</span>
                      }
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── GOLDEN BOOT TAB ───────────────────────────────────────────── */}
        {activeTab === 'gb' && (
          <div className="card-gold">
            <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',color:'var(--gold)',marginBottom:'0.5rem'}}>🥇 AWARD GOLDEN BOOT</h2>
            <p style={{fontSize:'0.82rem',color:'var(--gray-500)',marginBottom:'0.9rem'}}>End of tournament only. Users who picked this player get +10 pts.</p>

            {gbAwardedName ? (
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap'}}>
                <div style={{fontSize:'0.95rem',color:'var(--white)'}}>
                  Awarded to: <strong style={{color:'var(--gold)'}}>{gbAwardedName}</strong>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={gbSaving}
                  onClick={resetGoldenBoot}
                  style={{fontSize:'0.78rem',padding:'0.3rem 0.7rem',color:'var(--danger,#e74c3c)'}}
                >
                  {gbSaving ? '...' : '🔄 Reset'}
                </button>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                <div style={{position:'relative'}}>
                  <label className="form-label">Search Golden Boot Winner</label>
                  <div style={{position:'relative'}}>
                    <input
                      className="form-input"
                      placeholder="Type player name to search..."
                      value={gbSearch}
                      onChange={e => { setGbSearch(e.target.value); setGbPick(''); setGbOpen(true) }}
                      onFocus={() => setGbOpen(true)}
                      onBlur={() => setTimeout(() => setGbOpen(false), 200)}
                      style={{paddingRight: gbPick ? '2.2rem' : '0.9rem'}}
                    />
                    {gbPick && <span style={{position:'absolute',right:'0.7rem',top:'50%',transform:'translateY(-50%)',color:'#68d391',fontSize:'1rem'}}>✓</span>}
                  </div>
                  {gbPick && (
                    <div style={{fontSize:'0.78rem',color:'#68d391',marginTop:'0.3rem'}}>Selected: <strong>{gbPick}</strong></div>
                  )}
                  {/* Dropdown portal — z-index 500 ensures it floats above everything */}
                  {gbOpen && (() => {
                    const players = [...ALL_PLAYERS].sort().filter(p => !gbSearch || p.toLowerCase().includes(gbSearch.toLowerCase()))
                    return players.length > 0 ? (
                      <div style={{
                        position:'absolute',top:'calc(100% + 4px)',left:0,right:0,
                        background:'var(--gray-900)',border:'1px solid rgba(245,200,66,0.35)',
                        borderRadius:'var(--radius)',maxHeight:'260px',overflowY:'auto',
                        zIndex:500,boxShadow:'0 12px 40px rgba(0,0,0,0.7)'
                      }}>
                        {players.slice(0,80).map(p => (
                          <div
                            key={p}
                            onMouseDown={e => { e.preventDefault(); setGbPick(p); setGbSearch(p); setGbOpen(false) }}
                            style={{
                              padding:'0.5rem 0.9rem',cursor:'pointer',fontSize:'0.875rem',
                              color: gbPick===p ? 'var(--gold)' : 'var(--white)',
                              background: gbPick===p ? 'rgba(245,200,66,0.1)' : 'transparent',
                              borderBottom:'1px solid rgba(255,255,255,0.04)',
                              display:'flex',justifyContent:'space-between',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
                            onMouseLeave={e => e.currentTarget.style.background = gbPick===p ? 'rgba(245,200,66,0.1)' : 'transparent'}
                          >
                            {p} {gbPick===p && <span style={{color:'var(--gold)'}}>✓</span>}
                          </div>
                        ))}
                        {players.length > 80 && (
                          <div style={{padding:'0.4rem 0.9rem',fontSize:'0.78rem',color:'var(--gray-500)',textAlign:'center'}}>
                            Type more to narrow… ({players.length} results)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--gray-900)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--radius)',padding:'0.6rem 0.9rem',fontSize:'0.85rem',color:'var(--gray-500)',zIndex:500}}>
                        No players found for "{gbSearch}"
                      </div>
                    )
                  })()}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={awardGoldenBoot}
                  disabled={gbSaving || !gbPick}
                  style={{alignSelf:'flex-start'}}
                >
                  {gbSaving ? 'Awarding…' : '🥇 Award +10 pts'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── RESULTS TAB ───────────────────────────────────────────────── */}
        {activeTab === 'results' && (
          <>
            {/* ── Stage dropdown ──────────────────────────────────────────────── */}
            <div style={{marginBottom:'1.5rem'}}>
              <select
                className="form-select"
                value={activeStage}
                onMouseDown={preserveScroll}
                onChange={(e)=>{ setActiveStage(e.target.value); setSelectedDay(null); setShowCompleted(false) }}
                style={{fontSize:'0.85rem'}}
              >
                {STAGE_ORDER.map(s => {
                  const cnt = matches.filter(m=>m.stage===s&&m.result===null).length
                  return <option key={s} value={s}>{s}{cnt > 0 ? ` (${cnt} pending)` : ''}</option>
                })}
              </select>
            </div>

            {/* ── Day pills ─────────────────────────────────────────────────── */}
            {stageDates.length > 0 && (
              <div style={{marginBottom:'1.5rem'}}>
                <div ref={dayScrollRef} className="scroll-row">
                  {stageDates.map(dateStr => {
                    const pendingCount = stageMatches.filter(m => m.match_date===dateStr && m.result===null).length
                    const allDone = pendingCount === 0
                    const isActive = activeDayDate === dateStr
                    return (
                      <button
                        key={dateStr}
                        ref={isActive ? dayPillRef : null}
                        onClick={()=>{ preserveScroll(); setSelectedDay(dateStr); setShowCompleted(false) }}
                        style={{
                          padding:'0.4rem 0.85rem',
                          borderRadius:'99px',
                          border: isActive ? '1.5px solid var(--gold)' : '1px solid rgba(255,255,255,0.12)',
                          background: isActive ? 'rgba(245,200,66,0.12)' : 'transparent',
                          color: isActive ? 'var(--gold)' : 'var(--gray-300)',
                          fontSize:'0.82rem',
                          fontWeight: isActive ? 700 : 400,
                          cursor:'pointer',
                          whiteSpace:'nowrap',
                          display:'flex',
                          alignItems:'center',
                          gap:'5px',
                        }}
                      >
                        {format(parseISO(dateStr),'EEE, MMM d')}
                        {allDone
                          ? <span style={{fontSize:'0.85rem',color:'var(--success)'}}>✅</span>
                          : <span style={{fontSize:'0.7rem',borderRadius:'99px',padding:'1px 6px',background:'rgba(255,255,255,0.08)',color:'var(--gray-500)'}}>{pendingCount}</span>
                        }
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Selected day header ───────────────────────────────────────── */}
            {activeDayDate && (
              <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.1rem',marginBottom:'1rem',color:'var(--white)'}}>
                {dayLabel(activeDayDate)}
                <span style={{fontWeight:400,color:'var(--gray-500)',fontSize:'0.85rem',marginLeft:'0.6rem'}}>
                  · {pendingOnDay.length} pending · {completedOnDay.length} done
                </span>
              </h2>
            )}

            {/* ── Pending matches on selected day ───────────────────────────── */}
            {pendingOnDay.length === 0 && completedOnDay.length === 0 && (
              <div className="card" style={{textAlign:'center',padding:'1.5rem',color:'var(--gray-500)'}}>
                No matches scheduled for this stage yet.
              </div>
            )}

            {pendingOnDay.length === 0 && completedOnDay.length > 0 && (
              <div className="card" style={{textAlign:'center',padding:'1rem 1.5rem',color:'#68d391',marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}}>
                <span style={{fontSize:'1.2rem'}}>✅</span>
                All matches on this day are complete!
              </div>
            )}

            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',marginBottom:'1.5rem'}}>
              {pendingOnDay.map(match => {
                const form = resultForm[match.id] || {}
                const isKnockout = match.stage !== 'Group Stage'
                const bothKnown = !['Winner','Runner','Best','Loser'].some(w => (match.team_a||'').includes(w) || (match.team_b||'').includes(w))
                return (
                  <div key={match.id} className="card" style={{padding:'1rem 1.25rem',opacity: isKnockout && !bothKnown ? 0.55 : 1,border:'1px solid var(--gray-700)'}}>
                    {/* Match info row */}
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'0.5rem',flexWrap:'wrap',marginBottom:'0.75rem'}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'0.2rem',display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
                          <span style={{display:'inline-flex',alignItems:'center',gap:'6px'}}><FlagImg team={match.team_a} size={20} />{match.team_a}</span>
                          <span style={{color:'var(--gray-500)',fontWeight:400}}>vs</span>
                          <span style={{display:'inline-flex',alignItems:'center',gap:'6px'}}><FlagImg team={match.team_b} size={20} />{match.team_b}</span>
                        </div>
                        <div style={{fontSize:'0.75rem',color:'var(--gray-500)'}}>
                          {toIST(match.match_time)}
                          {match.group_name ? ` · Group ${match.group_name}` : ''}
                          {isKnockout && !bothKnown && (
                            <span style={{color:'var(--gold)',marginLeft:'0.5rem'}}>⏳ Awaiting group results</span>
                          )}
                        </div>
                      </div>
                      <span style={{fontSize:'0.72rem',background:'var(--gray-800)',color:'var(--gray-400)',borderRadius:'4px',padding:'0.15rem 0.4rem',border:'1px solid var(--gray-700)',whiteSpace:'nowrap'}}>
                        {match.stage}
                      </span>
                    </div>

                    {/* Score entry */}
                    {bothKnown && (
                      <div style={{display:'flex',alignItems:'center',gap:'0.6rem',flexWrap:'wrap'}}>
                        <select
                          className="form-select"
                          style={{flex:'1 1 160px',minWidth:'140px'}}
                          value={form.result||''}
                          onMouseDown={preserveScroll}
                          onChange={e=>handleResultInput(match.id,'result',e.target.value)}
                        >
                          <option value="">— Result —</option>
                          <option value="teamA">{match.team_a} Win</option>
                          {match.stage === 'Group Stage' && <option value="draw">Draw</option>}
                          <option value="teamB">{match.team_b} Win</option>
                        </select>

                        <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                          <input
                            className="form-input"
                            style={{width:'64px',textAlign:'center'}}
                            type="number" min="0"
                            placeholder="A"
                            value={form.scoreA??''}
                            onChange={e=>handleResultInput(match.id,'scoreA',e.target.value)}
                          />
                          <span style={{color:'var(--gray-500)',fontWeight:700}}>–</span>
                          <input
                            className="form-input"
                            style={{width:'64px',textAlign:'center'}}
                            type="number" min="0"
                            placeholder="B"
                            value={form.scoreB??''}
                            onChange={e=>handleResultInput(match.id,'scoreB',e.target.value)}
                          />
                        </div>

                        <button
                          className="btn btn-primary btn-sm"
                          onClick={()=>saveResult(match)}
                          disabled={saving[match.id]}
                          style={{minWidth:'70px'}}
                        >
                          {saving[match.id] ? '...' : '✓ Save'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Completed matches on selected day (collapsible) ───────────── */}
            {completedOnDay.length > 0 && (
              <div style={{marginBottom:'2rem'}}>
                <button
                  onClick={()=>{ preserveScroll(); setShowCompleted(s=>!s) }}
                  style={{
                    display:'flex',alignItems:'center',gap:'0.5rem',
                    background:'none',border:'none',cursor:'pointer',
                    color:'var(--gray-400)',fontSize:'0.85rem',
                    marginBottom:'0.5rem',padding:0,
                  }}
                >
                  <span style={{
                    display:'inline-block',
                    transform: showCompleted ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition:'transform 0.2s',
                    fontSize:'0.7rem',
                  }}>▶</span>
                  <span style={{fontFamily:'var(--font-display)',letterSpacing:'0.05em'}}>
                    COMPLETED ({completedOnDay.length})
                  </span>
                </button>

                {showCompleted && (
                  <div style={{display:'flex',flexDirection:'column',gap:'0.35rem'}}>
                    {completedOnDay.map(m => {
                      const isEditing = editingMatch?.id === m.id
                      const eform = resultForm[m.id] || {}
                      return (
                        <div
                          key={m.id}
                          className="card"
                          style={{
                            padding:'0.7rem 1.1rem',
                            border: isEditing ? '1px solid var(--gold)' : '1px solid var(--gray-800)',
                            background: isEditing ? 'rgba(245,200,66,0.05)' : undefined,
                          }}
                        >
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem',marginBottom: isEditing ? '0.75rem' : 0}}>
                            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                              <span style={{display:'inline-flex',alignItems:'center',gap:'4px',fontSize:'0.88rem',fontWeight:500}}><FlagImg team={m.team_a} size={18} />{m.team_a}</span>
                              <span style={{color:'var(--gray-500)',fontSize:'0.8rem'}}>vs</span>
                              <span style={{display:'inline-flex',alignItems:'center',gap:'4px',fontSize:'0.88rem',fontWeight:500}}><FlagImg team={m.team_b} size={18} />{m.team_b}</span>
                              <span style={{fontSize:'0.73rem',color:'var(--gray-500)',marginLeft:'0.5rem'}}>{toIST(m.match_time)}</span>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                              <span className="match-result-badge">{m.score_a}–{m.score_b}</span>
                              {!isEditing && (
                                <>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => {
                                      setEditingMatch(m)
                                      setResultForm(prev => ({
                                        ...prev,
                                        [m.id]: {
                                          result: m.result,
                                          scoreA: String(m.score_a),
                                          scoreB: String(m.score_b),
                                        }
                                      }))
                                      setShowCompleted(true)
                                    }}
                                    style={{fontSize:'0.72rem',padding:'0.2rem 0.5rem'}}
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    disabled={saving[m.id]}
                                    onClick={() => resetResult(m)}
                                    style={{fontSize:'0.72rem',padding:'0.2rem 0.5rem',color:'var(--danger,#e74c3c)'}}
                                  >
                                    {saving[m.id] ? '...' : '🔄 Reset'}
                                  </button>
                                </>
                              )}
                              {isEditing && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setEditingMatch(null)}
                                  style={{fontSize:'0.72rem',padding:'0.2rem 0.5rem',color:'var(--gray-500)'}}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inline edit form */}
                          {isEditing && (
                            <div style={{display:'flex',alignItems:'center',gap:'0.6rem',flexWrap:'wrap'}}>
                              <select
                                className="form-select"
                                style={{flex:'1 1 160px',minWidth:'140px'}}
                                value={eform.result||''}
                                onMouseDown={preserveScroll}
                                onChange={e=>handleResultInput(m.id,'result',e.target.value)}
                              >
                                <option value="">— Result —</option>
                                <option value="teamA">{m.team_a} Win</option>
                                {m.stage==='Group Stage' && <option value="draw">Draw</option>}
                                <option value="teamB">{m.team_b} Win</option>
                              </select>
                              <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                                <input
                                  className="form-input"
                                  style={{width:'60px',textAlign:'center'}}
                                  type="number" min="0"
                                  placeholder="A"
                                  value={eform.scoreA??''}
                                  onChange={e=>handleResultInput(m.id,'scoreA',e.target.value)}
                                />
                                <span style={{color:'var(--gray-500)',fontWeight:700}}>–</span>
                                <input
                                  className="form-input"
                                  style={{width:'60px',textAlign:'center'}}
                                  type="number" min="0"
                                  placeholder="B"
                                  value={eform.scoreB??''}
                                  onChange={e=>handleResultInput(m.id,'scoreB',e.target.value)}
                                />
                              </div>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{minWidth:'80px'}}
                                disabled={saving[m.id]}
                                onClick={async () => {
                                  await saveResult(m, true)
                                  setEditingMatch(null)
                                }}
                              >
                                {saving[m.id] ? '...' : '✓ Update'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Group Standings (Group Stage only) ────────────────────────── */}
            {activeStage === 'Group Stage' && (
              <>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:'0.5rem'}}>
                  <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',color:'var(--white)'}}>GROUP STANDINGS</h2>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{ preserveScroll(); setShowStandings(s=>!s) }}>
                    {showStandings ? 'Hide' : 'Show'} Standings
                  </button>
                </div>
                {showStandings && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'1rem',marginBottom:'2rem'}}>
                    {groups.map(g => (
                      <div key={g} className="card" style={{padding:'1rem'}}>
                        <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',color:'var(--gold)',marginBottom:'0.6rem',letterSpacing:'0.05em'}}>GROUP {g}</div>
                        <table style={{width:'100%',fontSize:'0.78rem'}}>
                          <thead>
                            <tr>
                              <th style={{textAlign:'left',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>Team</th>
                              <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>P</th>
                              <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>W</th>
                              <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>D</th>
                              <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>L</th>
                              <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>GD</th>
                              <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gold)',fontWeight:700}}>Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(standingsByGroup[g] || []).map((row, i) => (
                              <tr key={row.team}>
                                <td style={{color: i < 2 ? 'var(--white)' : i === 2 ? '#f6ad55' : 'var(--gray-500)', fontWeight: i < 2 ? 600 : 400, paddingTop:'3px'}}>
                                  {i===0?'🥇':i===1?'🥈':i===2?'🟡':''} {row.team}
                                </td>
                                <td style={{textAlign:'center',color:'var(--gray-500)'}}>{row.played}</td>
                                <td style={{textAlign:'center'}}>{row.won}</td>
                                <td style={{textAlign:'center'}}>{row.drawn}</td>
                                <td style={{textAlign:'center'}}>{row.lost}</td>
                                <td style={{textAlign:'center',color: (row.goals_for-row.goals_against)>0?'#68d391':(row.goals_for-row.goals_against)<0?'#fc8181':'var(--gray-300)'}}>
                                  {row.goals_for-row.goals_against>0?'+':''}{row.goals_for-row.goals_against}
                                </td>
                                <td style={{textAlign:'center',fontWeight:700,color:'var(--gold)'}}>{row.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
