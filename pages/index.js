import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '../components/Navbar'
import FlagImg from '../components/FlagImg'
import ScoringModal from '../components/ScoringModal'
import { supabase } from '../lib/supabase'
import { ALL_PLAYERS } from '../lib/data'
import { isGoldenBootLocked, GOLDEN_BOOT_LOCK } from '../lib/locktime'
import { useServerTime } from '../hooks/useServerTime'

const pad = '0.5rem 0.6rem'
const th = { padding: pad, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-500)' }
const td = { padding: pad, fontSize: '0.8rem', color: 'var(--gray-400)', borderBottom: '1px solid rgba(255,255,255,0.04)' }
const tdBold = { ...td, color: 'var(--white)', fontWeight: 600, whiteSpace: 'nowrap' }
const tdScenario = { padding: pad, fontSize: '0.8rem', color: 'var(--gray-400)', borderBottom: '1px solid rgba(255,255,255,0.04)', overflowWrap: 'break-word' }
const tdPts = { ...td, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }
const sectionTitle = { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold)' }

function ScoringSection({ title, grid, header, subtitle, children }) {
  return (
    <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ ...sectionTitle, padding: pad }}>{title}</div>
      {subtitle && <div style={{ padding: '0.6rem 0.6rem 0.4rem', fontSize: '0.78rem', color: 'var(--gray-500)' }}>{subtitle}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: grid }}>
        {header.map((h, i) => (
          <span key={i} style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: i === header.length - 1 ? 'right' : 'left' }}>{h}</span>
        ))}
        {children}
      </div>
    </div>
  )
}

