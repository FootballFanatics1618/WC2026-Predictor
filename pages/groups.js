import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'
import { shortName } from '../lib/flags'
import { GROUP_TEAMS, compareThird } from '../lib/standings'
import { BEST_3RD_GROUP_TO_MATCH, MATCHES } from '../lib/data'

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

// ── Bracket data ──────────────────────────────────────────────────────────────
const R32_ORDER = [74,77,73,75,83,84,81,82,76,78,79,80,86,88,85,87]
const R16_ORDER = [89,90,93,94,91,92,95,96]
const QF_ORDER  = [97,98,99,100]
const SF_ORDER  = [101,102]
const FINAL_ID  = 104
const THIRD_ID  = 103

export default function Knockouts() {
  const [user, setUser] = useState(null)
  const [standings, setStandings] = useState([])
  const [dbMatches, setDbMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('bracket')

  useEffect(() => { init() }, [])

  // Real-time subscription: when admin saves a result, update matches and standings immediately
  useEffect(() => {
    const channel = supabase
      .channel('bracket-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new
            setDbMatches(prev => prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m)))
          } else if (payload.eventType === 'INSERT') {
            setDbMatches(prev => [...prev, payload.new])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_standings' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new
            setStandings(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated } : s)))
          } else if (payload.eventType === 'INSERT') {
            setStandings(prev => [...prev, payload.new])
          }
        }
      )
      .subscribe()

    // Fallback poll every 30 seconds in case real-time is not enabled on the project
    const poll = setInterval(async () => {
      const [matchesRes, standingsRes] = await Promise.all([
        supabase.from('matches').select('*'),
        supabase.from('group_standings').select('*'),
      ])
      if (matchesRes.data) setDbMatches(matchesRes.data)
      if (standingsRes.data) setStandings(standingsRes.data)
    }, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    const [standingsRes, matchesRes] = await Promise.all([
      supabase.from('group_standings').select('*'),
      supabase.from('matches').select('*'),
    ])
    setStandings(standingsRes.data || [])
    setDbMatches(matchesRes.data || [])
    setLoading(false)
  }

  const groups = Object.keys(GROUP_TEAMS)
  const standingsByGroup = {}
  groups.forEach(g => {
    standingsByGroup[g] = sortStandings(standings.filter(s => s.group_name === g))
  })

  const thirdPlaced = groups
    .map(g => {
      const rows = standingsByGroup[g] || []
      if (rows.length < 3) return null
      const t = rows[2]
      return {
        team: t.team,
        group: g,
        points: t.points,
        gd: t.goals_for - t.goals_against,
        gf: t.goals_for,
        matchId: BEST_3RD_GROUP_TO_MATCH[g] || null,
      }
    })
    .filter(Boolean)
    .sort(compareThird)

  // ── Bracket ──────────────────────────────────────────────────────────────
  const matchMap = {}
  for (const m of MATCHES) {
    matchMap[m.id] = { ...m, team_a: m.teamA, team_b: m.teamB }
  }
  for (const m of dbMatches) {
    if (matchMap[m.id]) {
      matchMap[m.id].team_a = m.team_a
      matchMap[m.id].team_b = m.team_b
      matchMap[m.id].result = m.result
      matchMap[m.id].score_a = m.score_a
      matchMap[m.id].score_b = m.score_b
    }
  }

  // ── Bracket helpers ─────────────────────────────────────────────────────
  // Column boundaries as % of total grid width (grid: 2fr 1.5fr 1.2fr 1fr 1fr)
  const COL_EDGES = [0, 20, 40, 60, 80, 100]
  const COL_CENTER = [10, 30, 50, 70, 90]

  function r32Row(i) { return i * 2 + 1 }
  function r16Row(i) { return i * 4 + 2 }
  function qfRow(i)  { return i * 8 + 4 }
  function sfRow(i)  { return i * 16 + 8 }

  function TeamLine({ name, score, isWinner }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        color: isWinner ? '#f5c842' : '#c5c5bb',
        fontWeight: isWinner ? 600 : 400,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontSize: '12px', lineHeight: '18px',
      }}>
        <FlagImg team={name} size={14} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{shortName(name)}</span>
        {score !== null && score !== undefined ? (
          <span style={{ color: isWinner ? '#f5c842' : '#ffffff', fontWeight: 700, fontSize: '14px', minWidth: '18px', textAlign: 'center' }}>{score}</span>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em' }}>v</span>
        )}
      </div>
    )
  }

  function MatchCard({ match }) {
    if (!match) return null
    const w = match.result === 'teamA' ? 'a' : match.result === 'teamB' ? 'b' : null
    const hasResult = match.result && match.score_a !== null && match.score_b !== null
    return (
      <div style={{
        background: 'rgba(26, 26, 22, 1)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${hasResult ? '#68d391' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '3px', padding: '8px 10px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px',
        width: '100%', position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          {hasResult ? (
            <span style={{ fontSize: '8px', color: '#68d391', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>FT</span>
          ) : <span />}
          <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.06em' }}>M{match.id}</span>
        </div>
        <TeamLine name={match.team_a} score={match.score_a} isWinner={w === 'a'} />
        <TeamLine name={match.team_b} score={match.score_b} isWinner={w === 'b'} />
      </div>
    )
  }

  function BracketConnector({ fromRow, toRow, colFrom, colTo }) {
    const ROW_H = 68
    const topY = (fromRow - 1) * ROW_H + ROW_H / 2
    const botY = (toRow - 1) * ROW_H + ROW_H / 2
    const midY = (topY + botY) / 2
    const sourceX = COL_CENTER[colFrom]
    const midX = (COL_EDGES[colFrom + 1])
    const targetX = COL_CENTER[colTo]
    const color = 'rgba(255,255,255,0.15)'
    return (
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <line x1={`${sourceX}%`} y1={topY} x2={`${midX}%`} y2={topY} stroke={color} strokeWidth="1.5" />
        <line x1={`${sourceX}%`} y1={botY} x2={`${midX}%`} y2={botY} stroke={color} strokeWidth="1.5" />
        <line x1={`${midX}%`} y1={topY} x2={`${midX}%`} y2={botY} stroke={color} strokeWidth="1.5" />
        <line x1={`${midX}%`} y1={midY} x2={`${targetX}%`} y2={midY} stroke={color} strokeWidth="1.5" />
      </svg>
    )
  }

  function renderBracketCards() {
    const cards = []
    const ROW_H = 68

    for (let i = 0; i < 16; i++) {
      cards.push(
        <div key={`r32-${R32_ORDER[i]}`} style={{ gridColumn: 1, gridRow: r32Row(i), padding: '4px 12px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <MatchCard match={matchMap[R32_ORDER[i]]} />
        </div>
      )
    }
    for (let i = 0; i < 8; i++) {
      cards.push(
        <div key={`r16-${R16_ORDER[i]}`} style={{ gridColumn: 2, gridRow: r16Row(i), padding: '4px 12px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <MatchCard match={matchMap[R16_ORDER[i]]} />
        </div>
      )
    }
    for (let i = 0; i < 4; i++) {
      cards.push(
        <div key={`qf-${QF_ORDER[i]}`} style={{ gridColumn: 3, gridRow: qfRow(i), padding: '4px 12px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <MatchCard match={matchMap[QF_ORDER[i]]} />
        </div>
      )
    }
    for (let i = 0; i < 2; i++) {
      cards.push(
        <div key={`sf-${SF_ORDER[i]}`} style={{ gridColumn: 4, gridRow: sfRow(i), padding: '4px 12px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <MatchCard match={matchMap[SF_ORDER[i]]} />
        </div>
      )
    }
    cards.push(
      <div key="final" style={{ gridColumn: 5, gridRow: 16, padding: '4px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '2px', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '0.55rem', color: '#f5c842', letterSpacing: '0.08em', fontFamily: 'var(--font-display)', fontWeight: 700 }}>FINAL</div>
        <MatchCard match={matchMap[FINAL_ID]} />
      </div>
    )
    return cards
  }

  function renderConnectors() {
    const conns = []
    // R32 → R16
    for (let i = 0; i < 8; i++) {
      conns.push(<BracketConnector key={`c-r32-${i}`} fromRow={r32Row(i*2)} toRow={r32Row(i*2+1)} colFrom={0} colTo={1} />)
    }
    // R16 → QF
    for (let i = 0; i < 4; i++) {
      conns.push(<BracketConnector key={`c-r16-${i}`} fromRow={r16Row(i*2)} toRow={r16Row(i*2+1)} colFrom={1} colTo={2} />)
    }
    // QF → SF
    for (let i = 0; i < 2; i++) {
      conns.push(<BracketConnector key={`c-qf-${i}`} fromRow={qfRow(i*2)} toRow={qfRow(i*2+1)} colFrom={2} colTo={3} />)
    }
    // SF → Final
    conns.push(<BracketConnector key="c-sf" fromRow={sfRow(0)} toRow={sfRow(1)} colFrom={3} colTo={4} />)
    return conns
  }

  const STAGE_LABELS = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final']

  const tabBtnStyle = (tab) => ({
    padding: '0.4rem 1.2rem',
    borderRadius: '6px',
    border: '1px solid',
    borderColor: activeTab === tab ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
    background: activeTab === tab ? 'var(--gold)' : 'transparent',
    color: activeTab === tab ? '#000' : 'var(--gray-400)',
    fontWeight: activeTab === tab ? 700 : 400,
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    letterSpacing: '0.04em',
    transition: 'all 0.2s',
  })

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">KNOCKOUTS</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginBottom: '1rem', marginTop: '-0.5rem' }}>
          Group standings, best 3rd ranking &amp; knockout bracket
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button style={tabBtnStyle('bracket')} onClick={() => setActiveTab('bracket')}>Bracket</button>
          <button style={tabBtnStyle('groups')} onClick={() => setActiveTab('groups')}>Groups</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)' }}>Loading...</div>
        ) : activeTab === 'groups' ? (
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
                return (
                  <div key={g} className="card" style={{ padding: '1rem 0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--gold)', letterSpacing: '0.05em' }}>
                        GROUP {g}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{gamesPlayed}/6 played</div>
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

            <div className="card" style={{ padding: '1rem 0.85rem', marginTop: '2rem' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--gold)', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                BEST 3RD PLACE RANKING
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', minWidth: '300px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ textAlign: 'left', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, paddingRight: '4px' }}>#</th>
                      <th style={{ textAlign: 'left', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, minWidth: '90px' }}>Team</th>
                      <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '28px' }}>Grp</th>
                      <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gold)', fontWeight: 700, width: '28px' }}>Pts</th>
                      <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '26px' }}>GF</th>
                      <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, width: '30px' }}>GD</th>
                      <th style={{ textAlign: 'center', paddingBottom: '5px', color: 'var(--gray-500)', fontWeight: 600, minWidth: '60px' }}>R32</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thirdPlaced.map((t, i) => {
                      const isQualified = i < 8
                      const bg = isQualified ? 'rgba(104,211,145,0.08)' : 'transparent'
                      const nameColor = isQualified ? '#68d391' : 'var(--gray-500)'
                      return (
                        <tr key={`3rd-${t.group}`} style={{ background: bg, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ textAlign: 'center', paddingTop: '4px', paddingBottom: '4px', color: 'var(--gray-600)', fontSize: '0.8rem' }}>
                            {isQualified ? '✅' : `${i + 1}`}
                          </td>
                          <td style={{ color: nameColor, fontWeight: isQualified ? 600 : 400, paddingTop: '4px', paddingBottom: '4px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <FlagImg team={t.team} size={13} />{t.team}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', color: nameColor, fontWeight: isQualified ? 600 : 400 }}>{t.group}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--gold)', fontSize: '0.82rem' }}>{t.points}</td>
                          <td style={{ textAlign: 'center', color: 'var(--gray-300)' }}>{t.gf}</td>
                          <td style={{ textAlign: 'center', color: t.gd > 0 ? '#68d391' : t.gd < 0 ? '#fc8181' : 'var(--gray-300)', fontWeight: t.gd !== 0 ? 600 : 400 }}>
                            {t.gd > 0 ? `+${t.gd}` : t.gd}
                          </td>
                          <td style={{ textAlign: 'center', color: isQualified ? 'var(--gold)' : 'var(--gray-600)' }}>
                            {t.matchId ? `M${t.matchId}` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.5rem' }}>
                ✅ = Qualified for Round of 32
              </div>
            </div>
          </>
        ) : (
          // ── Bracket tab ────────────────────────────────────────────────
          <div style={{ paddingBottom: '2rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: '750px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '4px', marginBottom: '0.5rem',
              }}>
                {STAGE_LABELS.map(label => (
                  <div key={label} style={{
                    fontFamily: 'var(--font-display)', fontSize: '0.85rem',
                    color: '#f5c842', letterSpacing: '0.06em', textAlign: 'center',
                    fontWeight: 700, paddingBottom: '4px',
                    borderBottom: '1px solid rgba(212,175,55,0.15)',
                  }}>
                    {label}
                  </div>
                ))}
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.015)',
                borderRadius: '6px', padding: '2px 0', position: 'relative',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gridTemplateRows: 'repeat(31, 68px)',
                  gap: '0',
                  margin: '24px 0',
                  alignItems: 'center',
                }}>
                  {renderBracketCards()}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
                    {renderConnectors()}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex', gap: '1.5rem', marginTop: '1.25rem',
                fontSize: '0.75rem', color: '#8a8a82', flexWrap: 'wrap',
              }}>
                <span><span style={{ color: '#68d391', fontWeight: 700 }}>█</span> Winner</span>
                <span><span style={{ color: '#f5c842', fontWeight: 700 }}>N</span> Score</span>
                <span><span style={{ color: '#68d391', opacity: 0.5 }}>●</span> FT</span>
                <span><span style={{ opacity: 0.2 }}>v</span> To be played</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
