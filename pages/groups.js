import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'
import { GROUP_TEAMS } from '../lib/standings'

function sortStandings(rows) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.goals_for - a.goals_against
    const gdB = b.goals_for - b.goals_against
    if (gdB !== gdA) return gdB - gdA
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
    return a.team.localeCompare(b.team)
  })
}

export default function Groups() {
  const [user, setUser]       = useState(null)
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    const { data } = await supabase.from('group_standings').select('*')
    setStandings(data || [])
    setLoading(false)
  }

  const groups = Object.keys(GROUP_TEAMS)
  const standingsByGroup = {}
  groups.forEach(g => {
    standingsByGroup[g] = sortStandings(standings.filter(s => s.group_name === g))
  })

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">GROUP STANDINGS</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
          Live standings across all 12 groups
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)' }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--gray-500)' }}>
              <span><span style={{ color: '#68d391', fontWeight: 700 }}>█</span> Qualify (Top 2)</span>
              <span><span style={{ color: '#f6ad55', fontWeight: 700 }}>█</span> Best 3rd (potential)</span>
              <span style={{ color: 'var(--gray-600)' }}>P=Played · W/D/L · Pts · GF/GA · GD</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
              {groups.map(g => {
                const rows = standingsByGroup[g] || []
                const gamesPlayed = rows.reduce((s, r) => s + r.played, 0) / 2
                const totalGames = 6
                return (
                  <div key={g} className="card" style={{ padding: '1rem 0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--gold)', letterSpacing: '0.05em' }}>
                        GROUP {g}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{gamesPlayed}/{totalGames} played</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', minWidth: '300px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ textAlign: 'left', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, paddingRight: '4px' }}>#</th>
                            <th style={{ textAlign: 'left', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, minWidth: '90px' }}>Team</th>
                            <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '22px' }}>P</th>
                            <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '22px' }}>W</th>
                            <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '22px' }}>D</th>
                            <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '22px' }}>L</th>
                            <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gold)', fontWeight: 700, width: '28px' }}>Pts</th>
                            <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '26px' }}>GF</th>
                            <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '26px' }}>GA</th>
                            <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '30px' }}>GD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => {
                            const gd = row.goals_for - row.goals_against
                            const qualBg    = i < 2 ? 'rgba(104,211,145,0.08)' : i === 2 ? 'rgba(246,173,85,0.06)' : 'transparent'
                            const nameColor = i < 2 ? '#68d391' : i === 2 ? '#f6ad55' : 'var(--gray-500)'
                            const qualBadge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🟡' : '❌'
                            return (
                              <tr key={row.team} style={{ background: qualBg, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ textAlign: 'center', paddingTop: '4px', paddingBottom: '4px', color: 'var(--gray-600)', fontSize: '0.8rem' }}>{qualBadge}</td>
                                <td style={{ color: nameColor, fontWeight: i < 2 ? 600 : 400, paddingTop: '4px', paddingBottom: '4px', paddingRight: '4px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <FlagImg team={row.team} size={13} />{row.team}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center', color: 'var(--gray-500)' }}>{row.played}</td>
                                <td style={{ textAlign: 'center', color: 'var(--white)', fontWeight: row.won > 0 ? 600 : 400 }}>{row.won}</td>
                                <td style={{ textAlign: 'center', color: 'var(--gray-400)' }}>{row.drawn}</td>
                                <td style={{ textAlign: 'center', color: row.lost > 0 ? '#fc8181' : 'var(--gray-400)' }}>{row.lost}</td>
                                <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--gold)', fontSize: '0.82rem' }}>{row.points}</td>
                                <td style={{ textAlign: 'center', color: 'var(--gray-300)', fontWeight: 500 }}>{row.goals_for}</td>
                                <td style={{ textAlign: 'center', color: 'var(--gray-400)' }}>{row.goals_against}</td>
                                <td style={{ textAlign: 'center', color: gd > 0 ? '#68d391' : gd < 0 ? '#fc8181' : 'var(--gray-300)', fontWeight: gd !== 0 ? 600 : 400 }}>
                                  {gd > 0 ? `+${gd}` : gd}
                                </td>
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