export default function Home() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [gbPick, setGbPick] = useState('')
  const [gbSearch, setGbSearch] = useState('')
  const [gbOpen, setGbOpen] = useState(false)
  const [gbSaving, setGbSaving] = useState(false)
  const [gbMessage, setGbMessage] = useState('')
  const [gbLocked, setGbLocked] = useState(false)
  const [scoringTab, setScoringTab] = useState('logic')
  const { serverNow } = useServerTime()
  const dropRef = useRef(null)
  const sortedPlayers = [...ALL_PLAYERS].sort()

  // Golden Boot tracker state
  const [scorers, setScorers] = useState([])
  const [scorersLoading, setScorersLoading] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
    })
    setGbLocked(isGoldenBootLocked(serverNow()))
    const t = setInterval(() => setGbLocked(isGoldenBootLocked(serverNow())), 60000)
    return () => clearInterval(t)
  }, [])

  // Load scorers data
  useEffect(() => {
    loadScorers()
  }, [profile])

  async function loadScorers() {
    setScorersLoading(true)
    const [scorersRes, syncRes] = await Promise.all([
      supabase.from('goal_tracker').select('player_name, goals').order('goals', { ascending: false }).limit(30),
      supabase.from('sync_meta').select('value').eq('key', 'scorers_last_sync').single(),
    ])
    setScorers(scorersRes.data || [])
    setLastSync(syncRes.data?.value || null)
    setScorersLoading(false)
  }

  async function syncScorers() {
    setSyncing(true)
    const { error } = await supabase.functions.invoke('sync-scorers')
    if (!error) await loadScorers()
    setSyncing(false)
  }

  function formatSyncTime(iso) {
    if (!iso || iso === 'never') return null
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  function findPickGoals(pick) {
    if (!pick || !scorers.length) return 0
    const pickLower = pick.toLowerCase().trim()
    // Exact match
    const exact = scorers.find(s => s.player_name.toLowerCase().trim() === pickLower)
    if (exact) return exact.goals
    // Last name match
    const pickLast = pickLower.split(' ').pop()
    const fuzzy = scorers.find(s => {
      const name = s.player_name.toLowerCase().trim()
      return name.includes(pickLast) || pickLower.includes(name.split(' ').pop())
    })
    return fuzzy ? fuzzy.goals : 0
  }

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
      <ScoringModal user={user} />
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

              {/* Golden Boot live tracker */}
              {scorers.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(245,200,66,0.15)', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold)' }}>
                      🏆 Golden Boot Leader
                    </div>
                    <a href="https://footballfanatics1618.github.io/WC2026-Predictor/#tab-golden-boot" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--gold)', textDecoration: 'none', cursor: 'pointer' }}>
                      View full list →
                    </a>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.25rem' }}>
                    {scorers[0].player_name} ({scorers[0].goals} goals)
                  </div>
                  {profile.golden_boot_pick && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                      Your pick: <strong>{profile.golden_boot_pick}</strong> ({findPickGoals(profile.golden_boot_pick)} goals)
                      {scorers[0].goals > findPickGoals(profile.golden_boot_pick) && (
                        <span style={{ color: 'var(--gold)' }}>
                          {' — '}{scorers[0].goals - findPickGoals(profile.golden_boot_pick)} behind
                        </span>
                      )}
                      {scorers[0].goals === findPickGoals(profile.golden_boot_pick) && (
                        <span style={{ color: 'var(--success)' }}> — Tied for lead!</span>
                      )}
                    </div>
                  )}
                  {formatSyncTime(lastSync) && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: '0.4rem' }}>
                      Last synced: {formatSyncTime(lastSync)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Points overview cards */}
        <div style={{ maxWidth: '700px', margin: '0 auto 2rem', padding: '0 1rem' }}>
          <div className="grid-3" style={{ marginBottom: '0.75rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🎯</div>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>+3 pts</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Correct result</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>⚡</div>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>+5 pts</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Correct result + correct score</div>
            </div>
            <div className="card-gold" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🥇</div>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem', color: 'var(--gold)' }}>+10 pts</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Golden Boot</div>
            </div>
          </div>
          <div className="grid-3">
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🔄</div>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>+4 pts</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Knockout: correct score, wrong result</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🤝</div>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>+2 pts</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Knockout: correct draw, wrong score & result</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>✅</div>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>+1 pt</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Knockout: correct result only</div>
            </div>
          </div>
        </div>

        {/* Points explainer */}
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '0 1rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }}>
            <button onClick={() => setScoringTab('logic')} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', border: 'none', background: scoringTab === 'logic' ? 'rgba(255,255,255,0.08)' : 'transparent', color: scoringTab === 'logic' ? 'var(--white)' : 'var(--gray-500)', transition: 'all 0.15s' }}>Logic</button>
            <button onClick={() => setScoringTab('example')} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', border: 'none', background: scoringTab === 'example' ? 'rgba(255,255,255,0.08)' : 'transparent', color: scoringTab === 'example' ? 'var(--white)' : 'var(--gray-500)', transition: 'all 0.15s' }}>Example</button>
          </div>

          {scoringTab === 'logic' ? (
            <>
              <ScoringSection title="Group Stage (unchanged)" grid="1fr auto" header={['Prediction', 'Points']}>
                <span style={td}>Correct result</span><span style={tdPts}>+3</span>
                <span style={td}>Correct result + correct score</span><span style={tdPts}>+5</span>
              </ScoringSection>
              <ScoringSection title="Knockout — Draw (Penalties)" grid="auto 1fr auto" header={['Prediction', 'Scenario', 'Points']}>
                <span style={tdBold}>Draw</span><span style={tdScenario}>Correct result + correct winner</span><span style={tdPts}>+5</span>
                <span style={tdBold}>Draw</span><span style={tdScenario}>Correct score, wrong winner</span><span style={tdPts}>+4</span>
                <span style={tdBold}>Draw</span><span style={tdScenario}>Wrong score, correct winner</span><span style={tdPts}>+3</span>
                <span style={tdBold}>Draw</span><span style={tdScenario}>Wrong score, wrong winner</span><span style={tdPts}>+2</span>
                <span style={tdBold}>Outright</span><span style={tdScenario}>Correct winner</span><span style={tdPts}>+1</span>
                <span style={tdBold}>Outright</span><span style={tdScenario}>Wrong winner</span><span style={tdPts}>0</span>
              </ScoringSection>
              <ScoringSection title="Knockout — Outright Win" grid="auto 1fr auto" header={['Prediction', 'Scenario', 'Points']}>
                <span style={tdBold}>Outright</span><span style={tdScenario}>Correct result + correct score</span><span style={tdPts}>+5</span>
                <span style={tdBold}>Outright</span><span style={tdScenario}>Correct result, wrong score</span><span style={tdPts}>+3</span>
                <span style={tdBold}>Outright</span><span style={tdScenario}>Wrong result</span><span style={tdPts}>0</span>
                <span style={tdBold}>Draw</span><span style={tdScenario}>Correct winner</span><span style={tdPts}>+1</span>
                <span style={tdBold}>Draw</span><span style={tdScenario}>Wrong winner</span><span style={tdPts}>0</span>
              </ScoringSection>
            </>
          ) : (
            <>
              <ScoringSection title="Group Stage" grid="1fr auto" header={['You picked', 'Points']}
                subtitle={<>Brazil vs Serbia — <strong>Brazil Win 2-0</strong></>}>
                <span style={td}>Brazil 2-0 (exact)</span><span style={tdPts}>+5</span>
                <span style={td}>Brazil 1-0 (right team)</span><span style={tdPts}>+3</span>
                <span style={td}>Serbia 1-0 (wrong team)</span><span style={tdPts}>0</span>
              </ScoringSection>
              <ScoringSection title="Knockout — Draw (Penalties)" grid="auto 1fr auto" header={['You picked', 'What happened', 'Points']}
                subtitle={<>France vs Argentina — ends <strong>1-1, France win on pens</strong></>}>
                <span style={tdBold}>Draw 1-1, France</span><span style={tdScenario}>Score ✓ winner ✓</span><span style={tdPts}>+5</span>
                <span style={tdBold}>Draw 1-1, Argentina</span><span style={tdScenario}>Score ✓ winner ✗</span><span style={tdPts}>+4</span>
                <span style={tdBold}>Draw 2-2, France</span><span style={tdScenario}>Score ✗ winner ✓</span><span style={tdPts}>+3</span>
                <span style={tdBold}>Draw 2-2, Argentina</span><span style={tdScenario}>Score ✗ winner ✗</span><span style={tdPts}>+2</span>
                <span style={tdBold}>France 2-0</span><span style={tdScenario}>Outright — right winner</span><span style={tdPts}>+1</span>
                <span style={tdBold}>Argentina 3-1</span><span style={tdScenario}>Outright — wrong winner</span><span style={tdPts}>0</span>
              </ScoringSection>
              <ScoringSection title="Knockout — Outright Win" grid="auto 1fr auto" header={['You picked', 'What happened', 'Points']}
                subtitle={<>Brazil vs Croatia — <strong>Brazil win 4-1</strong></>}>
                <span style={tdBold}>Brazil 4-1</span><span style={tdScenario}>Exact match</span><span style={tdPts}>+5</span>
                <span style={tdBold}>Brazil 2-0</span><span style={tdScenario}>Right team, wrong score</span><span style={tdPts}>+3</span>
                <span style={tdBold}>Croatia 1-0</span><span style={tdScenario}>Wrong team</span><span style={tdPts}>0</span>
                <span style={tdBold}>Draw 1-1, Brazil</span><span style={tdScenario}>Right winner (Brazil)</span><span style={tdPts}>+1</span>
                <span style={tdBold}>Draw 2-2, Croatia</span><span style={tdScenario}>Wrong winner (Croatia)</span><span style={tdPts}>0</span>
              </ScoringSection>
            </>
          )}
        </div>
      </div>
    </>
  )
}
