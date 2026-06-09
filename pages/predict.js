import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'
import { generateScorelines, TOURNAMENT_START } from '../lib/data'
import { toISTFull, matchISTDate, todayIST } from '../lib/flags'
import { isMatchPredictionLocked, timeUntilLock } from '../lib/locktime'
import { useDragScroll } from '../hooks/useDragScroll'
import { format, parseISO } from 'date-fns'

function isMatchCompleted(match) { return match.result !== null }

function isPredLocked(match) {
  if (isMatchCompleted(match)) return true
  return isMatchPredictionLocked(match.match_date, match.match_time, match.kickoff_utc)
}

function getResultLabel(result, teamA, teamB) {
  if (result === 'teamA') return `${teamA} Win`
  if (result === 'teamB') return `${teamB} Win`
  if (result === 'draw') return 'Draw'
  return ''
}

function MatchCard({ match, saved, localPred, isEditing, isSaving, onResultChange, onScorelineChange, onSave, onEdit }) {
  const completed = isMatchCompleted(match)
  const predLocked = isPredLocked(match)
  const pred = localPred || (saved ? { result: saved.predicted_result, scoreA: saved.predicted_score_a, scoreB: saved.predicted_score_b } : null)
  const scorelines = pred?.result ? generateScorelines(pred.result) : []
  const currentScoreline = pred?.scoreA !== undefined && pred?.scoreB !== undefined ? `${pred.scoreA}-${pred.scoreB}` : ''
  const isCorrectResult = completed && saved && saved.is_result_correct
  const isCorrectScore = completed && saved && saved.is_score_correct
  const lockCountdown = !predLocked ? timeUntilLock(match.match_date, match.match_time, match.kickoff_utc) : null
  const hasPrediction = !!saved
  const isLocked = predLocked || completed
  const dropdownsDisabled = isLocked || (hasPrediction && !isEditing)

  return (
    <div className={`match-card ${completed ? 'completed' : ''} ${hasPrediction && !completed ? 'predicted' : ''}`}
      style={{ width: '100%', boxSizing: 'border-box' }}>

      {/* Top bar: stage/time + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {match.stage}{match.group_name ? ` · Group ${match.group_name}` : ''}
          </span>
          <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: '0.1rem', lineHeight: 1.4 }}>
            {(() => {
              const { time: istTime, dayOffset } = toISTFull(match.match_time)
              const baseDate = parseISO(match.match_date)
              const istDate = dayOffset ? new Date(baseDate.getTime() + 86400000) : baseDate
              return `${format(istDate, 'EEE, MMM d')} · ${istTime}`
            })()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>{match.venue}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {hasPrediction && !completed && (
            <span style={{ fontSize: '1rem', color: 'var(--success)', lineHeight: 1 }} title="Prediction saved">✅</span>
          )}
          {completed && (
            <>
              {isCorrectScore && <span className="points-chip points-5">+5 ⚡</span>}
              {isCorrectResult && !isCorrectScore && <span className="points-chip points-3">+3 ✓</span>}
              {!isCorrectResult && saved && <span className="points-chip points-0">0</span>}
            </>
          )}
          {predLocked && !completed && <span className="lock-chip">🔒 Locked</span>}
          {lockCountdown && <span style={{ fontSize: '0.72rem', color: '#f6ad55', background: 'rgba(246,173,85,0.12)', padding: '2px 7px', borderRadius: '99px' }}>{lockCountdown}</span>}
        </div>
      </div>

      {/* Teams — large, centered */}
      <div className="match-teams">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
          <span style={{ textAlign: 'right' }}>{match.team_a}</span>
          <FlagImg team={match.team_a} size={26} />
        </span>
        <span className="match-vs" style={{ flexShrink: 0 }}>vs</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-start' }}>
          <FlagImg team={match.team_b} size={26} />
          <span>{match.team_b}</span>
        </span>
      </div>

      {/* Completed result */}
      {completed && (
        <div style={{ textAlign: 'center', marginBottom: '0.6rem' }}>
          <span className="match-result-badge" style={{ fontSize: '1rem', padding: '0.3rem 1rem' }}>
            FT {match.score_a} – {match.score_b}
          </span>
          {match.won_on_penalties && (
            <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: 600 }}>
              Won on penalties
            </div>
          )}
          {saved && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
              Your pick: {getResultLabel(saved.predicted_result, match.team_a, match.team_b)} {saved.predicted_score_a}–{saved.predicted_score_b}
            </div>
          )}
        </div>
      )}

      {/* Prediction inputs — stacked on mobile */}
      {!isLocked && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <div style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label className="form-label">Result</label>
            <select className="form-select" value={pred?.result || ''} onChange={e => onResultChange(match.id, e.target.value)} disabled={dropdownsDisabled}>
              <option value="">— Pick result —</option>
              <option value="teamA">{match.team_a} Win</option>
              {match.stage === 'Group Stage' && <option value="draw">Draw</option>}
              <option value="teamB">{match.team_b} Win</option>
            </select>
          </div>
          <div style={{ flex: '1 1 110px', minWidth: 0 }}>
            <label className="form-label">Scoreline</label>
            <select className="form-select" value={currentScoreline} onChange={e => onScorelineChange(match.id, e.target.value)} disabled={dropdownsDisabled || !pred?.result}>
              <option value="">— Score —</option>
              {scorelines.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {hasPrediction && !isEditing ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onEdit(match.id, saved)}
              style={{ whiteSpace: 'nowrap', flexShrink: 0, marginBottom: '2px', borderColor: 'rgba(245,200,66,0.45)', color: 'var(--gold)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              Edit
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={onSave}
              disabled={isSaving}
              style={{ whiteSpace: 'nowrap', flexShrink: 0, marginBottom: '2px' }}
            >
              {isSaving ? '...' : 'Save'}
            </button>
          )}
        </div>
      )}

      {/* Locked with a saved prediction */}
      {predLocked && !completed && saved && (
        <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '0.4rem' }}>
          Your pick: <strong style={{ color: 'var(--white)' }}>
            {getResultLabel(saved.predicted_result, match.team_a, match.team_b)} — {saved.predicted_score_a}–{saved.predicted_score_b}
          </strong>
        </div>
      )}
      {predLocked && !completed && !saved && (
        <div style={{ fontSize: '0.85rem', color: 'var(--danger)', marginTop: '0.4rem' }}>❌ No prediction — window closed</div>
      )}
    </div>
  )
}

