import { useState } from 'react'
import { ALL_PLAYERS, PLAYER_TEAM_MAP } from '../lib/data'
import { FLAG_CODES } from '../lib/flags'

export default function GoldenBootPicker({ value, onChange, disabled = false, placeholder = 'Search player or country...' }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = ALL_PLAYERS.filter(p =>
    p.toLowerCase().includes(search.toLowerCase()) ||
    (PLAYER_TEAM_MAP[p] || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 60)

  function select(player) {
    onChange(player)
    setSearch('')
    setOpen(false)
  }

  if (disabled) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius)', padding: '0.6rem 0.875rem', opacity: 0.7,
      }}>
        {value && FLAG_CODES[PLAYER_TEAM_MAP[value]] && (
          <img src={`https://flagcdn.com/20x15/${FLAG_CODES[PLAYER_TEAM_MAP[value]]}.png`} alt="" style={{ borderRadius: '2px' }} />
        )}
        <span style={{ flex: 1, color: 'var(--white)' }}>{value || '—'}</span>
        {value && <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{PLAYER_TEAM_MAP[value]}</span>}
        <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>🔒 Locked</span>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 'var(--radius)', padding: '0.6rem 0.875rem', cursor: 'text',
          borderColor: open ? 'var(--gold)' : 'rgba(255,255,255,0.15)',
        }}
        onClick={() => setOpen(true)}
      >
        {value && !open ? (
          <>
            {FLAG_CODES[PLAYER_TEAM_MAP[value]] && (
              <img src={`https://flagcdn.com/20x15/${FLAG_CODES[PLAYER_TEAM_MAP[value]]}.png`} alt="" style={{ borderRadius: '2px', flexShrink: 0 }} />
            )}
            <span style={{ flex: 1, color: 'var(--white)', fontSize: '0.9rem' }}>{value}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{PLAYER_TEAM_MAP[value]}</span>
            <span style={{ color: 'var(--gray-500)', marginLeft: '4px' }}>▾</span>
          </>
        ) : (
          <input
            autoFocus={open}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--white)', fontSize: '0.9rem', width: '100%' }}
            placeholder={placeholder}
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
        )}
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
            background: '#1e1e1a', border: '1px solid rgba(245,200,66,0.3)',
            borderRadius: 'var(--radius)', maxHeight: '240px', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {filtered.length === 0
              ? <div style={{ padding: '1rem', color: 'var(--gray-500)', textAlign: 'center', fontSize: '0.875rem' }}>No players found</div>
              : filtered.map(player => {
                const team = PLAYER_TEAM_MAP[player]
                const code = FLAG_CODES[team]
                return (
                  <div key={player} onClick={() => select(player)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '0.55rem 0.875rem', cursor: 'pointer',
                    background: value === player ? 'rgba(245,200,66,0.1)' : 'transparent',
                    borderLeft: value === player ? '2px solid var(--gold)' : '2px solid transparent',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = value === player ? 'rgba(245,200,66,0.1)' : 'transparent'}
                  >
                    {code && <img src={`https://flagcdn.com/20x15/${code}.png`} alt={team} style={{ borderRadius: '2px', flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--white)' }}>{player}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{team}</span>
                  </div>
                )
              })
            }
          </div>
        </>
      )}
    </div>
  )
}
