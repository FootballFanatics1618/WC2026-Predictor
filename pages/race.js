import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { getISTDate } from '../lib/flags'
import { format, parseISO, startOfWeek } from 'date-fns'

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
  const [selectedId, setSelectedId]   = useState(null)
  const [viewMode, setViewMode]       = useState('daily')

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
      .select('id, team_a, team_b, result, score_a, score_b, match_date, match_time, stage, group_name, kickoff_utc')
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

  // ── Schedule-gap batch computation ───────────────────────────────────────────
  const myId        = profile?.id
  const slicedTable = table.slice(0, showCount)
  const playerCount = slicedTable.length

  // Group all matches by IST date
  const matchesByDate = {}
  for (const m of allMatches.filter(m => m.id !== 9999)) {
    const date = getISTDate(m.kickoff_utc)
    if (!matchesByDate[date]) matchesByDate[date] = []
    matchesByDate[date].push(m)
  }

  const allDates = Object.keys(matchesByDate).sort()

  // ── Daily: one point per match day ───────────────────────────────────────────
  const completedDates = allDates.filter(d => matchesByDate[d].every(m => m.result !== null))

  // ── Weekly: group match days Mon–Sun, one point per week ─────────────────────
  const weekMap = {}  // weekKey → { dates: [], label: 'Jun 22' }
  for (const date of allDates) {
    const d = parseISO(date)
    const mon = startOfWeek(d, { weekStartsOn: 1 })
    const key = format(mon, 'yyyy-MM-dd')
    if (!weekMap[key]) weekMap[key] = { dates: [], monDate: mon }
    weekMap[key].dates.push(date)
  }
  const allWeeks = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, w]) => ({
      dates: w.dates,
      label: w.dates.length === 1
        ? format(parseISO(w.dates[0]), 'MMM d')
        : `${format(parseISO(w.dates[0]), 'MMM d')} – ${format(parseISO(w.dates[w.dates.length - 1]), 'MMM d')}`,
    }))
  const completedWeeks = allWeeks.filter(w =>
    w.dates.every(d => matchesByDate[d].every(m => m.result !== null))
  )

  const buckets     = viewMode === 'weekly' ? completedWeeks.map(w => w.dates) : completedDates.map(d => [d])
  const bucketLabels = viewMode === 'weekly' ? completedWeeks.map(w => w.label) : completedDates.map(d => format(parseISO(d), 'MMM d'))
  const n = buckets.length

  function playerColor(i, id) {
    if (id === myId) return '#f5c842'
    const hue = Math.round((i * 360) / Math.max(playerCount, 1))
    return `hsl(${hue},70%,62%)`
  }

  const cumByPlayer = slicedTable.map((row, pi) => {
    let pts = 0, cs = 0, cr = 0
    const ptsArr = [0], csArr = [0], crArr = [0]
    for (const bucket of buckets) {
      for (const date of bucket) {
        for (const m of matchesByDate[date]) {
          const pred = allPredictions.find(p => p.user_id === row.id && p.match_id === m.id)
          pts += pred?.points_earned || 0
          cs  += pred?.is_score_correct  ? 1 : 0
          cr  += pred?.is_result_correct ? 1 : 0
        }
      }
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
  const PX_PER_DAY = viewMode === 'weekly' ? 80 : 38
  const W      = Math.max(500, n * PX_PER_DAY + 80)
  const ROW_H  = Math.max(16, Math.min(32, Math.floor(380 / Math.max(playerCount, 1))))
  const H      = playerCount * ROW_H + 70
  const PAD    = { top: 20, right: 30, bottom: 44, left: 36 }
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
          How each player's position has moved day by day
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
          <select
            value={viewMode}
            onChange={e => setViewMode(e.target.value)}
            className="form-select"
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', marginLeft: 'auto' }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>
            {playerCount} players · {n} {viewMode === 'weekly' ? 'weeks' : 'days'}
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)' }}>Loading...</div>
        ) : n === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
            No completed match days yet — check back after the first full day of results.
          </div>
        ) : (
          <div className="card">
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
                      <text x={PAD.left - 5} y={y + 4} textAnchor="end" fontSize="9"
                        fill={isTop3 ? 'rgba(245,200,66,0.5)' : 'rgba(255,255,255,0.2)'}>
                        #{i + 1}
                      </text>
                    </g>
                  )
                })}

                {/* X axis labels */}
                {bucketLabels.map((label, i) => {
                  const labelStep = Math.max(1, Math.ceil(n / 12))
                  if (viewMode === 'daily' && i % labelStep !== 0 && i !== n - 1) return null
                  return (
                    <text key={i} x={xPos(i + 1)} y={H - PAD.bottom + 14}
                      textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.28)">
                      {label}
                    </text>
                  )
                })}

                {/* All lines */}
                {series.map(s => {
                  const activeId = selectedId ?? myId
                  const isActive = s.id === activeId
                  const color = s.id === myId ? '#f5c842' : s.color
                  return (
                    <polyline key={`line-${s.id}`}
                      points={s.positions.map((pos, i) => `${xPos(i)},${yPos(pos)}`).join(' ')}
                      fill="none" stroke={color} strokeWidth={isActive ? 2.5 : 1.5}
                      opacity={isActive ? 1 : 0.1}
                      strokeLinejoin="round" strokeLinecap="round"
                    />
                  )
                })}

                {/* All dots */}
                {series.map(s => {
                  const activeId = selectedId ?? myId
                  const isActive = s.id === activeId
                  const color = s.id === myId ? '#f5c842' : s.color
                  return s.positions.map((pos, i) => (
                    <circle key={`dot-${s.id}-${i}`}
                      cx={xPos(i)} cy={yPos(pos)}
                      r={isActive ? (i === 0 || i === n ? 3.5 : 2.8) : (i === 0 || i === n ? 2.5 : 1.9)}
                      fill={color} opacity={isActive ? 1 : 0.1}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedId(p => p === s.id ? null : s.id)}
                    />
                  ))
                })}

                {/* Active player label */}
                {(() => {
                  const activeId = selectedId ?? myId
                  if (!activeId) return null
                  const s = series.find(p => p.id === activeId)
                  if (!s) return null
                  const color = s.id === myId ? '#f5c842' : s.color
                  const nameLabel = s.id === myId ? `${s.name} (you)` : s.name
                  const lx = xPos(n), ly = yPos(s.positions[n])
                  const labelW = nameLabel.length * 5.8 + 12
                  const clampedLx = Math.min(Math.max(lx, PAD.left + labelW / 2), W - PAD.right - labelW / 2)
                  return (
                    <g>
                      <rect x={clampedLx - labelW / 2} y={ly - 20} width={labelW} height={14} rx="3" fill="rgba(10,10,16,0.92)" />
                      <text x={clampedLx} y={ly - 9} textAnchor="middle" fontSize="9" fill={color} fontWeight="700">{nameLabel}</text>
                    </g>
                  )
                })()}
              </svg>
            </div>

            {/* Legend */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
                Final standings — click a name to highlight
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: '0.35rem 0.75rem' }}>
                {legendSorted.map(s => {
                  const isMe = s.id === myId
                  const activeId = selectedId ?? myId
                  const isActive = s.id === activeId
                  const color = isMe ? '#f5c842' : s.color
                  return (
                    <div key={s.id}
                      onClick={() => setSelectedId(p => p === s.id ? null : s.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer',
                        background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                        border: isActive ? `1px solid ${color}55` : '1px solid transparent',
                        transition: 'all 0.15s',
                      }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0,
                        boxShadow: isActive ? `0 0 5px ${color}` : 'none' }} />
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-600)', minWidth: '24px', fontWeight: 600 }}>#{s.finalRank}</span>
                      <span style={{ fontSize: '0.8rem', color: isActive ? color : 'var(--gray-400)',
                        fontWeight: isActive ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}{isMe ? ' (you)' : ''}
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