export default function Predict() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [savedPredictions, setSavedPredictions] = useState({})
  const [saving, setSaving] = useState({})
  const [editing, setEditing] = useState({})
  const [tab, setTab] = useState('today')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedUpcomingDate, setSelectedUpcomingDate] = useState(null)
  const [now, setNow] = useState(new Date())
  const upcomingDateRef = useRef(null)
  const upcomingScrollRef = useDragScroll()
  const userRef = useRef(null)

  useEffect(() => { upcomingDateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }) }, [selectedUpcomingDate])

  // Tick every minute to re-evaluate locks
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // Real-time subscription: when admin saves a result, update the match immediately
  // so the prediction form locks without requiring a page refresh
  useEffect(() => {
    const channel = supabase
      .channel('matches-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          const updated = payload.new
          setMatches(prev =>
            prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m))
          )
          // Re-fetch predictions so points chips update after admin scores
          if (userRef.current) {
            supabase.from('predictions').select('*').eq('user_id', userRef.current.id).then(({ data }) => {
              const map = {}
              ;(data || []).forEach(p => { map[p.match_id] = p })
              setSavedPredictions(map)
            })
          }
        }
      )
      .subscribe()

    // Fallback poll every 30 seconds in case real-time is not enabled on the project
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('matches')
        .select('id, result, score_a, score_b')
        .not('result', 'is', null)
      if (data && data.length > 0) {
        let changed = false
        setMatches(prev => {
          const next = prev.map(m => {
            const fresh = data.find(d => d.id === m.id)
            if (fresh && m.result !== fresh.result) { changed = true; return { ...m, ...fresh } }
            return m
          })
          return changed ? next : prev
        })
        // Re-fetch predictions when any match result changes
        if (changed && userRef.current) {
          const { data: preds } = await supabase.from('predictions').select('*').eq('user_id', userRef.current.id)
          const map = {}
          ;(preds || []).forEach(p => { map[p.match_id] = p })
          setSavedPredictions(map)
        }
      }
    }, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)
    userRef.current = session.user

    const [profileRes, matchesRes, predsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('matches').select('*').order('match_date').order('match_time'),
      supabase.from('predictions').select('*').eq('user_id', session.user.id),
    ])

    setProfile(profileRes.data)
    setMatches(matchesRes.data || [])
    const predsMap = {}
    ;(predsRes.data || []).forEach(p => { predsMap[p.match_id] = p })
    setSavedPredictions(predsMap)
    setLoading(false)
    if (router.query.welcome) setMessage("🎉 Welcome! Now predict today's matches!")
  }

  // ── IST-aware date categorisation ─────────────────────────────────────────
  // match_date in DB is the ET calendar date.  Indian users live in IST (UTC+5:30)
  // so a match at "2026-06-11 22:00 ET" kicks off at 2026-06-12 07:30 IST —
  // it must appear under 12 Jun IST, not 11 Jun.
  // We compute the IST calendar date of each match and compare to today-in-IST.

  const istToday = todayIST()   // "YYYY-MM-DD" in IST

  function getMatchISTDate(match) {
    return matchISTDate(match.match_date, match.match_time)
  }
  function isMatchToday(match) {
    return getMatchISTDate(match) === istToday
  }
  function isPastDay(match) {
    return getMatchISTDate(match) < istToday
  }

  // Today:     IST kickoff date == today IST (regardless of result)
  // Upcoming:  IST kickoff date > today IST AND no result yet
  // Completed: result has been entered (any date)
  const todayMatches    = matches.filter(m => isMatchToday(m))
  const upcomingMatches = matches.filter(m => !isMatchToday(m) && !isPastDay(m) && !isMatchCompleted(m))
  const completedMatches = matches.filter(m => isMatchCompleted(m))

  // Group upcoming by IST date for the date-chip strip
  const upcomingByDate = {}
  upcomingMatches.forEach(m => {
    const istDate = getMatchISTDate(m)
    if (!upcomingByDate[istDate]) upcomingByDate[istDate] = []
    upcomingByDate[istDate].push(m)
  })
  const upcomingDates = Object.keys(upcomingByDate).sort()

  useEffect(() => {
    if (upcomingDates.length > 0 && !selectedUpcomingDate) setSelectedUpcomingDate(upcomingDates[0])
  }, [upcomingDates.length])

  // Check if all matches for a given list are predicted
  function allPredicted(matchList) {
    return matchList.length > 0 && matchList.every(m => savedPredictions[m.id])
  }

  function handleResultChange(matchId, value) {
    setPredictions(prev => ({ ...prev, [matchId]: { result: value, scoreA: '', scoreB: '' } }))
  }
  function handleScorelineChange(matchId, scoreline) {
    const [a, b] = scoreline.split('-').map(Number)
    setPredictions(prev => ({ ...prev, [matchId]: { ...prev[matchId], scoreA: a, scoreB: b } }))
  }

  function handleEdit(matchId, saved) {
    setEditing(prev => ({ ...prev, [matchId]: true }))
    if (saved && !predictions[matchId]) {
      setPredictions(prev => ({ ...prev, [matchId]: { result: saved.predicted_result, scoreA: saved.predicted_score_a, scoreB: saved.predicted_score_b } }))
    }
  }

  async function savePrediction(match) {
    if (isPredLocked(match)) { alert('This match is locked for predictions.'); return }
    const pred = predictions[match.id]
    if (!pred?.result || pred.scoreA === '' || pred.scoreB === '') {
      alert('Please select both a result and scoreline.')
      return
    }
    // Capture scroll position before any state updates
    const scrollY = window.scrollY
    setSaving(s => ({ ...s, [match.id]: true }))
    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id, match_id: match.id,
      predicted_result: pred.result,
      predicted_score_a: pred.scoreA,
      predicted_score_b: pred.scoreB,
    }, { onConflict: 'user_id,match_id' })
    if (!error) {
      // If the match is already completed, score the prediction immediately
      let scored = { is_result_correct: null, is_score_correct: null, points_earned: null }
      if (match.result) {
        const rc = pred.result === match.result
        const sc = rc && pred.scoreA === match.score_a && pred.scoreB === match.score_b
        scored = {
          is_result_correct: rc,
          is_score_correct: sc,
          points_earned: sc ? 5 : rc ? 3 : 0,
        }
        await supabase.from('predictions').update(scored)
          .eq('user_id', user.id).eq('match_id', match.id)
      }
      setSavedPredictions(prev => ({
        ...prev,
        [match.id]: { predicted_result: pred.result, predicted_score_a: pred.scoreA, predicted_score_b: pred.scoreB, ...scored }
      }))
      setEditing(prev => ({ ...prev, [match.id]: false }))
      setPredictions(prev => { const next = { ...prev }; delete next[match.id]; return next })
      // Restore scroll position after React re-renders
      requestAnimationFrame(() => { window.scrollTo({ top: scrollY, behavior: 'instant' }) })
    }
    setSaving(s => ({ ...s, [match.id]: false }))
  }

  // Check if all matches on a date have predictions
  function dateFullyPredicted(matchList) {
    return matchList.every(m => isPredLocked(m) || !!savedPredictions[m.id])
  }
  function dateAllSaved(matchList) {
    // green tick only when every non-locked match has a save
    const unlocked = matchList.filter(m => !isPredLocked(m) && !isMatchCompleted(m))
    if (unlocked.length === 0) return false // nothing to predict
    return unlocked.every(m => !!savedPredictions[m.id])
  }

  const isGbLocked = new Date() >= TOURNAMENT_START

  if (loading) return (
    <><Navbar user={user} /><div style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--gray-500)' }}>Loading matches...</div></>
  )

  const todayDone = allPredicted(todayMatches)

  return (
    <>
      <Navbar user={user} />
      {/* Full-width container — no max-width cap for predict page */}
      <div style={{ padding: '1.25rem 1rem', maxWidth: '100%', boxSizing: 'border-box' }}>
        {message && (
          <div className="alert alert-success" style={{ maxWidth: '700px', margin: '0 auto 1.5rem' }}>
            {message}
            <button onClick={() => setMessage('')} style={{ marginLeft: '1rem', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}

        <div style={{ fontWeight: 700, color: 'var(--gold)', marginBottom: '1.25rem', maxWidth: '700px', margin: '0 auto 1.25rem' }}>👋 {profile.username}</div>
        {profile && (
          <div className="card-gold" style={{ maxWidth: '700px', margin: '0 auto 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-300)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>🥇 Golden Boot</div>
                {profile.golden_boot_pick
                  ? <div style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600 }}>{profile.golden_boot_pick}</div>
                  : <div style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Not selected yet</div>
                }
              </div>
              <Link href="/golden-boot" className={`btn btn-sm ${profile.golden_boot_pick ? 'btn-ghost' : 'btn-primary'}`}>
                {profile.golden_boot_pick ? 'Edit' : 'Choose player'}
              </Link>
            </div>
            {profile.golden_boot_pick && (
              isGbLocked
                ? <span className="lock-chip">🔒 Locked</span>
                : <div style={{ fontSize: '0.75rem', color: '#f6ad55', background: 'rgba(246,173,85,0.12)', padding: '2px 8px', borderRadius: '99px', display: 'inline-block' }}>
                    ⚠️ Freezes Jun 11, 11:30 PM IST — 1hr before kick-off
                  </div>
            )}
          </div>
        )}

        <h1 className="section-title" style={{ maxWidth: '700px', margin: '0 auto 1rem' }}>MATCH PREDICTIONS</h1>

        <div className="tabs" style={{ maxWidth: '700px', margin: '0 auto 1.5rem' }}>
          <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => { const y = window.scrollY; setTab('upcoming'); requestAnimationFrame(() => window.scrollTo(0, y)) }}>
            Upcoming {upcomingMatches.length > 0 && `(${upcomingMatches.length})`}
          </button>
          <button className={`tab-btn ${tab === 'today' ? 'active' : ''}`} onClick={() => { const y = window.scrollY; setTab('today'); requestAnimationFrame(() => window.scrollTo(0, y)) }}>
            Today {todayMatches.length > 0 && (todayDone ? '✅' : `(${todayMatches.length})`)}
          </button>
          <button className={`tab-btn ${tab === 'completed' ? 'active' : ''}`} onClick={() => { const y = window.scrollY; setTab('completed'); requestAnimationFrame(() => window.scrollTo(0, y)) }}>
            Completed {completedMatches.length > 0 && `(${completedMatches.length})`}
          </button>
        </div>

        {/* TODAY */}
        {tab === 'today' && (
          todayMatches.length === 0
            ? <div className="card" style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No matches today. Check upcoming!</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '700px', margin: '0 auto' }}>
                {todayMatches.map(m => (
                  <MatchCard
                    key={m.id} match={m}
                    saved={savedPredictions[m.id]}
                    localPred={predictions[m.id]}
                    isEditing={!!editing[m.id]}
                    isSaving={!!saving[m.id]}
                    onResultChange={handleResultChange}
                    onScorelineChange={handleScorelineChange}
                    onSave={() => savePrediction(m)}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
        )}

        {/* UPCOMING — date chips + matches */}
        {tab === 'upcoming' && (
          upcomingDates.length === 0
            ? <div className="card" style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No upcoming matches.</div>
            : <>
                {/* Date chip strip — with partial prediction coloring */}
                <div ref={upcomingScrollRef} className="scroll-row" style={{ marginBottom: '1.25rem', maxWidth: '700px', margin: '0 auto 1.25rem' }}>
                  {upcomingDates.map(d => {
                    const isSelected = selectedUpcomingDate === d
                    const dayMatches = upcomingByDate[d]
                    const done = allPredicted(dayMatches)
                    const predictedCount = dayMatches.filter(m => savedPredictions[m.id]).length
                    const partial = !done && predictedCount > 0
                    return (
                      <button key={d} ref={isSelected ? upcomingDateRef : null} onClick={() => setSelectedUpcomingDate(d)} style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '99px',
                        cursor: 'pointer',
                        border: isSelected ? '1.5px solid var(--gold)' : '1px solid rgba(255,255,255,0.12)',
                        background: isSelected ? 'rgba(245,200,66,0.12)' : 'transparent',
                        color: isSelected ? 'var(--gold)' : 'var(--gray-300)',
                        fontSize: '0.82rem',
                        fontWeight: isSelected ? 700 : 400,
                        whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: '5px',
                      }}>
                        {format(parseISO(d), 'EEE, MMM d')}
                        {done
                          ? <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>✅</span>
                          : <span style={{
                              fontSize: '0.7rem', borderRadius: '99px', padding: '1px 6px',
                              background: partial ? 'rgba(56,161,105,0.2)' : 'rgba(255,255,255,0.08)',
                              color: partial ? 'var(--success)' : 'var(--gray-500)',
                            }}>
                              {predictedCount}/{dayMatches.length}
                            </span>
                        }
                      </button>
                    )
                  })}
                </div>

                {selectedUpcomingDate && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '700px', margin: '0 auto' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                      {format(parseISO(selectedUpcomingDate), 'EEEE, MMMM d yyyy')} · {upcomingByDate[selectedUpcomingDate].length} matches
                    </div>
                    {upcomingByDate[selectedUpcomingDate].map(m => (
                      <MatchCard
                        key={m.id} match={m}
                        saved={savedPredictions[m.id]}
                        localPred={predictions[m.id]}
                        isEditing={!!editing[m.id]}
                        isSaving={!!saving[m.id]}
                        onResultChange={handleResultChange}
                        onScorelineChange={handleScorelineChange}
                        onSave={() => savePrediction(m)}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                )}
              </>
        )}

        {/* COMPLETED */}
        {tab === 'completed' && (
          completedMatches.length === 0
            ? <div className="card" style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No completed matches yet.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '700px', margin: '0 auto' }}>
                {[...completedMatches].reverse().map(m => (
                  <MatchCard
                    key={m.id} match={m}
                    saved={savedPredictions[m.id]}
                    localPred={predictions[m.id]}
                    isEditing={!!editing[m.id]}
                    isSaving={!!saving[m.id]}
                    onResultChange={handleResultChange}
                    onScorelineChange={handleScorelineChange}
                    onSave={() => savePrediction(m)}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
        )}
      </div>
    </>
  )
}
