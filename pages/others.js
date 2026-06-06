import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { getFlag, toIST } from '../lib/flags'
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns'

export default function Others() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [myId, setMyId] = useState(null)
  const [matches, setMatches] = useState([])
  const [profiles, setProfiles] = useState([])
  const [allPredictions, setAllPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)
    setMyId(session.user.id)

    const [matchesRes, profilesRes, predsRes] = await Promise.all([
      supabase.from('matches').select('*').order('match_date').order('match_time'),
      supabase.from('profiles').select('id, username, golden_boot_pick'),
      supabase.from('predictions').select('*'),
    ])

    setMatches(matchesRes.data || [])
    setProfiles(profilesRes.data || [])
    setAllPredictions(predsRes.data || [])
    setLoading(false)
  }

  function isMatchLocked(match) {
    const today = startOfDay(new Date())
    const matchDay = startOfDay(parseISO(match.match_date))
    return isBefore(matchDay, today) || isToday(parseISO(match.match_date))
  }

  // Only show predictions for matches that have already started (today + past)
  // This prevents seeing others' future predictions
  const visibleMatches = matches.filter(m => isMatchLocked(m))

  // Group by date
  const byDate = {}
  visibleMatches.forEach(m => {
    const d = m.match_date
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(m)
  })
  const dates = Object.keys(byDate).sort().reverse() // most recent first

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[0])
    }
  }, [dates.length])

  function getResultLabel(result, teamA, teamB) {
    if (result === 'teamA') return `${getFlag(teamA)} ${teamA} Win`
    if (result === 'teamB') return `${getFlag(teamB)} ${teamB} Win`
    if (result === 'draw') return 'Draw'
    return '—'
  }

  function getPrediction(userId, matchId) {
    return allPredictions.find(p => p.user_id === userId && p.match_id === matchId)
  }

  const usersInOrder = [...profiles].sort((a, b) => a.username.localeCompare(b.username))

  if (loading) return (
    <><Navbar user={user} /><div className="page" style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--gray-500)' }}>Loading...</div></>
  )

  const selectedMatches = selectedDate ? byDate[selectedDate] || [] : []

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">OTHERS' PREDICTIONS</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Predictions are revealed only after a match day begins. Future picks stay hidden.
        </p>

        {dates.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
            No predictions to show yet — check back once matches start on June 11!
          </div>
        ) : (
          <>
            {/* Date selector */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
              {dates.map(d => {
                const isSelected = selectedDate === d
                const matchCount = byDate[d].length
                return (
                  <button key={d} onClick={() => setSelectedDate(d)} style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '99px',
                    border: isSelected ? '1.5px solid var(--gold)' : '1px solid rgba(255,255,255,0.12)',
                    background: isSelected ? 'rgba(245,200,66,0.12)' : 'transparent',
                    color: isSelected ? 'var(--gold)' : 'var(--gray-300)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? 700 : 400,
                    whiteSpace: 'nowrap',
                  }}>
                    {isToday(parseISO(d)) ? 'Today' : format(parseISO(d), 'EEE, MMM d')}
                    <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.08)', color: 'var(--gray-500)', borderRadius: '99px', padding: '1px 6px' }}>{matchCount}</span>
                  </button>
                )
              })}
            </div>

            {/* Per-match prediction tables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {selectedMatches.map(match => {
                const flagA = getFlag(match.team_a)
                const flagB = getFlag(match.team_b)
                const isCompleted = match.result !== null

                return (
                  <div key={match.id} className="card">
                    {/* Match header */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                        {match.stage}{match.group_name ? ` · Group ${match.group_name}` : ''} · {toIST(match.match_time)}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span>{flagA} {match.team_a}</span>
                        <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}>vs</span>
                        <span>{match.team_b} {flagB}</span>
                        {isCompleted && (
                          <span className="match-result-badge" style={{ fontSize: '0.85rem' }}>
                            {match.score_a}–{match.score_b}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Predictions table */}
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>Result Pick</th>
                            <th style={{ textAlign: 'center' }}>Score</th>
                            {isCompleted && <th style={{ textAlign: 'center' }}>Pts</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {usersInOrder.map(p => {
                            const pred = getPrediction(p.id, match.id)
                            const isMe = p.id === myId
                            return (
                              <tr key={p.id} style={isMe ? { background: 'rgba(245,200,66,0.06)' } : {}}>
                                <td>
                                  <span style={{ fontWeight: isMe ? 700 : 400, color: isMe ? 'var(--gold)' : 'var(--white)', fontSize: '0.875rem' }}>
                                    {p.username}{isMe ? ' 👤' : ''}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.875rem', color: pred ? 'var(--white)' : 'var(--gray-500)' }}>
                                  {pred ? getResultLabel(pred.predicted_result, match.team_a, match.team_b) : '—'}
                                </td>
                                <td style={{ textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: pred ? 'var(--white)' : 'var(--gray-500)' }}>
                                  {pred ? `${pred.predicted_score_a}–${pred.predicted_score_b}` : '—'}
                                </td>
                                {isCompleted && (
                                  <td style={{ textAlign: 'center' }}>
                                    {pred ? (
                                      pred.is_score_correct
                                        ? <span className="points-chip points-5" style={{ fontSize: '0.75rem' }}>+5 ⚡</span>
                                        : pred.is_result_correct
                                          ? <span className="points-chip points-3" style={{ fontSize: '0.75rem' }}>+3 ✓</span>
                                          : <span className="points-chip points-0" style={{ fontSize: '0.75rem' }}>0</span>
                                    ) : <span style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>—</span>}
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}
