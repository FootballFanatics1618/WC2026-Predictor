import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import GoldenBootPicker from '../components/GoldenBootPicker'
import { supabase } from '../lib/supabase'
import { format, parseISO, formatDistanceToNow } from 'date-fns'

const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',').map(e => e.trim())
  : []

const STAGE_ORDER = ['Group Stage','Round of 32','Round of 16','Quarter-final','Semi-final','3rd Place Play-off','Final']

export default function Admin() {
  const router = useRouter()
  const [user, setUser]             = useState(null)
  const [isAdmin, setIsAdmin]       = useState(false)
  const [matches, setMatches]       = useState([])
  const [resultForm, setResultForm] = useState({})
  const [saving, setSaving]         = useState({})
  const [goldenBootWinner, setGoldenBootWinner] = useState('')
  const [gbSaving, setGbSaving]     = useState(false)
  const [message, setMessage]       = useState('')
  const [activeStage, setActiveStage] = useState('Group Stage')
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('results') // 'results' | 'sync'
  // Sync state
  const [syncing, setSyncing]       = useState(false)
  const [syncLog, setSyncLog]       = useState([])
  const [syncLogLoading, setSyncLogLoading] = useState(false)
  const [lastSync, setLastSync]     = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)
    if (!ADMIN_EMAILS.includes(session.user.email)) { setLoading(false); return }
    setIsAdmin(true)
    await Promise.all([loadMatches(), loadSyncLog()])
    setLoading(false)
  }

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_date').order('match_time')
    setMatches(data || [])
  }

  const loadSyncLog = useCallback(async () => {
    setSyncLogLoading(true)
    const { data } = await supabase
      .from('sync_log')
      .select('*')
      .order('ran_at', { ascending: false })
      .limit(20)
    setSyncLog(data || [])
    if (data?.[0]) setLastSync(data[0])
    setSyncLogLoading(false)
  }, [])

  // ── Manual "Sync Now" — calls the edge function directly ─────────────────
  async function triggerSync() {
    setSyncing(true)
    setMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-scores?source=manual`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      )
      const result = await res.json()
      if (result.error) {
        setMessage(`❌ Sync failed: ${result.error}`)
      } else {
        setMessage(
          `✅ Sync complete — ${result.matchesUpdated} match(es) updated, ` +
          `${result.predictionsScored} predictions scored.` +
          (result.errors?.length ? ` ⚠️ ${result.errors.length} error(s).` : '')
        )
        await Promise.all([loadMatches(), loadSyncLog()])
      }
    } catch (err) {
      setMessage(`❌ Sync error: ${err.message}`)
    }
    setSyncing(false)
  }

  function handleResultInput(matchId, field, value) {
    setResultForm(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: value } }))
  }

  async function saveResult(match) {
    const form = resultForm[match.id]
    if (!form?.result || form.scoreA === undefined || form.scoreB === undefined || form.scoreA === '' || form.scoreB === '') {
      alert('Please fill in result and both scores.')
      return
    }
    setSaving(s => ({ ...s, [match.id]: true }))
    const scoreA = parseInt(form.scoreA)
    const scoreB = parseInt(form.scoreB)

    // Validate: result must match score direction
    const diff = scoreA - scoreB
    if (form.result === 'teamA' && diff <= 0) { alert("Score doesn't match Team A win"); setSaving(s => ({...s,[match.id]:false})); return }
    if (form.result === 'teamB' && diff >= 0) { alert("Score doesn't match Team B win"); setSaving(s => ({...s,[match.id]:false})); return }
    if (form.result === 'draw'  && diff !== 0) { alert("Score doesn't match Draw");      setSaving(s => ({...s,[match.id]:false})); return }

    // Write result — use sync_source='admin' to flag manual entry
    const { error: matchError } = await supabase.from('matches').update({
      result: form.result,
      score_a: scoreA,
      score_b: scoreB,
      sync_source: 'admin',
      auto_synced_at: new Date().toISOString(),
    }).eq('id', match.id)

    if (matchError) { alert('Save error: ' + matchError.message); setSaving(s => ({...s,[match.id]:false})); return }

    // Batch-score all predictions via DB function
    const { data: scoredCount, error: scoreErr } = await supabase
      .rpc('score_match_predictions', { p_match_id: match.id })

    if (scoreErr) {
      setMessage(`⚠️ Match saved but scoring failed: ${scoreErr.message}`)
    } else {
      setMessage(`✅ ${match.team_a} ${scoreA}–${scoreB} ${match.team_b} saved! ${scoredCount ?? 0} predictions scored.`)
    }

    // Knockout progression
    if (match.stage !== 'Group Stage') {
      await resolveKnockoutProgression(match, form.result, scoreA, scoreB)
    }

    await loadMatches()
    setSaving(s => ({ ...s, [match.id]: false }))
  }

  async function resolveKnockoutProgression(completedMatch, result, scoreA, scoreB) {
    const winner = result === 'teamA' ? completedMatch.team_a : completedMatch.team_b
    const loser  = result === 'teamA' ? completedMatch.team_b : completedMatch.team_a
    const { data: futureMatches } = await supabase
      .from('matches').select('*')
      .or(`team_a.ilike.%M${completedMatch.id}%,team_b.ilike.%M${completedMatch.id}%`)
    for (const fm of (futureMatches || [])) {
      const updates = {}
      if (fm.team_a?.includes(`M${completedMatch.id}`)) updates.team_a = fm.team_a.includes('Loser') ? loser : winner
      if (fm.team_b?.includes(`M${completedMatch.id}`)) updates.team_b = fm.team_b.includes('Loser') ? loser : winner
      if (Object.keys(updates).length > 0) await supabase.from('matches').update(updates).eq('id', fm.id)
    }
  }

  async function awardGoldenBoot() {
    if (!goldenBootWinner.trim()) { alert('Enter a player name.'); return }
    setGbSaving(true)
    const { data: winners } = await supabase.from('profiles').select('id').eq('golden_boot_pick', goldenBootWinner.trim())
    for (const w of (winners || [])) {
      await supabase.from('predictions').upsert({
        user_id: w.id, match_id: 9999,
        predicted_result: 'teamA', predicted_score_a: 0, predicted_score_b: 0,
        is_result_correct: true, is_score_correct: false, points_earned: 10,
      }, { onConflict: 'user_id,match_id' })
      await supabase.from('profiles').update({ golden_boot_correct: true }).eq('id', w.id)
    }
    setMessage(`🥇 Golden Boot awarded to ${goldenBootWinner}! ${winners?.length || 0} player(s) get +10 pts.`)
    setGbSaving(false)
  }

  if (loading) return <><Navbar user={user}/><div className="page" style={{textAlign:'center',paddingTop:'5rem',color:'var(--gray-500)'}}>Loading...</div></>

  if (!isAdmin) return (
    <><Navbar user={user}/>
    <div className="page" style={{textAlign:'center',paddingTop:'5rem',color:'var(--gray-500)'}}>
      <p>⛔ No admin access.</p>
    </div></>
  )

  const stageMatches   = matches.filter(m => m.stage === activeStage)
  const pendingInStage = stageMatches.filter(m => m.result === null)
  const doneInStage    = stageMatches.filter(m => m.result !== null)
  const totalDone      = matches.filter(m => m.result !== null).length
  const totalPending   = matches.filter(m => m.result === null).length

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">ADMIN PANEL</h1>

        {/* Summary bar */}
        <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.5rem',flexWrap:'wrap'}}>
          {[
            { label: 'Completed', value: totalDone, color: 'var(--success)' },
            { label: 'Pending',   value: totalPending, color: 'var(--gold)' },
            { label: 'Total',     value: 104, color: 'var(--gray-400)' },
          ].map(s => (
            <div key={s.label} className="card" style={{padding:'0.75rem 1.25rem',flex:'1',minWidth:'100px',textAlign:'center'}}>
              <div style={{fontSize:'1.6rem',fontWeight:800,color:s.color}}>{s.value}</div>
              <div style={{fontSize:'0.75rem',color:'var(--gray-500)',marginTop:'2px'}}>{s.label}</div>
            </div>
          ))}
          {lastSync && (
            <div className="card" style={{padding:'0.75rem 1.25rem',flex:'1',minWidth:'160px',textAlign:'center'}}>
              <div style={{fontSize:'0.85rem',fontWeight:700,color:'var(--white)'}}>
                {lastSync.matches_updated > 0 ? `✅ +${lastSync.matches_updated}` : '— No changes'}
              </div>
              <div style={{fontSize:'0.72rem',color:'var(--gray-500)',marginTop:'2px'}}>
                Last sync · {formatDistanceToNow(new Date(lastSync.ran_at), { addSuffix: true })}
              </div>
            </div>
          )}
        </div>

        {message && (
          <div className="alert alert-success" style={{marginBottom:'1.5rem'}}>
            {message}
            <button onClick={() => setMessage('')} style={{marginLeft:'1rem',background:'none',border:'none',color:'inherit',cursor:'pointer'}}>×</button>
          </div>
        )}

        {/* Top-level tabs */}
        <div className="tabs" style={{marginBottom:'1.5rem'}}>
          <button className={`tab-btn ${activeTab==='results'?'active':''}`} onClick={() => setActiveTab('results')}>
            Match Results
          </button>
          <button className={`tab-btn ${activeTab==='sync'?'active':''}`} onClick={() => { setActiveTab('sync'); loadSyncLog() }}>
            Auto-Sync
          </button>
          <button className={`tab-btn ${activeTab==='gb'?'active':''}`} onClick={() => setActiveTab('gb')}>
            Golden Boot
          </button>
        </div>

        {/* ── SYNC TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'sync' && (
          <div>
            <div className="card-gold" style={{marginBottom:'1.5rem'}}>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',color:'var(--gold)',marginBottom:'0.5rem'}}>
                🔄 SCORE SYNC
              </h2>
              <p style={{fontSize:'0.85rem',color:'var(--gray-400)',marginBottom:'1rem',lineHeight:'1.6'}}>
                The sync function runs automatically via pg_cron at 8 scheduled times per day —
                timed to fire ~30 min after each match window ends. No constant polling.
                Use <strong style={{color:'var(--white)'}}>Sync Now</strong> to trigger manually if a result seems delayed.
              </p>

              {/* Schedule display */}
              <div style={{background:'rgba(0,0,0,0.2)',borderRadius:'var(--radius)',padding:'0.875rem 1rem',marginBottom:'1.25rem',fontSize:'0.8rem',color:'var(--gray-400)',lineHeight:'1.8'}}>
                <div style={{color:'var(--gold)',fontWeight:700,marginBottom:'0.4rem',fontSize:'0.75rem',letterSpacing:'0.06em'}}>CRON SCHEDULE (UTC)</div>
                <div>18:30 · 18:50 — after 12:00 ET kick-offs</div>
                <div>21:30 · 21:50 — after 15:00 ET kick-offs</div>
                <div>00:30 · 00:50 — after 18:00 ET kick-offs</div>
                <div>03:30 · 03:50 — after 21:00 ET kick-offs</div>
                <div style={{marginTop:'0.4rem',color:'var(--gray-500)'}}>+ safety catchall every 3 hours</div>
              </div>

              <div style={{display:'flex',gap:'0.75rem',alignItems:'center',flexWrap:'wrap'}}>
                <button
                  className="btn btn-primary"
                  onClick={triggerSync}
                  disabled={syncing}
                  style={{minWidth:'140px'}}
                >
                  {syncing ? '⟳ Syncing...' : '🔄 Sync Now'}
                </button>
                <button
                  className="btn"
                  onClick={loadSyncLog}
                  disabled={syncLogLoading}
                  style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',color:'var(--gray-300)'}}
                >
                  {syncLogLoading ? 'Loading...' : 'Refresh Log'}
                </button>
                {lastSync && (
                  <span style={{fontSize:'0.8rem',color:'var(--gray-500)'}}>
                    Last run: {format(new Date(lastSync.ran_at), 'MMM d, HH:mm')} UTC
                    · source: <strong style={{color:'var(--gray-300)'}}>{lastSync.source}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Sync log table */}
            <h3 style={{fontFamily:'var(--font-display)',fontSize:'1.1rem',marginBottom:'0.75rem',color:'var(--white)'}}>
              RECENT SYNC RUNS
            </h3>
            {syncLog.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'2rem',color:'var(--gray-500)'}}>
                No sync runs yet. Cron will start once deployed.
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
                {/* Header */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 60px 60px 60px 80px',gap:'0.5rem',padding:'0.4rem 1rem',fontSize:'0.72rem',color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                  <span>Time</span><span>Checked</span><span>Updated</span><span>Source</span><span>Status</span>
                </div>
                {syncLog.map(row => (
                  <div key={row.id} className="card" style={{padding:'0.6rem 1rem',display:'grid',gridTemplateColumns:'1fr 60px 60px 60px 80px',gap:'0.5rem',alignItems:'center'}}>
                    <span style={{fontSize:'0.82rem',color:'var(--gray-300)'}}>
                      {format(new Date(row.ran_at), 'MMM d, HH:mm')}
                      <span style={{color:'var(--gray-500)',fontSize:'0.75rem'}}> · {formatDistanceToNow(new Date(row.ran_at), { addSuffix: true })}</span>
                    </span>
                    <span style={{fontSize:'0.82rem',textAlign:'center',color:'var(--gray-400)'}}>{row.matches_checked}</span>
                    <span style={{fontSize:'0.82rem',textAlign:'center',color: row.matches_updated > 0 ? 'var(--success)' : 'var(--gray-500)',fontWeight: row.matches_updated > 0 ? 700 : 400}}>
                      {row.matches_updated > 0 ? `+${row.matches_updated}` : '—'}
                    </span>
                    <span style={{fontSize:'0.75rem',color:'var(--gray-500)'}}>{row.source}</span>
                    <span style={{fontSize:'0.75rem'}}>
                      {row.errors
                        ? <span style={{color:'var(--danger)'}}>⚠ Error</span>
                        : <span style={{color:'var(--success)'}}>✓ OK</span>
                      }
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── GOLDEN BOOT TAB ───────────────────────────────────────────── */}
        {activeTab === 'gb' && (
          <div className="card-gold">
            <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',color:'var(--gold)',marginBottom:'0.75rem'}}>🥇 AWARD GOLDEN BOOT</h2>
            <p style={{fontSize:'0.85rem',color:'var(--gray-500)',marginBottom:'0.75rem'}}>
              Use only at end of tournament. All users who predicted this player get +10 pts.
            </p>
            <div style={{display:'flex',gap:'0.75rem',alignItems:'flex-end',flexWrap:'wrap'}}>
              <div style={{flex:1}}>
                <label className="form-label">Golden Boot Winner</label>
                <GoldenBootPicker value={goldenBootWinner} onChange={setGoldenBootWinner} placeholder="Search player or country..." />
              </div>
              <button className="btn btn-primary" onClick={awardGoldenBoot} disabled={gbSaving}>
                {gbSaving ? 'Awarding...' : 'Award +10 pts'}
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTS TAB ───────────────────────────────────────────────── */}
        {activeTab === 'results' && (
          <>
            {/* Stage tabs */}
            <div className="tabs" style={{overflowX:'auto',flexWrap:'nowrap',marginBottom:'1.5rem'}}>
              {STAGE_ORDER.map(s => {
                const cnt = matches.filter(m => m.stage === s && m.result === null).length
                return (
                  <button key={s} className={`tab-btn ${activeStage===s?'active':''}`} onClick={() => setActiveStage(s)} style={{whiteSpace:'nowrap',fontSize:'0.8rem'}}>
                    {s}
                    {cnt > 0 && <span style={{background:'var(--danger)',color:'#fff',borderRadius:'99px',padding:'1px 6px',fontSize:'0.7rem',marginLeft:'4px'}}>{cnt}</span>}
                  </button>
                )
              })}
            </div>

            {/* Pending matches */}
            <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',marginBottom:'0.75rem',color:'var(--white)'}}>
              PENDING ({pendingInStage.length})
              <span style={{fontSize:'0.78rem',fontFamily:'inherit',color:'var(--gray-500)',fontWeight:400,marginLeft:'0.75rem'}}>
                auto-sync fires after each match window · use override below if needed
              </span>
            </h2>

            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',marginBottom:'2rem'}}>
              {pendingInStage.length === 0 && (
                <div className="card" style={{textAlign:'center',padding:'2rem',color:'var(--gray-500)'}}>
                  All {activeStage} matches completed 🎉
                </div>
              )}
              {pendingInStage.map(match => {
                const form = resultForm[match.id] || {}
                const isKnockout = match.stage !== 'Group Stage'
                const teamsKnown = !['Winner','Runner','Best','Loser'].some(w =>
                  match.team_a.includes(w) || match.team_b.includes(w))
                const syncedByApi = match.sync_source === 'api'

                return (
                  <div key={match.id} className="card" style={{padding:'1rem 1.25rem',opacity: isKnockout && !teamsKnown ? 0.5 : 1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap'}}>
                      <div style={{flex:1,minWidth:'220px'}}>
                        <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:'0.15rem'}}>
                          {match.team_a} <span style={{color:'var(--gray-500)',fontWeight:400}}>vs</span> {match.team_b}
                        </div>
                        <div style={{fontSize:'0.78rem',color:'var(--gray-500)'}}>
                          {format(parseISO(match.match_date),'EEE MMM d')} · {match.match_time} · {match.stage}
                          {match.group_name && ` · Group ${match.group_name}`}
                        </div>
                        {isKnockout && !teamsKnown && (
                          <div style={{fontSize:'0.75rem',color:'var(--gold)',marginTop:'0.2rem'}}>⏳ Awaiting earlier results</div>
                        )}
                      </div>

                      {teamsKnown && <>
                        <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                          <label className="form-label" style={{fontSize:'0.7rem',margin:0}}>Result</label>
                          <select className="form-select" style={{width:'160px'}} value={form.result||''} onChange={e => handleResultInput(match.id,'result',e.target.value)}>
                            <option value="">— Result —</option>
                            <option value="teamA">{match.team_a} Win</option>
                            {match.stage === 'Group Stage' && <option value="draw">Draw</option>}
                            <option value="teamB">{match.team_b} Win</option>
                          </select>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                          <label className="form-label" style={{fontSize:'0.7rem',margin:0}}>{match.team_a.substring(0,3)}</label>
                          <input className="form-input" style={{width:'65px'}} type="number" min="0" value={form.scoreA??''} onChange={e => handleResultInput(match.id,'scoreA',e.target.value)}/>
                        </div>
                        <span style={{color:'var(--gray-500)',marginTop:'18px'}}>–</span>
                        <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                          <label className="form-label" style={{fontSize:'0.7rem',margin:0}}>{match.team_b.substring(0,3)}</label>
                          <input className="form-input" style={{width:'65px'}} type="number" min="0" value={form.scoreB??''} onChange={e => handleResultInput(match.id,'scoreB',e.target.value)}/>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => saveResult(match)} disabled={saving[match.id]} style={{marginTop:'18px'}}>
                          {saving[match.id] ? 'Saving...' : 'Override'}
                        </button>
                      </>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Completed matches */}
            {doneInStage.length > 0 && (
              <>
                <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',marginBottom:'0.75rem',color:'var(--white)'}}>
                  COMPLETED ({doneInStage.length})
                </h2>
                <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
                  {doneInStage.map(m => (
                    <div key={m.id} className="card" style={{padding:'0.6rem 1.25rem',opacity:0.65,display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.5rem',flexWrap:'wrap'}}>
                      <span style={{fontSize:'0.875rem'}}>{m.team_a} vs {m.team_b}</span>
                      <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
                        <span className="match-result-badge">{m.score_a}–{m.score_b}</span>
                        {m.sync_source && (
                          <span style={{fontSize:'0.7rem',color: m.sync_source==='api' ? 'var(--success)' : 'var(--gold)',background:'rgba(255,255,255,0.05)',padding:'2px 6px',borderRadius:'4px'}}>
                            {m.sync_source === 'api' ? '⚡ auto' : '✏ manual'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
