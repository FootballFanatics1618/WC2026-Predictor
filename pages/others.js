import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'
import { toIST } from '../lib/flags'
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

  // Only show predictions for match days that have already started (today or past)
  const visibleMatches = matches.filter(m =>
    isToday(parseISO(m.match_date)) || isBefore(startOfDay(parseISO(m.match_date)), startOfDay(new Date()))
  )

  const byDate = {}
  visibleMatches.forEach(m => {
    if (!byDate[m.match_date]) byDate[m.match_date] = []
    byDate[m.match_date].push(m)
  })
  const dates = Object.keys(byDate).sort().reverse()

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0])
  }, [dates.length])

  function getPrediction(userId, matchId) {
    return allPredictions.find(p => p.user_id === userId && p.match_id === matchId)
  }

  function getResultLabel(result, teamA, teamB) {
    if (result === 'teamA') return `${teamA} Win`
    if (result === 'teamB') return `${teamB} Win`
    if (result === 'draw') return 'Draw'
    return '—'
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
          Predictions revealed only once the match day begins. Future picks stay hidden.
        </p>

        {dates.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
            No predictions visible yet — check back on June 11 when the tournament begins!
          </div>
        ) : (
          <>
            {/* Date pills */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {dates.map(d => {
                const isSelected = selectedDate === d
                return (
                  <button key={d} onClick={() => setSelectedDate(d)} style={{
                    padding: '0.45rem 1rem', borderRadius: '99px', cursor: 'pointer',
                    border: isSelected ? '1.5px solid var(--gold)' : '1px solid rgba(255,255,255,0.12)',
                    background: isSelected ? 'rgba(245,200,66,0.12)' : 'transparent',
                    color: isSelected ? 'var(--gold)' : 'var(--gray-300)',
                    fontSize: '0.85rem', fontWeight: isSelected ? 700 : 400, whiteSpace: 'nowrap',
                  }}>
                    {isToday(parseISO(d)) ? '⚡ Today' : format(parseISO(d), 'EEE, MMM d')}
                  </button>
                )
              })}
            </div>

            {/* Match prediction tables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {selectedMatches.map(match => {
                const isCompleted = match.result !== null
                return (
                  <div key={match.id} className="card">
                    {/* Match header */}
                    <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                        {match.stage}{match.group_name ? ` · Group ${match.group_name}` : ''} · {toIST(match.match_time)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '0.03em' }}>
                          <FlagImg team={match.team_a} size={26} />
                          {match.team_a}
                        </span>
                        <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>vs</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '0.03em' }}>
                          <FlagImg team={match.team_b} size={26} />
                          {match.team_b}
                        </span>
                        {isCompleted && (
                          <span className="match-result-badge">{match.score_a}–{match.score_b}</span>
                        )}
                        {!isCompleted && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '99px' }}>In progress / upcoming</span>
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
                                <td style={{ fontSize: '0.875rem' }}>
                                  {pred ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                      <FlagImg team={pred.predicted_result === 'teamA' ? match.team_a : pred.predicted_result === 'teamB' ? match.team_b : null} size={16} />
                                      {getResultLabel(pred.predicted_result, match.team_a, match.team_b)}
                                    </span>
                                  ) : <span style={{ color: 'var(--gray-500)' }}>—</span>}
                                </td>
                                <td style={{ textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: pred ? 'var(--white)' : 'var(--gray-500)' }}>
                                  {pred ? `${pred.predicted_score_a}–${pred.predicted_score_b}` : '—'}
                                </td>
                                {isCompleted && (
                                  <td style={{ textAlign: 'center' }}>
                                    {pred ? (
                                      pred.is_score_correct
                                        ? <span className="points-chip points-5" style={{ fontSize: '0.72rem' }}>+5 ⚡</span>
                                        : pred.is_result_correct
                                          ? <span className="points-chip points-3" style={{ fontSize: '0.72rem' }}>+3 ✓</span>
                                          : <span className="points-chip points-0" style={{ fontSize: '0.72rem' }}>0</span>
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
