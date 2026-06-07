import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'

export default function Leaderboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [table, setTable] = useState([])
  const [loading, setLoading] = useState(true)

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
    if (!profiles) return

    const rows = profiles.map(p => {
      const userPreds = (predictions || []).filter(pr => pr.user_id === p.id && pr.match_id !== 9999)
      const gbPred = (predictions || []).find(pr => pr.user_id === p.id && pr.match_id === 9999)
      const matchesPredicted = userPreds.length
      const correctResults = userPreds.filter(pr => pr.is_result_correct).length
      const correctScorelines = userPreds.filter(pr => pr.is_score_correct).length
      const points = (predictions || []).filter(pr => pr.user_id === p.id).reduce((sum, pr) => sum + (pr.points_earned || 0), 0)
      return {
        id: p.id, username: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.username, goldenBoot: p.golden_boot_pick,
        goldenBootCorrect: p.golden_boot_correct || false,
        matchesPredicted, correctResults, correctScorelines, points,
      }
    })

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.correctScorelines !== a.correctScorelines) return b.correctScorelines - a.correctScorelines
      return b.correctResults - a.correctResults
    })

    setTable(rows)
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

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">LEADERBOARD</h1>

        {myRow && (
          <div className="card-gold" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Your rank</span>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--gold)' }}>#{myRank}</div>
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
        )}

        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>Loading table...</div>
          ) : (
            <div className="table-wrap">
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
                    return (
                      <tr key={row.id} style={isMe ? { background: 'rgba(245,200,66,0.06)' } : {}}>
                        <td>
                          {rank <= 3
                            ? <span style={{ fontSize: '1.1rem' }}>{medalEmoji(rank)}</span>
                            : <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>{rank}</span>}
                        </td>
                        <td>
                          <span style={{ fontWeight: isMe ? 700 : 400, color: isMe ? 'var(--gold)' : 'var(--white)' }}>
                            {row.username} {isMe && <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>(you)</span>}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--gray-500)' }}>{row.matchesPredicted}</td>
                        <td style={{ textAlign: 'center' }}>{row.correctResults}</td>
                        <td style={{ textAlign: 'center' }}>{row.correctScorelines}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: rank === 1 ? 'var(--gold)' : 'var(--white)', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
                          {row.points}
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
        </div>
      </div>
    </>
  )
}
