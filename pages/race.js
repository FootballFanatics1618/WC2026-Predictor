import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'

const SHOW_OPTIONS = [
  { label: 'Top 5',  value: 5 },
  { label: 'Top 10', value: 10 },
  { label: 'Top 20', value: 20 },
  { label: 'All',    value: 999 },
]

export default function Race() {
  const [user, setUser]               = useState(null)
  const [profile, setProfile]         = useState(null)
  const [table, setTable]             = useState([])
  const [allPredictions, setAllPredictions] = useState([])
  const [allMatches, setAllMatches]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [showCount, setShowCount]     = useState(10)
  const [hoveredId, setHoveredId]     = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    if (session?.user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(data)
    }
    await fetchData()
  }

  async function fetchData() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, first_name, last_name, golden_boot_pick, golden_boot_correct')

    const { data: matches } = await supabase
      .from('matches')
      .select('id, team_a, team_b, result, score_a, score_b, match_date, match_time')
      .order('match_date').order('match_time')

    if (!profiles) return
    setAllMatches(matches || [])

    let allPreds = [], from = 0
    while (true) {
      const { data: chunk } = await supabase.from('predictions').select('*').range(from, from + 998)
      if (!chunk || chunk.length === 0) break
      allPreds = allPreds.concat(chunk)
      if (chunk.length < 999) break
      from += 999
    }
    setAllPredictions(allPreds)

    const rows = profiles.map(p => {
      const userPreds = allPreds.filter(pr => pr.user_id === p.id && pr.match_id !== 9999)
      const gbBonus   = p.golden_boot_correct ? 10 : 0
      const points    = allPreds.filter(pr => pr.user_id === p.id).reduce((s, pr) => s + (pr.points_earned || 0), 0) + gbBonus
      const cs        = userPreds.filter(pr => pr.is_score_correct).length
      const cr        = userPreds.filter(pr => pr.is_result_correct).length
      return {
        id: p.id,
        username: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.username,
        goldenBootCorrect: p.golden_boot_correct || false,
        points, cs, cr,
      }
    })

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.cs !== a.cs) return b.cs - a.cs
      if (b.cr !== a.cr) return b.cr - a.cr
      return a.username.localeCompare(b.username)
    })

    setTable(rows)
    setLoading(false)
  }

  // ── Chart computation ─────────────────────────────────────────────────────────
  const completedMatches = allMatches.filter(m => m.result !== null && m.id !== 9999)
  const myId = profile?.id

  const slicedTable = table.slice(0, showCount)

  const playerCount = slicedTable.length
  const n = completedMatches.length

  function playerColor(i, id) {
    if (id === myId) return '#f5c842'
    const hue = Math.round((i * 360) / Math.max(playerCount, 1))
    return `hsl(${hue},70%,62%)`
  }

  const cumByPlayer = slicedTable.map((row, pi) => {
    let pts = 0, cs = 0, cr = 0
    const ptsArr = [0], csArr = [0], crArr = [0]
    for (const m of completedMatches) {
      const pred = allPredictions.find(p => p.user_id === row.id && p.match_id === m.id)
      pts += pred?.points_earned || 0
      cs  += pred?.is_score_correct  ? 1 : 0
      cr  += pred?.is_result_correct ? 1 : 0
      ptsArr.push(pts); csArr.push(cs); crArr.push(cr)
    }
    return { id: row.id, name: row.username, ptsArr, csArr, crArr, color: playerColor(pi, row.id) }
  })

  const series = cumByPlayer.map(player => {
    const positions = []
    for (let i = 0; i <= n; i++) {
      const sorted = [...cumByPlayer].sort((a, b) => {
        if (b.ptsArr[i] !== a.ptsArr[i]) return b.ptsArr[i] - a.ptsArr[i]
        if (b.csArr[i]  !== a.csArr[i])  return b.csArr[i]  - a.csArr[i]
        if (b.crArr[i]  !== a.crArr[i])  return b.crArr[i]  - a.crArr[i]
        return a.name.localeCompare(b.name)
      })
      positions.push(sorted.findIndex(p => p.id === player.id))
    }
    return { ...player, positions, finalRank: positions[n] + 1, finalPts: player.ptsArr[n] }
  })

  const legendSorted = [...series].sort((a, b) => a.finalRank - b.finalRank)

  // ── SVG dimensions ────────────────────────────────────────────────────────────
  const W = Math.max(420, n * 22 + 60)  // widen with match count so dots don't squish
  const ROW_H = Math.max(16, Math.min(32, Math.floor(380 / Math.max(playerCount, 1))))
  const H = playerCount * ROW_H + 60
  const PAD = { top: 20, right: 20, bottom: 32, left: 36 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  function xPos(i) { return PAD.left + (n === 0 ? 0 : (i / n) * chartW) }
  function yPos(pos) { return PAD.top + (playerCount <= 1 ? chartH / 2 : (pos / (playerCount - 1)) * chartH) }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">RANK RACE</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
          How each player's position has moved after every completed match
        </p>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Show:</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {SHOW_OPTIONS.map(opt => (
              <button key={opt.value}
                onClick={() => setShowCount(opt.value)}
                style={{
                  padding: '0.3rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', border: 'none',
                  background: showCount === opt.value ? 'var(--gold)' : 'rgba(255,255,255,0.07)',
                  color: showCount === opt.value ? '#000' : 'var(--gray-400)',
                  fontWeight: showCount === opt.value ? 700 : 400,
                  transition: 'all 0.15s',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginLeft: 'auto' }}>
            {playerCount} players · {n} matches
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)' }}>Loading...</div>
        ) : n === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
            No completed matches yet — check back after the first game.
          </div>
        ) : (
          <div className="card">
            {/* Chart */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab' }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: `${W}px`, display: 'block' }}>

                {/* Horizontal rank grid lines */}
                {Array.from({ length: playerCount }, (_, i) => {
                  const y = yPos(i)
                  const isTop3 = i < 3
                  return (
                    <g key={i}>
                      <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                        stroke={isTop3 ? 'rgba(245,200,66,0.08)' : 'rgba(255,255,255,0.04)'}
                        strokeWidth="1" strokeDasharray={isTop3 ? '' : '3,5'} />
                      <text x={PAD.left - 5} y={y + 4} textAnchor="end" fontSize="9" fill={isTop3 ? 'rgba(245,200,66,0.5)' : 'rgba(255,255,255,0.2)'}>
                        #{i + 1}
                      </text>
                    </g>
                  )
                })}

                {/* X axis match labels */}
                {completedMatches.map((_, i) => {
                  // Show at most ~25 labels — step up as match count grows
                  const step = Math.max(1, Math.ceil(n / 25))
                  if ((i + 1) % step !== 0 && i !== n - 1) return null
                  return (
                    <text key={i} x={xPos(i + 1)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.22)">
                      M{i + 1}
                    </text>
                  )
                })}

                {/* Background (non-hovered, non-me) lines */}
                {series.filter(s => s.id !== hoveredId && s.id !== myId).map(s => (
                  <polyline key={`line-${s.id}`}
                    points={s.positions.map((pos, i) => `${xPos(i)},${yPos(pos)}`).join(' ')}
                    fill="none" stroke={s.color} strokeWidth="1.5" opacity="0.2"
                    strokeLinejoin="round" strokeLinecap="round"
                  />
                ))}

                {/* Background dots */}
                {series.filter(s => s.id !== hoveredId && s.id !== myId).map(s =>
                  s.positions.map((pos, i) => (
                    <circle key={`dot-${s.id}-${i}`}
                      cx={xPos(i)} cy={yPos(pos)}
                      r={i === 0 || i === n ? 2.5 : 1.9}
                      fill={s.color} opacity="0.3"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredId(s.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    />
                  ))
                )}

                {/* Hovered player */}
                {hoveredId && hoveredId !== myId && (() => {
                  const s = series.find(p => p.id === hoveredId)
                  if (!s) return null
                  const lastPos = s.positions[n]
                  const lx = xPos(n), ly = yPos(lastPos)
                  const labelW = s.name.length * 6.5 + 16
                  return (
                    <g onMouseLeave={() => setHoveredId(null)}>
                      <polyline
                        points={s.positions.map((pos, i) => `${xPos(i)},${yPos(pos)}`).join(' ')}
                        fill="none" stroke={s.color} strokeWidth="3.1" opacity="1"
                        strokeLinejoin="round" strokeLinecap="round"
                      />
                      {s.positions.map((pos, i) => (
                        <circle key={i} cx={xPos(i)} cy={yPos(pos)} r={i === 0 || i === n ? 3.8 : 3} fill={s.color} />
                      ))}
                      <rect x={lx - labelW / 2} y={ly - 24} width={labelW} height={16} rx="4" fill="rgba(10,10,16,0.95)" />
                      <text x={lx} y={ly - 12} textAnchor="middle" fontSize="10.5" fill={s.color} fontWeight="700">{s.name}</text>
                    </g>
                  )
                })()}

                {/* Current user — always on top */}
                {myId && (() => {
                  const s = series.find(p => p.id === myId)
                  if (!s) return null
                  const lx = xPos(n), ly = yPos(s.positions[n])
                  const labelW = (s.name + ' (you)').length * 6.5 + 16
                  return (
                    <g>
                      <polyline
                        points={s.positions.map((pos, i) => `${xPos(i)},${yPos(pos)}`).join(' ')}
                        fill="none" stroke="#f5c842" strokeWidth="3.75" opacity="1"
                        strokeLinejoin="round" strokeLinecap="round"
                      />
                      {s.positions.map((pos, i) => (
                        <circle key={i} cx={xPos(i)} cy={yPos(pos)} r={i === 0 || i === n ? 4.5 : 3.4} fill="#f5c842" />
                      ))}
                      <rect x={lx - labelW / 2} y={ly - 24} width={labelW} height={16} rx="4" fill="rgba(10,10,16,0.95)" />
                      <text x={lx} y={ly - 12} textAnchor="middle" fontSize="10.5" fill="#f5c842" fontWeight="700">{s.name} (you)</text>
                    </g>
                  )
                })()}
              </svg>
            </div>

            {/* Legend */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
                Final standings
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: '0.35rem 0.75rem' }}>
                {legendSorted.map(s => {
                  const isMe = s.id === myId
                  const isHovered = s.id === hoveredId
                  return (
                    <div key={s.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '6px', cursor: 'default',
                        background: isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                        border: isMe ? '1px solid rgba(245,200,66,0.3)' : '1px solid transparent',
                      }}
                      onMouseEnter={() => setHoveredId(s.id)}
                      onMouseLeave={() => setHoveredId(null)}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-600)', minWidth: '24px', fontWeight: 600 }}>#{s.finalRank}</span>
                      <span style={{ fontSize: '0.8rem', color: isMe ? '#f5c842' : isHovered ? s.color : 'var(--gray-300)',
                        fontWeight: isMe ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-600)', marginLeft: 'auto', flexShrink: 0 }}>{s.finalPts}pts</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
