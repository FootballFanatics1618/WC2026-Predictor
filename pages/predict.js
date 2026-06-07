import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'
import { generateScorelines } from '../lib/data'
import { toIST } from '../lib/flags'
import { isMatchPredictionLocked, timeUntilLock, isGoldenBootLocked, GOLDEN_BOOT_LOCK } from '../lib/locktime'
import { ALL_PLAYERS } from '../lib/data'
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns'

export default function Predict() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [savedPredictions, setSavedPredictions] = useState({})
  const [saving, setSaving] = useState({})
  const [tab, setTab] = useState('today')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedUpcomingDate, setSelectedUpcomingDate] = useState(null)
  const [now, setNow] = useState(new Date())
  // Golden Boot inline state
  const [gbSearch, setGbSearch] = useState('')
  const [gbPick, setGbPick] = useState('')
  const [gbOpen, setGbOpen] = useState(false)
  const [gbSaving, setGbSaving] = useState(false)
  const [gbMsg, setGbMsg] = useState('')
  const [gbLocked, setGbLocked] = useState(false)

  // Tick every minute to re-evaluate locks
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)

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
    if (profileRes.data) {
      setGbPick(profileRes.data.golden_boot_pick || '')
      setGbSearch(profileRes.data.golden_boot_pick || '')
    }
    setGbLocked(isGoldenBootLocked())
    if (router.query.welcome) setMessage("🎉 Welcome! Set your Golden Boot pick on the home page, then predict matches here!")
  }

  // A match is in "past days" if its date is strictly before today
  function isPastDay(match) {
    return isBefore(startOfDay(parseISO(match.match_date)), startOfDay(new Date()))
  }
  function isMatchToday(match) { return isToday(parseISO(match.match_date)) }
  function isMatchCompleted(match) { return match.result !== null }

  // Prediction lock: 1 hour before kick-off OR if result already entered
  function isPredLocked(match) {
    if (isMatchCompleted(match)) return true
    return isMatchPredictionLocked(match.match_date, match.match_time)
  }

  // Tabs:
  // Today: matches today
  // Upcoming: future dates (not today)
  // Completed: matches with result entered
  const todayMatches = matches.filter(m => isMatchToday(m))
  const upcomingMatches = matches.filter(m => !isMatchToday(m) && !isPastDay(m))
  // Completed = has a result
  const completedMatches = matches.filter(m => isMatchCompleted(m))

  const upcomingByDate = {}
  upcomingMatches.forEach(m => {
    if (!upcomingByDate[m.match_date]) upcomingByDate[m.match_date] = []
    upcomingByDate[m.match_date].push(m)
  })
  const upcomingDates = Object.keys(upcomingByDate).sort()

  useEffect(() => {
    if (upcomingDates.length > 0 && !selectedUpcomingDate) setSelectedUpcomingDate(upcomingDates[0])
  }, [upcomingDates.length])

  function handleResultChange(matchId, value) {
    setPredictions(prev => ({ ...prev, [matchId]: { result: value, scoreA: '', scoreB: '' } }))
  }
  function handleScorelineChange(matchId, scoreline) {
    const [a, b] = scoreline.split('-').map(Number)
    setPredictions(prev => ({ ...prev, [matchId]: { ...prev[matchId], scoreA: a, scoreB: b } }))
  }

  async function savePrediction(match) {
    if (isPredLocked(match)) { alert('This match is locked for predictions.'); return }
    const pred = predictions[match.id]
    if (!pred?.result || pred.scoreA === '' || pred.scoreB === '') {
      alert('Please select both a result and scoreline.')
      return
    }
    setSaving(s => ({ ...s, [match.id]: true }))
    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id, match_id: match.id,
      predicted_result: pred.result,
      predicted_score_a: pred.scoreA,
      predicted_score_b: pred.scoreB,
    }, { onConflict: 'user_id,match_id' })
    if (!error) {
      setSavedPredictions(prev => ({
        ...prev,
        [match.id]: { predicted_result: pred.result, predicted_score_a: pred.scoreA, predicted_score_b: pred.scoreB }
      }))
    }
    setSaving(s => ({ ...s, [match.id]: false }))
  }

  function getResultLabel(result, teamA, teamB) {
    if (result === 'teamA') return `${teamA} Win`
    if (result === 'teamB') return `${teamB} Win`
    if (result === 'draw') return 'Draw'
    return ''
  }

  function MatchCard({ match }) {
    const completed = isMatchCompleted(match)
    const predLocked = isPredLocked(match)
    const saved = savedPredictions[match.id]
    const local = predictions[match.id]
    const pred = local || (saved ? { result: saved.predicted_result, scoreA: saved.predicted_score_a, scoreB: saved.predicted_score_b } : null)
    const scorelines = pred?.result ? generateScorelines(pred.result) : []
    const currentScoreline = pred?.scoreA !== undefined && pred?.scoreB !== undefined ? `${pred.scoreA}-${pred.scoreB}` : ''
    const isCorrectResult = completed && saved && saved.is_result_correct
    const isCorrectScore = completed && saved && saved.is_score_correct
    const lockCountdown = !predLocked ? timeUntilLock(match.match_date, match.match_time) : null
    const hasPrediction = !!saved

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
              {format(parseISO(match.match_date), 'EEE, MMM d')} · {toIST(match.match_time)}
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
              {match.score_a} – {match.score_b}
            </span>
            {saved && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                Your pick: {getResultLabel(saved.predicted_result, match.team_a, match.team_b)} {saved.predicted_score_a}–{saved.predicted_score_b}
              </div>
            )}
          </div>
        )}

        {/* Prediction inputs — stacked on mobile */}
        {!predLocked && !completed && (
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <label className="form-label">Result</label>
              <select className="form-select" value={pred?.result || ''} onChange={e => handleResultChange(match.id, e.target.value)}>
                <option value="">— Pick result —</option>
                <option value="teamA">{match.team_a} Win</option>
                {match.stage === 'Group Stage' && <option value="draw">Draw</option>}
                <option value="teamB">{match.team_b} Win</option>
              </select>
            </div>
            <div style={{ flex: '1 1 110px', minWidth: 0 }}>
              <label className="form-label">Scoreline</label>
              <select className="form-select" value={currentScoreline} onChange={e => handleScorelineChange(match.id, e.target.value)} disabled={!pred?.result}>
                <option value="">— Score —</option>
                {scorelines.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => savePrediction(match)}
              disabled={saving[match.id]}
              style={{ whiteSpace: 'nowrap', flexShrink: 0, marginBottom: '2px' }}
            >
              {saving[match.id] ? '...' : saved ? '✓ Update' : 'Save'}
            </button>
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

  if (loading) return (
    <><Navbar user={user} /><div style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--gray-500)' }}>Loading matches...</div></>
  )

  return (
    <>
      <Navbar user={user} />
      {/* Full-width container — no max-width cap for predict page */}
      <div style={{ padding: '1.5rem', maxWidth: '100%', boxSizing: 'border-box' }}>
        {message && (
          <div className="alert alert-success" style={{ maxWidth: '700px', margin: '0 auto 1.5rem' }}>
            {message}
            <button onClick={() => setMessage('')} style={{ marginLeft: '1rem', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {profile && (
          <div className="card-gold" style={{ maxWidth: '700px', margin: '0 auto 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.9rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '1rem' }}>👋 {profile.first_name || profile.username}</span>
              {gbLocked
                ? <span className="lock-chip">🔒 Golden Boot locked</span>
                : <span style={{ fontSize: '0.75rem', color: '#f6ad55', background: 'rgba(246,173,85,0.12)', padding: '2px 8px', borderRadius: '99px' }}>
                    ⚠️ Freezes Jun 10, 11:30 PM IST — 1hr before tournament
                  </span>
              }
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-300)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🥇 Golden Boot Pick</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>— +10 pts if correct</span>
            </div>

            {gbLocked ? (
              <div style={{ padding: '0.6rem 0.9rem', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius)', fontSize: '0.925rem', color: 'var(--white)', fontWeight: 600 }}>
                {profile.golden_boot_pick || <span style={{ color: 'var(--gray-500)' }}>No pick was made before lock</span>}
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      className="form-input"
                      placeholder="Search player name..."
                      value={gbSearch}
                      onChange={e => { setGbSearch(e.target.value); setGbPick(''); setGbOpen(true) }}
                      onFocus={() => setGbOpen(true)}
                      onBlur={() => setTimeout(() => setGbOpen(false), 150)}
                      style={{ paddingRight: gbPick ? '2.2rem' : '0.9rem' }}
                    />
                    {gbPick && <span style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--success)' }}>✓</span>}
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    disabled={gbSaving || !gbPick}
                    onClick={async () => {
                      if (!gbPick) return
                      setGbSaving(true)
                      const { error } = await supabase.from('profiles').update({ golden_boot_pick: gbPick }).eq('id', user.id)
                      if (!error) { setProfile(p => ({ ...p, golden_boot_pick: gbPick })); setGbMsg('✅ Saved!') }
                      else setGbMsg('❌ Error saving')
                      setGbSaving(false)
                      setTimeout(() => setGbMsg(''), 2500)
                    }}
                  >
                    {gbSaving ? '...' : profile.golden_boot_pick ? 'Update' : 'Save Pick'}
                  </button>
                </div>
                {gbMsg && <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: gbMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>{gbMsg}</div>}
                {gbOpen && (() => {
                  const players = [...ALL_PLAYERS].sort().filter(p => !gbSearch || p.toLowerCase().includes(gbSearch.toLowerCase()))
                  return players.length > 0 ? (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: '90px', background: 'var(--gray-900)', border: '1px solid rgba(245,200,66,0.3)', borderRadius: 'var(--radius)', maxHeight: '200px', overflowY: 'auto', zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                      {players.slice(0, 60).map(p => (
                        <div key={p} onMouseDown={() => { setGbPick(p); setGbSearch(p); setGbOpen(false) }}
                          style={{ padding: '0.5rem 0.9rem', cursor: 'pointer', fontSize: '0.875rem', color: gbPick === p ? 'var(--gold)' : 'var(--white)', background: gbPick === p ? 'rgba(245,200,66,0.08)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                          onMouseLeave={e => e.currentTarget.style.background = gbPick === p ? 'rgba(245,200,66,0.08)' : 'transparent'}
                        >
                          {p} {gbPick === p && <span>✓</span>}
                        </div>
                      ))}
                      {players.length > 60 && <div style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem', color: 'var(--gray-500)', textAlign: 'center' }}>Type more to narrow ({players.length} players)</div>}
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>
        )}

        <h1 className="section-title" style={{ maxWidth: '700px', margin: '0 auto 1rem' }}>MATCH PREDICTIONS</h1>

        <div className="tabs" style={{ maxWidth: '700px', margin: '0 auto 1.5rem' }}>
          <button className={`tab-btn ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>
            Today {todayMatches.length > 0 && `(${todayMatches.length})`}
          </button>
          <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
            Upcoming {upcomingMatches.length > 0 && `(${upcomingMatches.length})`}
          </button>
          <button className={`tab-btn ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>
            Completed {completedMatches.length > 0 && `(${completedMatches.length})`}
          </button>
        </div>

        {/* TODAY */}
        {tab === 'today' && (
          todayMatches.length === 0
            ? <div className="card" style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No matches today. Check upcoming!</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '700px', margin: '0 auto' }}>
                {todayMatches.map(m => <MatchCard key={m.id} match={m} />)}
              </div>
        )}

        {/* UPCOMING — date chips + matches */}
        {tab === 'upcoming' && (
          upcomingDates.length === 0
            ? <div className="card" style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No upcoming matches.</div>
            : <>
                {/* Date chip strip */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem', maxWidth: '700px', margin: '0 auto 1.25rem' }}>
                  {upcomingDates.map(d => {
                    const isSelected = selectedUpcomingDate === d
                    const dayMatches = upcomingByDate[d]
                    const allDone = dateAllSaved(dayMatches)
                    const cnt = dayMatches.length
                    return (
                      <button key={d} onClick={() => setSelectedUpcomingDate(d)} style={{
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
                        {allDone
                          ? <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>✅</span>
                          : <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.08)', color: 'var(--gray-500)', borderRadius: '99px', padding: '1px 5px' }}>{cnt}</span>
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
                    {upcomingByDate[selectedUpcomingDate].map(m => <MatchCard key={m.id} match={m} />)}
                  </div>
                )}
              </>
        )}

        {/* COMPLETED */}
        {tab === 'completed' && (
          completedMatches.length === 0
            ? <div className="card" style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No completed matches yet.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '700px', margin: '0 auto' }}>
                {[...completedMatches].reverse().map(m => <MatchCard key={m.id} match={m} />)}
              </div>
        )}
      </div>
    </>
  )
}
