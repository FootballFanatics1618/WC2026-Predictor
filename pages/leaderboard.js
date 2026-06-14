import { useEffect, useState, useRef } from 'react'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'
import { useDragScroll } from '../hooks/useDragScroll'

export default function Leaderboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [table, setTable] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [allPredictions, setAllPredictions] = useState([])
  const [allMatches, setAllMatches] = useState([])
  const [h2h, setH2h] = useState(null) // { opponent: row }
  const [tooltip, setTooltip] = useState(null) // { id, x, y }
  const tableScrollRef = useDragScroll()

  useEffect(() => {
    init()
    const interval = setInterval(fetchTable, 30000)
    return () => clearInterval(interval)
  }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    if (session?.user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(data)
    }
    await fetchTable()
  }

  async function fetchTable() {
    const { data: profiles } = await supabase.from('profiles').select('id, username, first_name, last_name, golden_boot_pick, golden_boot_correct')
    const { data: predictions } = await supabase.from('predictions').select('*')
    const { data: matches } = await supabase.from('matches').select('id, team_a, team_b, stage, result, score_a, score_b, match_date').order('match_date')
    if (!profiles) return
    setAllPredictions(predictions || [])
    setAllMatches(matches || [])

    const rows = profiles.map(p => {
      const userPreds = (predictions || []).filter(pr => pr.user_id === p.id && pr.match_id !== 9999)
      const gbPred = (predictions || []).find(pr => pr.user_id === p.id && pr.match_id === 9999)
      const matchesPredicted = userPreds.length
      const correctResults = userPreds.filter(pr => pr.is_result_correct).length
      const correctScorelines = userPreds.filter(pr => pr.is_score_correct).length
      const gbBonus = p.golden_boot_correct ? 10 : 0
      const points = (predictions || []).filter(pr => pr.user_id === p.id).reduce((sum, pr) => sum + (pr.points_earned || 0), 0) + gbBonus
      return {
        id: p.id, username: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.username, goldenBoot: p.golden_boot_pick,
        goldenBootCorrect: p.golden_boot_correct || false,
        matchesPredicted, correctResults, correctScorelines, points,
      }
    })

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (a.goldenBootCorrect !== b.goldenBootCorrect) return a.goldenBootCorrect ? -1 : 1
      if (b.correctScorelines !== a.correctScorelines) return b.correctScorelines - a.correctScorelines
      return b.correctResults - a.correctResults
    })

    setTable(rows)
    setLastUpdated(new Date())
    setLoading(false)
  }

  const myRow = profile ? table.find(r => r.id === profile?.id) : null
  const myRank = myRow ? table.indexOf(myRow) + 1 : null

  function medalEmoji(rank) {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return rank
  }

  function getResultLabel(result, teamA, teamB) {
    if (result === 'teamA') return `${teamA}`
    if (result === 'teamB') return `${teamB}`
    if (result === 'draw') return 'Draw'
    return '—'
  }

  // H2H panel: completed matches with both users' predictions
  function H2HPanel({ opponent }) {
    const myId = profile?.id
    const oppId = opponent.id
    const completedMatches = allMatches.filter(m => m.result !== null)
    const myPreds = {}
    const oppPreds = {}
    allPredictions.forEach(p => {
      if (p.user_id === myId) myPreds[p.match_id] = p
      if (p.user_id === oppId) oppPreds[p.match_id] = p
    })
    const rows = completedMatches.map(m => ({
      match: m,
      mine: myPreds[m.id],
      theirs: oppPreds[m.id],
    }))

    const myWins = rows.filter(r => r.mine?.points_earned > (r.theirs?.points_earned ?? 0)).length
    const oppWins = rows.filter(r => (r.theirs?.points_earned ?? 0) > (r.mine?.points_earned ?? 0)).length
    const draws = rows.filter(r => r.mine && r.theirs && r.mine.points_earned === r.theirs.points_earned).length

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}
        onClick={() => setH2h(null)}>
        <div style={{ background: 'var(--gray-900)', border: '1px solid rgba(245,200,66,0.3)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '680px', padding: '1.5rem', marginTop: '2rem' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--gold)' }}>HEAD TO HEAD</div>
            <button onClick={() => setH2h(null)} style={{ background: 'none', border: 'none', color: 'var(--gray-500)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          {/* Score summary */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.2rem' }}>You</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: myWins > oppWins ? 'var(--gold)' : 'var(--white)' }}>{myWins}</div>
            </div>
            <div style={{ color: 'var(--gray-500)', fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>{draws} draws</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.2rem' }}>{opponent.username}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: oppWins > myWins ? 'var(--gold)' : 'var(--white)' }}>{oppWins}</div>
            </div>
          </div>

          {/* Match by match */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '55vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>You</span>
              <span style={{ textAlign: 'center' }}>Match</span>
              <span style={{ textAlign: 'right' }}>{opponent.username}</span>
            </div>
            {rows.map(({ match: m, mine, theirs }) => {
              const myBetter = (mine?.points_earned ?? 0) > (theirs?.points_earned ?? 0)
              const theirBetter = (theirs?.points_earned ?? 0) > (mine?.points_earned ?? 0)
              return (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', alignItems: 'center', fontSize: '0.8rem' }}>
                  {/* My pick */}
                  <div style={{ color: myBetter ? 'var(--gold)' : mine ? 'var(--white)' : 'var(--gray-700)' }}>
                    {mine ? <>{getResultLabel(mine.predicted_result, m.team_a, m.team_b)} <span style={{ color: 'var(--gray-500)' }}>{mine.predicted_score_a}–{mine.predicted_score_b}</span></> : <span style={{ color: 'var(--gray-700)', fontSize: '0.75rem' }}>No pick</span>}
                    {mine?.points_earned > 0 && <span style={{ marginLeft: '4px', fontSize: '0.7rem', color: mine.points_earned === 5 ? '#f59e0b' : 'var(--success)' }}>+{mine.points_earned}</span>}
                  </div>
                  {/* Match */}
                  <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--gray-500)', minWidth: '90px' }}>
                    <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.75rem' }}>{m.team_a} v {m.team_b}</div>
                    <div style={{ color: 'var(--success)', fontSize: '0.7rem' }}>FT {m.score_a}–{m.score_b}</div>
                  </div>
                  {/* Their pick */}
                  <div style={{ textAlign: 'right', color: theirBetter ? 'var(--gold)' : theirs ? 'var(--white)' : 'var(--gray-700)' }}>
                    {theirs?.points_earned > 0 && <span style={{ marginRight: '4px', fontSize: '0.7rem', color: theirs.points_earned === 5 ? '#f59e0b' : 'var(--success)' }}>+{theirs.points_earned}</span>}
                    {theirs ? <>{getResultLabel(theirs.predicted_result, m.team_a, m.team_b)} <span style={{ color: 'var(--gray-500)' }}>{theirs.predicted_score_a}–{theirs.predicted_score_b}</span></> : <span style={{ color: 'var(--gray-700)', fontSize: '0.75rem' }}>No pick</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function PointsTooltip({ rowId }) {
    if (!tooltip || tooltip.id !== rowId) return null
    const preds = allPredictions.filter(p => p.user_id === rowId && p.match_id !== 9999)
    const resultPts = preds.filter(p => p.is_result_correct && !p.is_score_correct).length * 3
    const scorePts  = preds.filter(p => p.is_score_correct).length * 5
    const gbPts     = table.find(r => r.id === rowId)?.goldenBootCorrect ? 10 : 0
    const total     = resultPts + scorePts + gbPts
    return (
      <div style={{ position: 'fixed', top: tooltip.y, left: Math.min(tooltip.x, window.innerWidth - 200), zIndex: 400, background: 'var(--gray-900)', border: '1px solid rgba(245,200,66,0.3)', borderRadius: '8px', padding: '0.65rem 0.875rem', fontSize: '0.78rem', color: 'var(--gray-300)', pointerEvents: 'none', minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
        <div style={{ fontWeight: 700, color: 'var(--gold)', marginBottom: '0.4rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Points breakdown</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><span>Correct results (+3)</span><span style={{ color: 'var(--white)', fontWeight: 600 }}>{resultPts}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><span>Exact scorelines (+2 bonus)</span><span style={{ color: 'var(--white)', fontWeight: 600 }}>{scorePts - (preds.filter(p => p.is_score_correct).length * 3)}</span></div>
        {gbPts > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><span>Golden Boot 🥇</span><span style={{ color: 'var(--gold)', fontWeight: 600 }}>+{gbPts}</span></div>}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '0.4rem', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--white)' }}><span>Total</span><span>{total}</span></div>
      </div>
    )
  }

  return (
    <>
      {h2h && <H2HPanel opponent={h2h} />}
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">LEADERBOARD</h1>

        {myRow && (
          <div className="card-gold" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Your rank</span>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--gold)' }}>#{myRank}</div>
                {myRank > 1 && table[0] && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '2px' }}>
                    {table[0].points - myRow.points} pts behind <span style={{ color: 'var(--white)', fontWeight: 600 }}>{table[0].username}</span>
                  </div>
                )}
                {myRank === 1 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '2px' }}>Leading the table 🏆</div>
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Points</span>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--white)' }}>{myRow.points}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Correct Results</span>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--white)' }}>{myRow.correctResults}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Correct Scorelines</span>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--white)' }}>{myRow.correctScorelines}</div>
              </div>
              <div>
                <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Golden Boot Pick</span>
                <div style={{ fontWeight: 600, color: myRow.goldenBootCorrect ? 'var(--gold)' : 'var(--white)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {myRow.goldenBootCorrect ? '🥇 ' : ''}{myRow.goldenBoot || '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>Loading table...</div>
          ) : (
            <div className="table-wrap" ref={tableScrollRef}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Player</th>
                    <th style={{ textAlign: 'center' }}>MP</th>
                    <th style={{ textAlign: 'center' }}>CR</th>
                    <th style={{ textAlign: 'center' }}>CS</th>
                    <th style={{ textAlign: 'center' }}>PTS</th>
                    <th>GB Pick</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row, i) => {
                    const rank = i + 1
                    const isMe = row.id === profile?.id
                    const canH2H = profile && !isMe
                    return (
                      <tr key={row.id}
                        onClick={canH2H ? () => setH2h(row) : undefined}
                        style={{
                          ...(isMe ? { background: 'rgba(245,200,66,0.06)' } : {}),
                          ...(canH2H ? { cursor: 'pointer' } : {}),
                        }}
                        title={canH2H ? `Compare vs ${row.username}` : undefined}>
                        <td style={{ background: isMe ? 'rgba(245,200,66,0.06)' : 'var(--gray-900)' }}>
                          {rank <= 3
                            ? <span style={{ fontSize: '1.1rem' }}>{medalEmoji(rank)}</span>
                            : <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>{rank}</span>}
                        </td>
                        <td>
                          <span style={{ fontWeight: isMe ? 700 : 400, color: isMe ? 'var(--gold)' : 'var(--white)' }}>
                            {row.username} {isMe && <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>(you)</span>}
                            {canH2H && <span style={{ fontSize: '0.65rem', color: 'var(--gray-600)', marginLeft: '4px' }}>H2H</span>}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--gray-500)' }}>{row.matchesPredicted}</td>
                        <td style={{ textAlign: 'center' }}>{row.correctResults}</td>
                        <td style={{ textAlign: 'center' }}>{row.correctScorelines}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: rank === 1 ? 'var(--gold)' : 'var(--white)', fontFamily: 'var(--font-display)', fontSize: '1.1rem', cursor: 'help', position: 'relative' }}
                          onMouseEnter={e => setTooltip({ id: row.id, x: e.clientX - 80, y: e.clientY + 12 })}
                          onMouseLeave={() => setTooltip(null)}
                          onClick={e => { e.stopPropagation(); setTooltip(t => t?.id === row.id ? null : { id: row.id, x: e.clientX - 80, y: e.clientY + 12 }) }}>
                          {row.points}
                          <PointsTooltip rowId={row.id} />
                        </td>
                        <td style={{ fontSize: '0.85rem', color: row.goldenBootCorrect ? 'var(--gold)' : 'var(--gray-500)' }}>
                          {row.goldenBoot || '—'} {row.goldenBootCorrect && '🥇'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '1rem' }}>
            MP = Matches Predicted · CR = Correct Results (+3 pts each) · CS = Correct Scorelines (+2 pts bonus) · GB = Golden Boot Pick (+10 pts bonus)
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
            Ranking: Points → CS → CR (Final day: Points → GB → CS → CR) · Auto-refreshes every 30s
          </p>
          {lastUpdated && (
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-700)', marginTop: '0.4rem' }}>
              Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
          <div className="scroll-hint">← scroll →</div>
        </div>
      </div>
    </>
  )
}
