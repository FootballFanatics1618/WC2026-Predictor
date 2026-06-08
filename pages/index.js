import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import { supabase } from '../lib/supabase'
import { ALL_PLAYERS } from '../lib/data'
import { isGoldenBootLocked, GOLDEN_BOOT_LOCK } from '../lib/locktime'

export default function Home() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [gbPick, setGbPick] = useState('')
  const [gbSearch, setGbSearch] = useState('')
  const [gbOpen, setGbOpen] = useState(false)
  const [gbSaving, setGbSaving] = useState(false)
  const [gbMessage, setGbMessage] = useState('')
  const [gbLocked, setGbLocked] = useState(false)
  const dropRef = useRef(null)
  const sortedPlayers = [...ALL_PLAYERS].sort()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
    })
    setGbLocked(isGoldenBootLocked())
    // Check every minute if lock time has passed
    const t = setInterval(() => setGbLocked(isGoldenBootLocked()), 60000)
    return () => clearInterval(t)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setGbOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function loadProfile(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data)
    setGbPick(data?.golden_boot_pick || '')
    setGbSearch(data?.golden_boot_pick || '')
  }

  const filteredPlayers = gbSearch.length > 0
    ? sortedPlayers.filter(p => p.toLowerCase().includes(gbSearch.toLowerCase()))
    : sortedPlayers

  async function saveGoldenBoot() {
    if (!gbPick) { setGbMessage('❌ Please select a player first.'); return }
    if (gbLocked) { setGbMessage('🔒 Golden Boot picks are locked.'); return }
    setGbSaving(true)
    const { error } = await supabase.from('profiles').update({ golden_boot_pick: gbPick }).eq('id', user.id)
    if (error) { setGbMessage('❌ Error saving: ' + error.message) }
    else { setGbMessage('✅ Golden Boot pick saved!'); setProfile(p => ({ ...p, golden_boot_pick: gbPick })) }
    setGbSaving(false)
    setTimeout(() => setGbMessage(''), 3000)
  }

  // Get flag URL for a player (try to find their country from squads)
  function PlayerOption({ name }) {
    // No per-player flag — just show the name nicely
    return <span>{name}</span>
  }

  return (
    <>
      <Navbar user={user} />
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <Image src="/ff-logo.jpg" alt="Football Fanatics" width={100} height={100}
            style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--gold)' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--gray-500)', letterSpacing: '0.12em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Football Fanatics</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 8vw, 3.5rem)', color: 'var(--gold)', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          WORLD CUP 2026
        </h1>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.2rem, 5vw, 2rem)', color: 'var(--white)', letterSpacing: '0.04em', marginBottom: '1.5rem' }}>
          PREDICTOR LEAGUE
        </h2>
        <p style={{ color: 'var(--gray-300)', fontSize: '1rem', maxWidth: '520px', margin: '0 auto 2rem', lineHeight: 1.7, padding: '0 1rem' }}>
          Predict results across all 48 teams. Compete with friends, climb the leaderboard, and call the Golden Boot winner.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '3rem' }}>
          {user ? (
            <>
              <Link href="/predict" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}>Make Predictions →</Link>
              <Link href="/leaderboard" className="btn btn-ghost" style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}>Leaderboard</Link>
            </>
          ) : (
            <>
              <Link href="/signup" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}>Join the League →</Link>
              <Link href="/login" className="btn btn-ghost" style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}>Sign In</Link>
            </>
          )}
        </div>

        {/* Golden Boot picker — shown only when logged in */}
        {user && profile && (
          <div style={{ maxWidth: '500px', margin: '0 auto 3rem', textAlign: 'left' }}>
            <div className="card-gold">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--gold)', letterSpacing: '0.05em' }}>
                  🥇 GOLDEN BOOT PICK
                </div>
                {gbLocked
                  ? <span className="lock-chip">🔒 Locked</span>
                  : <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Locks Jun 11, 11:30 PM IST</span>
                }
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginBottom: '0.9rem' }}>
                Pick the player you think will be the tournament's top scorer. Worth <strong style={{ color: 'var(--gold)' }}>+10 pts</strong> if correct.
              </p>

              {gbLocked ? (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius)', fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600 }}>
                  {profile.golden_boot_pick || <span style={{ color: 'var(--gray-500)' }}>No pick made before lock</span>}
                </div>
              ) : (
                <>
                  {/* Searchable dropdown */}
                  <div style={{ position: 'relative', marginBottom: '0.75rem' }} ref={dropRef}>
                    <input
                      className="form-input"
                      placeholder="Search player name..."
                      value={gbSearch}
                      onChange={e => { setGbSearch(e.target.value); setGbPick(''); setGbOpen(true) }}
                      onFocus={() => setGbOpen(true)}
                      style={{ paddingRight: '2.5rem' }}
                    />
                    {gbPick && (
                      <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--success)', fontWeight: 700, fontSize: '1rem' }}>✓</span>
                    )}
                    {gbOpen && filteredPlayers.length > 0 && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: 'var(--gray-900)', border: '1px solid rgba(245,200,66,0.3)',
                        borderRadius: 'var(--radius)', maxHeight: '220px', overflowY: 'auto',
                        zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      }}>
                        {filteredPlayers.slice(0, 80).map(p => (
                          <div
                            key={p}
                            onClick={() => { setGbPick(p); setGbSearch(p); setGbOpen(false) }}
                            style={{
                              padding: '0.55rem 0.9rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: gbPick === p ? 'var(--gold)' : 'var(--white)',
                              background: gbPick === p ? 'rgba(245,200,66,0.08)' : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = gbPick === p ? 'rgba(245,200,66,0.08)' : 'transparent'}
                          >
                            <span>{p}</span>
                            {gbPick === p && <span style={{ color: 'var(--gold)' }}>✓</span>}
                          </div>
                        ))}
                        {filteredPlayers.length > 80 && (
                          <div style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--gray-500)', textAlign: 'center' }}>
                            Type more to narrow results ({filteredPlayers.length} players)
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {gbMessage && (
                    <div className={`alert ${gbMessage.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '0.75rem' }}>{gbMessage}</div>
                  )}

                  <button
                    className="btn btn-primary btn-full"
                    onClick={saveGoldenBoot}
                    disabled={gbSaving || !gbPick}
                  >
                    {gbSaving ? 'Saving...' : profile.golden_boot_pick ? `Update Pick (currently: ${profile.golden_boot_pick})` : 'Save Golden Boot Pick'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Points explainer */}
        <div className="grid-3" style={{ maxWidth: '700px', margin: '0 auto', padding: '0 1rem' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🎯</div>
            <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>+3 pts</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Correct result</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>⚡</div>
            <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>+2 pts bonus</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Correct scoreline</div>
          </div>
          <div className="card-gold" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🥇</div>
            <div style={{ fontWeight: 700, marginBottom: '0.2rem', color: 'var(--gold)' }}>+10 pts</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Golden Boot</div>
          </div>
        </div>
      </div>
    </>
  )
}
