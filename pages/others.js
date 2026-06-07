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
  // Navigation state: null = date list, string = date selected, number = match selected
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null) // match object

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)
    setMyId(session.user.id)

    const [matchesRes, profilesRes, predsRes] = await Promise.all([
      supabase.from('matches').select('*').order('match_date').order('match_time'),
      supabase.from('profiles').select('id, username, first_name, last_name, golden_boot_pick'),
      supabase.from('predictions').select('*'),
    ])
    setMatches(matchesRes.data || [])
    setProfiles(profilesRes.data || [])
    setAllPredictions(predsRes.data || [])
    setLoading(false)
  }

  // Show ALL matches — predictions visible immediately (not gated by match date)
  const visibleMatches = matches

  const byDate = {}
  visibleMatches.forEach(m => {
    if (!byDate[m.match_date]) byDate[m.match_date] = []
    byDate[m.match_date].push(m)
  })
  const dates = Object.keys(byDate).sort() // ascending: earliest date first

  function getPrediction(userId, matchId) {
    return allPredictions.find(p => p.user_id === userId && p.match_id === matchId)
  }

  function displayName(profile) {
    if (profile.first_name && profile.last_name) return `${profile.first_name} ${profile.last_name}`
    return profile.username || 'Unknown'
  }

  function getResultLabel(result, teamA, teamB) {
    if (result === 'teamA') return `${teamA} Win`
    if (result === 'teamB') return `${teamB} Win`
    if (result === 'draw') return 'Draw'
    return '—'
  }

  // Me first, then others alphabetically
  function orderedProfiles() {
    const me = profiles.find(p => p.id === myId)
    const others = profiles.filter(p => p.id !== myId).sort((a, b) => displayName(a).localeCompare(displayName(b)))
    return me ? [me, ...others] : others
  }

  if (loading) return (
    <><Navbar user={user} /><div className="page" style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--gray-500)' }}>Loading...</div></>
  )

  // ── MATCH DETAIL VIEW ──────────────────────────────────────
  if (selectedMatch) {
    const match = selectedMatch
    const isCompleted = match.result !== null
    const ordered = orderedProfiles()

    return (
      <>
        <Navbar user={user} />
        <div className="page">
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--gray-500)' }}>
            <button onClick={() => { setSelectedDate(null); setSelectedMatch(null) }} style={{ background: 'none', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 0 }}>Others' Picks</button>
            <span>›</span>
            <button onClick={() => setSelectedMatch(null)} style={{ background: 'none', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 0 }}>
              {isToday(parseISO(match.match_date)) ? 'Today' : format(parseISO(match.match_date), 'EEE, MMM d')}
            </button>
            <span>›</span>
            <span style={{ color: 'var(--white)' }}>{match.team_a} vs {match.team_b}</span>
          </div>

          {/* Match header */}
          <div className="card-gold" style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
              {match.stage}{match.group_name ? ` · Group ${match.group_name}` : ''} · {toIST(match.match_time)} · {match.venue}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <FlagImg team={match.team_a} size={40} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.03em' }}>{match.team_a}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                {isCompleted
                  ? <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--gold)' }}>{match.score_a} – {match.score_b}</div>
                  : <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--gray-500)' }}>VS</div>
                }
                {isCompleted && <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '4px' }}>Final Score</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <FlagImg team={match.team_b} size={40} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.03em' }}>{match.team_b}</span>
              </div>
            </div>
          </div>

          {/* Predictions list */}
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--white)', marginBottom: '1rem' }}>
            EVERYONE'S PREDICTIONS ({ordered.filter(p => getPrediction(p.id, match.id)).length}/{ordered.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {ordered.map(p => {
              const pred = getPrediction(p.id, match.id)
              const isMe = p.id === myId
              const isCorrectResult = pred?.is_result_correct
              const isCorrectScore = pred?.is_score_correct

              return (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.1rem',
                  background: isMe ? 'rgba(245,200,66,0.08)' : 'rgba(30,30,26,0.9)',
                  border: `1px solid ${isMe ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 'var(--radius-lg)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: '140px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{isMe ? '👤' : '👥'}</span>
                    <span style={{ fontWeight: isMe ? 700 : 500, color: isMe ? 'var(--gold)' : 'var(--white)', fontSize: '0.925rem' }}>
                      {displayName(p)}
                    </span>
                  </div>

                  {pred ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FlagImg team={pred.predicted_result === 'teamA' ? match.team_a : pred.predicted_result === 'teamB' ? match.team_b : null} size={18} />
                        <span style={{ fontSize: '0.9rem', color: 'var(--white)', fontWeight: 500 }}>
                          {getResultLabel(pred.predicted_result, match.team_a, match.team_b)}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--white)', letterSpacing: '0.04em' }}>
                        {pred.predicted_score_a}–{pred.predicted_score_b}
                      </span>
                      {isCompleted && (
                        isCorrectScore
                          ? <span className="points-chip points-5">+5 pts ⚡</span>
                          : isCorrectResult
                            ? <span className="points-chip points-3">+3 pts ✓</span>
                            : <span className="points-chip points-0">0 pts</span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--gray-500)', fontSize: '0.875rem', fontStyle: 'italic' }}>No prediction made</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  // ── DATE DETAIL VIEW ──────────────────────────────────────
  if (selectedDate) {
    const dayMatches = byDate[selectedDate] || []

    return (
      <>
        <Navbar user={user} />
        <div className="page">
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--gray-500)' }}>
            <button onClick={() => setSelectedDate(null)} style={{ background: 'none', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 0 }}>Others' Picks</button>
            <span>›</span>
            <span style={{ color: 'var(--white)' }}>{isToday(parseISO(selectedDate)) ? 'Today' : format(parseISO(selectedDate), 'EEEE, MMMM d yyyy')}</span>
          </div>

          <h1 className="section-title">
            {isToday(parseISO(selectedDate)) ? '⚡ Today' : format(parseISO(selectedDate), 'EEE, MMM d')}
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {dayMatches.length} match{dayMatches.length !== 1 ? 'es' : ''} — click a match to see everyone's predictions
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {dayMatches.map(match => {
              const isCompleted = match.result !== null
              const totalPredictions = profiles.filter(p => getPrediction(p.id, match.id)).length

              return (
                <button
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  style={{
                    background: 'rgba(30,30,26,0.9)',
                    border: isCompleted ? '1px solid rgba(245,200,66,0.2)' : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.1rem 1.3rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,200,66,0.35)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = isCompleted ? 'rgba(245,200,66,0.2)' : 'rgba(255,255,255,0.07)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {match.stage}{match.group_name ? ` · Group ${match.group_name}` : ''} · {toIST(match.match_time)}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {isCompleted && <span className="match-result-badge">{match.score_a}–{match.score_b}</span>}
                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '99px' }}>
                        {totalPredictions}/{profiles.length} picks
                      </span>
                      <span style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>›</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.03em', color: 'var(--white)' }}>
                      <FlagImg team={match.team_a} size={22} /> {match.team_a}
                    </span>
                    <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>vs</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.03em', color: 'var(--white)' }}>
                      <FlagImg team={match.team_b} size={22} /> {match.team_b}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  // ── DATE LIST VIEW ────────────────────────────────────────
  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">OTHERS' PREDICTIONS</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Predictions are revealed once a match day begins. Pick a date, then a match.
        </p>

        {dates.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
            No matches found. Check back soon!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {dates.map(d => {
              const dayMatches = byDate[d]
              const completed = dayMatches.filter(m => m.result !== null).length
              const total = dayMatches.length

              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    background: 'rgba(30,30,26,0.9)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,200,66,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: isToday(parseISO(d)) ? 'var(--gold)' : 'var(--white)', marginBottom: '0.2rem' }}>
                      {isToday(parseISO(d)) ? '⚡ Today — ' : isBefore(startOfDay(parseISO(d)), startOfDay(new Date())) ? '' : '🗓 '}{format(parseISO(d), 'EEEE, MMMM d yyyy')}
                    </div>
                    <div style={{ fontSize: '0.825rem', color: 'var(--gray-500)' }}>
                      {total} match{total !== 1 ? 'es' : ''} · {completed} completed
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Mini flags for this day's teams */}
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '120px' }}>
                      {dayMatches.slice(0, 6).flatMap(m => [m.team_a, m.team_b]).map((t, i) => (
                        <FlagImg key={i} team={t} size={16} />
                      ))}
                    </div>
                    <span style={{ color: 'var(--gold)', fontSize: '1rem' }}>›</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
