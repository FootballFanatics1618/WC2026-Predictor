import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { generateScorelines } from '../lib/data'
import { getFlag, toIST } from '../lib/flags'
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
  // For upcoming: which date is selected
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

    if (router.query.welcome) {
      setMessage("🎉 Welcome! Your Golden Boot pick has been saved. Now predict today's matches!")
    }
  }

  function isMatchLocked(match) {
    const today = startOfDay(new Date())
    const matchDay = startOfDay(parseISO(match.match_date))
    return isBefore(matchDay, today)
  }

  function isMatchToday(match) { return isToday(parseISO(match.match_date)) }
  function isMatchCompleted(match) { return match.result !== null }

  const todayMatches = matches.filter(m => isMatchToday(m))
  const upcomingMatches = matches.filter(m => !isMatchToday(m) && !isMatchLocked(m))
  const completedMatches = matches.filter(m => isMatchLocked(m) || isMatchCompleted(m))

  // Group upcoming matches by date
  const upcomingByDate = {}
  upcomingMatches.forEach(m => {
    const d = m.match_date
    if (!upcomingByDate[d]) upcomingByDate[d] = []
    upcomingByDate[d].push(m)
  })
  const upcomingDates = Object.keys(upcomingByDate).sort()

  // Auto-select first upcoming date
  useEffect(() => {
    if (upcomingDates.length > 0 && !selectedUpcomingDate) {
      setSelectedUpcomingDate(upcomingDates[0])
    }
  }, [upcomingDates.length])

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
      user_id: user.id,
      match_id: match.id,
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
    if (result === 'teamA') return `${getFlag(teamA)} ${teamA} Win`
    if (result === 'teamB') return `${getFlag(teamB)} ${teamB} Win`
    if (result === 'draw') return 'Draw'
    return ''
  }

  function MatchCard({ match }) {
    const locked = isMatchLocked(match) && !isMatchToday(match)
    const completed = isMatchCompleted(match)
    const saved = savedPredictions[match.id]
    const local = predictions[match.id]
    const pred = local || (saved ? { result: saved.predicted_result, scoreA: saved.predicted_score_a, scoreB: saved.predicted_score_b } : null)
    const scorelines = pred?.result ? generateScorelines(pred.result) : []
    const currentScoreline = pred?.scoreA !== undefined && pred?.scoreB !== undefined ? `${pred.scoreA}-${pred.scoreB}` : ''
    const isCorrectResult = completed && saved && saved.is_result_correct
    const isCorrectScore = completed && saved && saved.is_score_correct
    const flagA = getFlag(match.team_a)
    const flagB = getFlag(match.team_b)

    return (
      <div className={`match-card ${locked ? 'locked' : ''} ${completed ? 'completed' : ''} ${saved && !completed ? 'predicted' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {match.stage}{match.group_name ? ` · Group ${match.group_name}` : ''}
            </span>
            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>
              {format(parseISO(match.match_date), 'EEE, MMM d')} · {toIST(match.match_time)} · {match.venue}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {completed && (
              <>
                {isCorrectScore && <span className="points-chip points-5">+5 pts ⚡</span>}
                {isCorrectResult && !isCorrectScore && <span className="points-chip points-3">+3 pts ✓</span>}
                {!isCorrectResult && saved && <span className="points-chip points-0">0 pts</span>}
              </>
            )}
            {(locked || completed) && !isMatchToday(match) && <span className="lock-chip">🔒 Locked</span>}
          </div>
        </div>

        <div className="match-teams">
          <span>{flagA} {match.team_a}</span>
          <span className="match-vs">vs</span>
          <span>{match.team_b} {flagB}</span>
        </div>

        {completed && (
          <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
            <span className="match-result-badge">Result: {match.score_a}–{match.score_b}</span>
            {saved && (
              <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                Your pick: {getResultLabel(saved.predicted_result, match.team_a, match.team_b)} {saved.predicted_score_a}–{saved.predicted_score_b}
              </span>
            )}
          </div>
        )}

        {!locked && !completed && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label className="form-label">Result</label>
              <select className="form-select" value={pred?.result || ''} onChange={e => handleResultChange(match.id, e.target.value)}>
                <option value="">— Pick result —</option>
                <option value="teamA">{flagA} {match.team_a} Win</option>
                {match.stage === 'Group Stage' && <option value="draw">Draw</option>}
                <option value="teamB">{flagB} {match.team_b} Win</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label className="form-label">Scoreline</label>
              <select className="form-select" value={currentScoreline} onChange={e => handleScorelineChange(match.id, e.target.value)} disabled={!pred?.result}>
                <option value="">— Pick score —</option>
                {scorelines.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => savePrediction(match)} disabled={saving[match.id]} style={{ whiteSpace: 'nowrap', marginBottom: '2px' }}>
              {saving[match.id] ? 'Saving...' : saved ? '✓ Update' : 'Save'}
            </button>
          </div>
        )}

        {locked && !completed && saved && (
          <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
            Your prediction: <strong style={{ color: 'var(--white)' }}>
              {getResultLabel(saved.predicted_result, match.team_a, match.team_b)} — {saved.predicted_score_a}–{saved.predicted_score_b}
            </strong>
          </div>
        )}
        {locked && !completed && !saved && (
          <div style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>❌ No prediction made for this match</div>
        )}
      </div>
    )
  }

  if (loading) return (
    <><Navbar user={user} /><div className="page" style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--gray-500)' }}>Loading matches...</div></>
  )

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        {message && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>{message}<button onClick={() => setMessage('')} style={{ marginLeft: '1rem', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button></div>}

        {profile && (
          <div className="card-gold" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--gold)' }}>👋 {profile.username}</span>
              <span style={{ color: 'var(--gray-500)', marginLeft: '1rem', fontSize: '0.875rem' }}>
                🥇 Golden Boot Pick: <strong style={{ color: 'var(--white)' }}>{profile.golden_boot_pick || '—'}</strong>
              </span>
            </div>
          </div>
        )}

        <h1 className="section-title">MATCH PREDICTIONS</h1>

        <div className="tabs">
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
          <>
            {todayMatches.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
                No matches today. Check upcoming matches!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {todayMatches.map(m => <MatchCard key={m.id} match={m} />)}
              </div>
            )}
          </>
        )}

        {/* UPCOMING — date sub-navigation */}
        {tab === 'upcoming' && (
          <>
            {upcomingDates.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No upcoming matches.</div>
            ) : (
              <>
                {/* Date pills */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
                  {upcomingDates.map(d => {
                    const isSelected = selectedUpcomingDate === d
                    const cnt = upcomingByDate[d].length
                    const hasSaved = upcomingByDate[d].some(m => savedPredictions[m.id])
                    return (
                      <button
                        key={d}
                        onClick={() => setSelectedUpcomingDate(d)}
                        style={{
                          padding: '0.45rem 1rem',
                          borderRadius: '99px',
                          border: isSelected ? '1.5px solid var(--gold)' : '1px solid rgba(255,255,255,0.12)',
                          background: isSelected ? 'rgba(245,200,66,0.12)' : 'transparent',
                          color: isSelected ? 'var(--gold)' : 'var(--gray-300)',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? 700 : 400,
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {format(parseISO(d), 'EEE, MMM d')}
                        <span style={{
                          fontSize: '0.7rem',
                          background: hasSaved ? 'rgba(56,161,105,0.25)' : 'rgba(255,255,255,0.08)',
                          color: hasSaved ? '#68d391' : 'var(--gray-500)',
                          borderRadius: '99px',
                          padding: '1px 6px',
                        }}>{cnt}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Matches for selected date */}
                {selectedUpcomingDate && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '-0.25rem' }}>
                      Showing {upcomingByDate[selectedUpcomingDate].length} match{upcomingByDate[selectedUpcomingDate].length > 1 ? 'es' : ''} on {format(parseISO(selectedUpcomingDate), 'EEEE, MMMM d yyyy')}
                    </div>
                    {upcomingByDate[selectedUpcomingDate].map(m => <MatchCard key={m.id} match={m} />)}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* COMPLETED */}
        {tab === 'completed' && (
          <>
            {completedMatches.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>No completed matches yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[...completedMatches].reverse().map(m => <MatchCard key={m.id} match={m} />)}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
