import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'
import { generateScorelines } from '../lib/data'
import { toIST } from '../lib/flags'
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
    if (router.query.welcome) setMessage("🎉 Welcome! Now predict today's matches!")
  }

  // Lock 1 hour before kick-off — uses kickoff_utc from DB (server authoritative)
  // RLS enforces the same rule server-side; this is the UI reflection
  function isMatchLocked(match) {
    if (!match.kickoff_utc) {
      return isBefore(startOfDay(parseISO(match.match_date)), startOfDay(new Date()))
    }
    const lockTime = new Date(new Date(match.kickoff_utc).getTime() - 60 * 60 * 1000)
    return new Date() >= lockTime
  }

  function isMatchToday(match) { return isToday(parseISO(match.match_date)) }
  function isMatchCompleted(match) { return match.result !== null }

  const todayMatches = matches.filter(m => isMatchToday(m))
  const upcomingMatches = matches.filter(m => !isMatchToday(m) && !isBefore(startOfDay(parseISO(m.match_date)), startOfDay(new Date())))
  const completedMatches = matches.filter(m => isBefore(startOfDay(parseISO(m.match_date)), startOfDay(new Date())) || isMatchCompleted(m))

  const upcomingByDate = {}
  upcomingMatches.forEach(m => {
    if (!upcomingByDate[m.match_date]) upcomingByDate[m.match_date] = []
    upcomingByDate[m.match_date].push(m)
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

  async function savePrediction(match) {
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
    const locked = isMatchLocked(match)
    const completed = isMatchCompleted(match)
    const saved = savedPredictions[match.id]
    const local = predictions[match.id]
    const pred = local || (saved ? { result: saved.predicted_result, scoreA: saved.predicted_score_a, scoreB: saved.predicted_score_b } : null)
    const scorelines = pred?.result ? generateScorelines(pred.result) : []
    const currentScoreline = pred?.scoreA !== undefined && pred?.scoreB !== undefined ? `${pred.scoreA}-${pred.scoreB}` : ''
    const isCorrectResult = completed && saved && saved.is_result_correct
    const isCorrectScore = completed && saved && saved.is_score_correct

    return (
      <div className={`match-card ${locked ? 'locked' : ''} ${completed ? 'completed' : ''} ${saved && !completed ? 'predicted' : ''}`}
        style={{ padding: '1rem 1.1rem' }}>

        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {match.stage}{match.group_name ? ` · Group ${match.group_name}` : ''}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
            {completed && (
              <>
                {isCorrectScore && <span className="points-chip points-5">+5 pts ⚡</span>}
                {isCorrectResult && !isCorrectScore && <span className="points-chip points-3">+3 pts ✓</span>}
                {!isCorrectResult && saved && <span className="points-chip points-0">0 pts</span>}
              </>
            )}
            {/* Green tick if predicted and not completed */}
            {!completed && saved && <span style={{ fontSize: '1rem', color: 'var(--success)' }}>✅</span>}
            {locked && <span className="lock-chip">🔒</span>}
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--gold)', marginBottom: '0.15rem', width: '100%', fontWeight: 600 }}>
          {format(parseISO(match.match_date), 'EEE, MMM d')} · {toIST(match.match_time)}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginBottom: '0.75rem', width: '100%' }}>
          {match.venue}
        </div>

        {/* Teams row */}
        <div className="match-teams" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.team_a}</span>
            <FlagImg team={match.team_a} size={24} />
          </span>
          <span className="match-vs" style={{ flexShrink: 0, fontSize: '0.9rem' }}>vs</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, justifyContent: 'flex-start' }}>
            <FlagImg team={match.team_b} size={24} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.team_b}</span>
          </span>
        </div>

        {/* Completed: actual result */}
        {completed && (
          <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
            <span className="match-result-badge">Result: {match.score_a}–{match.score_b}</span>
            {saved && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                Your pick: <strong style={{ color: 'var(--white)' }}>
                  {getResultLabel(saved.predicted_result, match.team_a, match.team_b)} {saved.predicted_score_a}–{saved.predicted_score_b}
                </strong>
              </div>
            )}
          </div>
        )}

        {/* Prediction inputs */}
        {!locked && !completed && (
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
              <label className="form-label">Result</label>
              <select className="form-select" value={pred?.result || ''} onChange={e => handleResultChange(match.id, e.target.value)}>
                <option value="">— Pick result —</option>
                <option value="teamA">{match.team_a} Win</option>
                {match.stage === 'Group Stage' && <option value="draw">Draw</option>}
                <option value="teamB">{match.team_b} Win</option>
              </select>
            </div>
            <div style={{ flex: '1 1 120px', minWidth: '110px' }}>
              <label className="form-label">Scoreline</label>
              <select className="form-select" value={currentScoreline} onChange={e => handleScorelineChange(match.id, e.target.value)} disabled={!pred?.result}>
                <option value="">— Score —</option>
                {scorelines.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button
              className={`btn btn-sm ${saved ? 'btn-outline-gold' : 'btn-primary'}`}
              onClick={() => savePrediction(match)}
              disabled={saving[match.id]}
              style={{ whiteSpace: 'nowrap', marginBottom: '2px', flexShrink: 0 }}
            >
              {saving[match.id] ? '...' : saved ? '✎ Update' : 'Save'}
            </button>
          </div>
        )}

        {locked && !completed && saved && (
          <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
            Locked: <strong style={{ color: 'var(--white)' }}>
              {getResultLabel(saved.predicted_result, match.team_a, match.team_b)} — {saved.predicted_score_a}–{saved.predicted_score_b}
            </strong>
          </div>
        )}
        {locked && !completed && !saved && (
          <div style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>❌ No prediction made</div>
        )}
      </div>
    )
  }

  if (loading) return (
    <><Navbar user={user} /><div className="page" style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--gray-500)' }}>Loading matches...</div></>
  )

  const todayDone = allPredicted(todayMatches)

  return (
    <>
      <Navbar user={user} />
      {/* Full width on mobile — no max-width cap on predict page */}
      <div style={{ width: '100%', maxWidth: '720px', margin: '0 auto', padding: '1.25rem 0.75rem' }}>
        {message && (
          <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
            {message}
            <button onClick={() => setMessage('')} style={{ marginLeft: '1rem', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}
        <div style={{ fontWeight: 700, color: 'var(--gold)', marginBottom: '1.25rem' }}>👋 {profile.username}</div>
        {profile && (
          <div className="card-gold" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            {profile.golden_boot_pick ? (
              <div>
                
                <div style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                  🥇 Golden Boot: <strong style={{ color: 'var(--white)' }}>{profile.golden_boot_pick}</strong>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 0 }}>
                
                
                  <div style={{ color: 'var(--white)', fontWeight: 600, marginBottom: '0.25rem' }}>Golden Boot not selected yet</div>
                  <div style={{ color: 'var(--gray-500)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    Pick your tournament top scorer to unlock the bonus points tracker.
                  </div>
                </div>
              
            )}
            <Link href="/golden-boot" className={`btn btn-sm ${profile.golden_boot_pick ? 'btn-ghost' : 'btn-primary'}`}>
              {profile.golden_boot_pick ? 'Edit' : 'Choose GB player'}
            </Link>
          </div>
        )}

        <h1 className="section-title">MATCH PREDICTIONS</h1>

        <div className="tabs">
          <button className={`tab-btn ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>
            Today {todayMatches.length > 0 && (todayDone ? '✅' : `(${todayMatches.length})`)}
          </button>
          <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
            Upcoming {upcomingMatches.length > 0 && `(${upcomingMatches.length})`}
          </button>
          <button className={`tab-btn ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>
            Completed {completedMatches.length > 0 && `(${completedMatches.length})`}
          </button>
        </div>

        {tab === 'today' && (
          todayMatches.length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No matches today. Check upcoming!</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{todayMatches.map(m => <MatchCard key={m.id} match={m} />)}</div>
        )}

        {tab === 'upcoming' && (
          upcomingDates.length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No upcoming matches.</div>
            : <>
                {/* Date chips — green tick replaces count if all predicted */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {upcomingDates.map(d => {
                    const isSelected = selectedUpcomingDate === d
                    const dayMatches = upcomingByDate[d]
                    const done = allPredicted(dayMatches)
                    const predictedCount = dayMatches.filter(m => savedPredictions[m.id]).length
                    const partial = !done && predictedCount > 0
                    return (
                      <button key={d} onClick={() => setSelectedUpcomingDate(d)} style={{
                        padding: '0.4rem 0.875rem', borderRadius: '99px', cursor: 'pointer',
                        border: isSelected ? '1.5px solid var(--gold)' : '1px solid rgba(255,255,255,0.12)',
                        background: isSelected ? 'rgba(245,200,66,0.12)' : 'transparent',
                        color: isSelected ? 'var(--gold)' : 'var(--gray-300)',
                        fontSize: '0.82rem', fontWeight: isSelected ? 700 : 400, whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: '5px',
                      }}>
                        {format(parseISO(d), 'EEE, MMM d')}
                        {done
                          ? <span style={{ fontSize: '0.85rem' }}>✅</span>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginBottom: '-0.1rem' }}>
                      {format(parseISO(selectedUpcomingDate), 'EEEE, MMMM d yyyy')} · {upcomingByDate[selectedUpcomingDate].length} matches
                    </div>
                    {upcomingByDate[selectedUpcomingDate].map(m => <MatchCard key={m.id} match={m} />)}
                  </div>
                )}
              </>
        )}

        {tab === 'completed' && (
          completedMatches.length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No completed matches yet.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{[...completedMatches].reverse().map(m => <MatchCard key={m.id} match={m} />)}</div>
        )}
      </div>
    </>
  )
}
