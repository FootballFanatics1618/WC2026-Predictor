import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { generateScorelines } from '../lib/data'
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns'

export default function Predict() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({}) // { matchId: { result, scoreA, scoreB } }
  const [savedPredictions, setSavedPredictions] = useState({})
  const [saving, setSaving] = useState({})
  const [tab, setTab] = useState('today') // 'today' | 'upcoming' | 'completed'
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    init()
  }, [])

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
    ;(predsRes.data || []).forEach(p => {
      predsMap[p.match_id] = p
    })
    setSavedPredictions(predsMap)
    setLoading(false)

    if (router.query.welcome) {
      setMessage('🎉 Welcome! Your Golden Boot pick has been saved. Now predict today\'s matches!')
    }
  }

  function isMatchLocked(match) {
    const today = startOfDay(new Date())
    const matchDay = startOfDay(parseISO(match.match_date))
    return isBefore(matchDay, today)
  }

  function isMatchToday(match) {
    return isToday(parseISO(match.match_date))
  }

  function isMatchCompleted(match) {
    return match.result !== null
  }

  const todayMatches = matches.filter(m => isMatchToday(m))
  const upcomingMatches = matches.filter(m => !isMatchToday(m) && !isMatchLocked(m))
  const completedMatches = matches.filter(m => isMatchLocked(m) || isMatchCompleted(m))

  function getDisplayMatches() {
    if (tab === 'today') return todayMatches
    if (tab === 'upcoming') return upcomingMatches
    if (tab === 'completed') return completedMatches
    return []
  }

  function handleResultChange(matchId, value) {
    setPredictions(prev => ({
      ...prev,
      [matchId]: { result: value, scoreA: '', scoreB: '' }
    }))
  }

  function handleScorelineChange(matchId, scoreline) {
    const [a, b] = scoreline.split('-').map(Number)
    setPredictions(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], scoreA: a, scoreB: b }
    }))
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
    if (result === 'teamA') return `${teamA} Win`
    if (result === 'teamB') return `${teamB} Win`
    if (result === 'draw') return 'Draw'
    return ''
  }

  if (loading) {
    return (
      <>
        <Navbar user={user} />
        <div className="page" style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--gray-500)' }}>Loading matches...</div>
      </>
    )
  }

  const displayMatches = getDisplayMatches()

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        {message && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>{message}</div>}

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

        {displayMatches.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
            {tab === 'today' ? 'No matches today. Check upcoming matches!' : 'No matches here yet.'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayMatches.map(match => {
            const locked = isMatchLocked(match) && !isMatchToday(match)
            const completed = isMatchCompleted(match)
            const saved = savedPredictions[match.id]
            const local = predictions[match.id]
            const pred = local || (saved ? { result: saved.predicted_result, scoreA: saved.predicted_score_a, scoreB: saved.predicted_score_b } : null)
            const scorelines = pred?.result ? generateScorelines(pred.result) : []
            const currentScoreline = pred?.scoreA !== undefined && pred?.scoreB !== undefined ? `${pred.scoreA}-${pred.scoreB}` : ''
            const isCorrectResult = completed && saved && saved.is_result_correct
            const isCorrectScore = completed && saved && saved.is_score_correct

            return (
              <div key={match.id} className={`match-card ${locked ? 'locked' : ''} ${completed ? 'completed' : ''} ${saved && !completed ? 'predicted' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {match.stage}
                    </span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>
                      {format(parseISO(match.match_date), 'EEE, MMM d')} · {match.match_time} · {match.venue}
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
                    {(locked || completed) && !isMatchToday(match) && (
                      <span className="lock-chip">🔒 Locked</span>
                    )}
                  </div>
                </div>

                <div className="match-teams">
                  <span>{match.team_a}</span>
                  <span className="match-vs">vs</span>
                  <span>{match.team_b}</span>
                </div>

                {completed && (
                  <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                    <span className="match-result-badge">
                      Result: {match.score_a}–{match.score_b}
                    </span>
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
                      <select
                        className="form-select"
                        value={pred?.result || ''}
                        onChange={e => handleResultChange(match.id, e.target.value)}
                      >
                        <option value="">— Pick result —</option>
                        <option value="teamA">{match.team_a} Win</option>
                        {match.stage === 'Group Stage' && <option value="draw">Draw</option>}
                        <option value="teamB">{match.team_b} Win</option>
                      </select>
                    </div>

                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <label className="form-label">Scoreline</label>
                      <select
                        className="form-select"
                        value={currentScoreline}
                        onChange={e => handleScorelineChange(match.id, e.target.value)}
                        disabled={!pred?.result}
                      >
                        <option value="">— Pick score —</option>
                        {scorelines.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => savePrediction(match)}
                      disabled={saving[match.id]}
                      style={{ whiteSpace: 'nowrap', marginBottom: '2px' }}
                    >
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
                  <div style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>
                    ❌ No prediction made for this match
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
