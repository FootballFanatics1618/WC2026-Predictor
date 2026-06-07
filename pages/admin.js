import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

const ADMIN_EMAILS = ['your-email@gmail.com', 'admin589@gmail.com']
const STAGE_ORDER = ['Group Stage','Round of 32','Round of 16','Quarter-final','Semi-final','3rd Place Play-off','Final']

// Group teams — must match data.js
const GROUP_TEAMS = {
  A:["Mexico","South Korea","Czechia","South Africa"],
  B:["Switzerland","Canada","Qatar","Bosnia and Herzegovina"],
  C:["Brazil","Morocco","Haiti","Scotland"],
  D:["USA","Turkey","Australia","Paraguay"],
  E:["Germany","Ecuador","Ivory Coast","Curacao"],
  F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Egypt","Iran","New Zealand"],
  H:["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I:["France","Senegal","Iraq","Norway"],
  J:["Argentina","Algeria","Austria","Jordan"],
  K:["Portugal","DR Congo","Uzbekistan","Colombia"],
  L:["England","Croatia","Ghana","Panama"],
}

// Sort group standing entries
function sortStandings(rows) {
  return [...rows].sort((a,b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.goals_for - a.goals_against
    const gdB = b.goals_for - b.goals_against
    if (gdB !== gdA) return gdB - gdA
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
    return a.team.localeCompare(b.team)
  })
}

export default function Admin() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [matches, setMatches] = useState([])
  const [standings, setStandings] = useState([]) // flat list from DB
  const [resultForm, setResultForm] = useState({})
  const [saving, setSaving] = useState({})
  const [goldenBootWinner, setGoldenBootWinner] = useState('')
  const [gbSaving, setGbSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeStage, setActiveStage] = useState('Group Stage')
  const [loading, setLoading] = useState(true)
  const [showStandings, setShowStandings] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)
    if (!ADMIN_EMAILS.includes(session.user.email)) { setLoading(false); return }
    setIsAdmin(true)
    await Promise.all([loadMatches(), loadStandings()])
    setLoading(false)
  }

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_date').order('match_time')
    setMatches(data || [])
  }

  async function loadStandings() {
    const { data } = await supabase.from('group_standings').select('*').order('group_name').order('points', { ascending: false })
    setStandings(data || [])
  }

  function handleResultInput(matchId, field, value) {
    setResultForm(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: value } }))
  }

  async function saveResult(match) {
    const form = resultForm[match.id]
    if (!form?.result || form.scoreA === undefined || form.scoreB === undefined || form.scoreA === '' || form.scoreB === '') {
      alert('Fill in result, score A and score B.'); return
    }
    setSaving(s => ({ ...s, [match.id]: true }))
    const scoreA = parseInt(form.scoreA)
    const scoreB = parseInt(form.scoreB)

    const diff = scoreA - scoreB
    if (form.result === 'teamA' && diff <= 0) { alert("Score doesn't match Team A win"); setSaving(s=>({...s,[match.id]:false})); return }
    if (form.result === 'teamB' && diff >= 0) { alert("Score doesn't match Team B win"); setSaving(s=>({...s,[match.id]:false})); return }
    if (form.result === 'draw' && diff !== 0) { alert("Score doesn't match Draw"); setSaving(s=>({...s,[match.id]:false})); return }

    // Save result to match
    const { error: mErr } = await supabase.from('matches').update({
      result: form.result, score_a: scoreA, score_b: scoreB,
    }).eq('id', match.id)
    if (mErr) { alert('Error: ' + mErr.message); setSaving(s=>({...s,[match.id]:false})); return }

    // Score predictions
    const { data: preds } = await supabase.from('predictions').select('*').eq('match_id', match.id)
    for (const pred of (preds || [])) {
      const rc = pred.predicted_result === form.result
      const sc = rc && pred.predicted_score_a === scoreA && pred.predicted_score_b === scoreB
      await supabase.from('predictions').update({
        is_result_correct: rc, is_score_correct: sc, points_earned: sc ? 5 : rc ? 3 : 0,
      }).eq('id', pred.id)
    }

    // Update group standings if group stage match
    if (match.stage === 'Group Stage' && match.group_name) {
      await updateGroupStandings(match, form.result, scoreA, scoreB)
    }

    // Knockout progression
    if (match.stage !== 'Group Stage') {
      await resolveKnockoutProgression(match, form.result)
    }

    // After group stage fully done, propagate all group winners/runners to R32
    const { data: freshMatches } = await supabase.from('matches').select('*').order('match_date').order('match_time')
    const groupDone = (freshMatches || []).filter(m => m.stage === 'Group Stage' && m.result !== null).length
    if (match.stage === 'Group Stage' && groupDone === 72) {
      await propagateAllGroupWinners(freshMatches || [])
    }

    setMessage(`✅ ${match.team_a} ${scoreA}–${scoreB} ${match.team_b} saved! ${preds?.length || 0} predictions scored.`)
    await Promise.all([loadMatches(), loadStandings()])
    setSaving(s => ({ ...s, [match.id]: false }))
  }

  async function updateGroupStandings(match, result, scoreA, scoreB) {
    const g = match.group_name
    const tA = match.team_a
    const tB = match.team_b

    // Fetch current standings for these two teams
    const { data: rows } = await supabase.from('group_standings')
      .select('*').eq('group_name', g).in('team', [tA, tB])

    const rowA = rows?.find(r => r.team === tA) || { played:0,won:0,drawn:0,lost:0,goals_for:0,goals_against:0,points:0 }
    const rowB = rows?.find(r => r.team === tB) || { played:0,won:0,drawn:0,lost:0,goals_for:0,goals_against:0,points:0 }

    const newA = { ...rowA, played: rowA.played+1, goals_for: rowA.goals_for+scoreA, goals_against: rowA.goals_against+scoreB }
    const newB = { ...rowB, played: rowB.played+1, goals_for: rowB.goals_for+scoreB, goals_against: rowB.goals_against+scoreA }

    if (result === 'teamA') { newA.won++; newA.points+=3; newB.lost++ }
    else if (result === 'teamB') { newB.won++; newB.points+=3; newA.lost++ }
    else { newA.drawn++; newA.points++; newB.drawn++; newB.points++ }

    await supabase.from('group_standings').upsert([
      { group_name:g, team:tA, ...newA, updated_at: new Date().toISOString() },
      { group_name:g, team:tB, ...newB, updated_at: new Date().toISOString() },
    ], { onConflict: 'group_name,team' })
  }

  async function resolveKnockoutProgression(completedMatch, result) {
    const winner = result === 'teamA' ? completedMatch.team_a : completedMatch.team_b
    const loser  = result === 'teamA' ? completedMatch.team_b : completedMatch.team_a
    const id = completedMatch.id

    const { data: future } = await supabase.from('matches').select('*')
      .or(`team_a.ilike.%M${id}%,team_b.ilike.%M${id}%`)

    for (const fm of (future || [])) {
      const upd = {}
      if (fm.team_a && fm.team_a.includes(`M${id}`)) upd.team_a = fm.team_a.includes('Loser') ? loser : winner
      if (fm.team_b && fm.team_b.includes(`M${id}`)) upd.team_b = fm.team_b.includes('Loser') ? loser : winner
      if (Object.keys(upd).length > 0) await supabase.from('matches').update(upd).eq('id', fm.id)
    }
  }

  // After ALL 72 group stage matches done, resolve R32 group-based slots
  async function propagateAllGroupWinners(allMatches) {
    const groups = Object.keys(GROUP_TEAMS)
    const { data: standingRows } = await supabase.from('group_standings').select('*')

    // Build sorted standings per group
    const groupSorted = {}
    for (const g of groups) {
      const rows = (standingRows || []).filter(r => r.group_name === g)
      groupSorted[g] = sortStandings(rows)
    }

    // Collect all third-placed teams, sort to find best 8
    const thirds = groups.map(g => {
      const t = groupSorted[g][2]
      if (!t) return null
      return { team: t.team, group: g, points: t.points, gd: t.goals_for - t.goals_against, gf: t.goals_for }
    }).filter(Boolean)

    thirds.sort((a,b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.gf !== a.gf) return b.gf - a.gf
      return a.group.localeCompare(b.group)
    })

    // Build slot → team map for R32 placeholder text
    // Slot text in matches: "Winner A", "Runner-up B", "Best 3rd (A/B/C/D/F)"
    const slotMap = {}
    for (const g of groups) {
      slotMap[`Winner ${g}`] = groupSorted[g][0]?.team
      slotMap[`Runner-up ${g}`] = groupSorted[g][1]?.team
    }

    // For Best 3rd slots, assign best remaining 3rd placed teams in order
    const best3rds = [...thirds]

    // Update R32 matches that still have placeholder text
    const r32 = allMatches.filter(m => m.stage === 'Round of 32' && m.result === null)
    for (const m of r32) {
      const upd = {}
      const newA = resolveGroupSlot(m.team_a, slotMap, best3rds)
      const newB = resolveGroupSlot(m.team_b, slotMap, best3rds)
      if (newA) upd.team_a = newA
      if (newB) upd.team_b = newB
      if (Object.keys(upd).length > 0) await supabase.from('matches').update(upd).eq('id', m.id)
    }
  }

  function resolveGroupSlot(placeholder, slotMap, best3rds) {
    if (!placeholder) return null
    if (slotMap[placeholder]) return slotMap[placeholder]
    if (placeholder.startsWith('Best 3rd')) {
      // Extract allowed groups e.g. "Best 3rd (A/B/C/D/F)"
      const match = placeholder.match(/\(([^)]+)\)/)
      if (match) {
        const allowed = match[1].split('/').map(s => s.trim())
        const pick = best3rds.find(t => allowed.includes(t.group))
        if (pick) {
          best3rds.splice(best3rds.indexOf(pick), 1) // consume it
          return pick.team
        }
      }
      // Fallback: pick first remaining best 3rd
      if (best3rds.length > 0) { const p = best3rds.shift(); return p.team }
    }
    return null
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
    setMessage(`🥇 Golden Boot: ${goldenBootWinner}! ${winners?.length || 0} players get +10 pts.`)
    setGbSaving(false)
  }

  if (loading) return <><Navbar user={user}/><div className="page" style={{textAlign:'center',paddingTop:'5rem',color:'var(--gray-500)'}}>Loading...</div></>
  if (!isAdmin) return <><Navbar user={user}/><div className="page" style={{textAlign:'center',paddingTop:'5rem',color:'var(--gray-500)'}}>⛔ No admin access.</div></>

  const stageMatches = matches.filter(m => m.stage === activeStage)
  const pendingInStage = stageMatches.filter(m => m.result === null)
  const doneInStage = stageMatches.filter(m => m.result !== null)
  const totalDone = matches.filter(m => m.result !== null).length

  // Group standings by group for display
  const groups = Object.keys(GROUP_TEAMS)
  const standingsByGroup = {}
  groups.forEach(g => {
    standingsByGroup[g] = sortStandings(standings.filter(s => s.group_name === g))
  })

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">ADMIN PANEL</h1>
        <p style={{color:'var(--gray-500)',marginBottom:'1rem',fontSize:'0.9rem'}}>
          {totalDone}/104 matches completed. Entering a result immediately scores all predictions and updates standings.
        </p>

        {message && <div className="alert alert-success" style={{marginBottom:'1.5rem'}}>{message}<button onClick={()=>setMessage('')} style={{marginLeft:'1rem',background:'none',border:'none',color:'inherit',cursor:'pointer'}}>×</button></div>}

        {/* Golden Boot */}
        <div className="card-gold" style={{marginBottom:'2rem'}}>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',color:'var(--gold)',marginBottom:'0.75rem'}}>🥇 AWARD GOLDEN BOOT</h2>
          <p style={{fontSize:'0.82rem',color:'var(--gray-500)',marginBottom:'0.75rem'}}>End of tournament only. Users who picked this player get +10 pts.</p>
          <div style={{display:'flex',gap:'0.75rem',alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:1}}>
              <label className="form-label">Golden Boot Winner (exact spelling)</label>
              <input className="form-input" value={goldenBootWinner} onChange={e=>setGoldenBootWinner(e.target.value)} placeholder="e.g. Erling Haaland"/>
            </div>
            <button className="btn btn-primary" onClick={awardGoldenBoot} disabled={gbSaving}>{gbSaving?'Awarding...':'Award +10 pts'}</button>
          </div>
        </div>

        {/* Stage tabs */}
        <div style={{overflowX:'auto',marginBottom:'1.5rem'}}>
          <div className="tabs" style={{flexWrap:'nowrap',minWidth:'max-content'}}>
            {STAGE_ORDER.map(s => {
              const cnt = matches.filter(m=>m.stage===s&&m.result===null).length
              return (
                <button key={s} className={`tab-btn ${activeStage===s?'active':''}`} onClick={()=>setActiveStage(s)} style={{whiteSpace:'nowrap',fontSize:'0.78rem',padding:'0.4rem 0.6rem'}}>
                  {s} {cnt>0&&<span style={{background:'var(--danger)',color:'#fff',borderRadius:'99px',padding:'0 5px',fontSize:'0.68rem',marginLeft:'3px'}}>{cnt}</span>}
                </button>
              )
            })}
          </div>
        </div>

        <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',marginBottom:'0.75rem',color:'var(--white)'}}>
          PENDING ({pendingInStage.length})
        </h2>

        <div style={{display:'flex',flexDirection:'column',gap:'0.65rem',marginBottom:'2rem'}}>
          {pendingInStage.length === 0 && (
            <div className="card" style={{textAlign:'center',padding:'1.5rem',color:'var(--gray-500)'}}>All {activeStage} matches done! 🎉</div>
          )}
          {pendingInStage.map(match => {
            const form = resultForm[match.id] || {}
            const isKnockout = match.stage !== 'Group Stage'
            const bothKnown = !['Winner','Runner','Best','Loser'].some(w => (match.team_a||'').includes(w) || (match.team_b||'').includes(w))
            return (
              <div key={match.id} className="card" style={{padding:'0.85rem 1.1rem',opacity: isKnockout && !bothKnown ? 0.5 : 1}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.6rem',flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:'200px'}}>
                    <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:'0.1rem'}}>
                      {match.team_a} <span style={{color:'var(--gray-500)',fontWeight:400}}>vs</span> {match.team_b}
                    </div>
                    <div style={{fontSize:'0.75rem',color:'var(--gray-500)'}}>
                      {format(parseISO(match.match_date),'EEE MMM d')} · {match.match_time} · {match.stage}{match.group_name ? ` G-${match.group_name}` : ''}
                    </div>
                    {isKnockout && !bothKnown && <div style={{fontSize:'0.72rem',color:'var(--gold)',marginTop:'0.15rem'}}>⏳ Awaiting group results</div>}
                  </div>
                  {bothKnown && <>
                    <select className="form-select" style={{width:'150px'}} value={form.result||''} onChange={e=>handleResultInput(match.id,'result',e.target.value)}>
                      <option value="">— Result —</option>
                      <option value="teamA">{match.team_a} Win</option>
                      {match.stage === 'Group Stage' && <option value="draw">Draw</option>}
                      <option value="teamB">{match.team_b} Win</option>
                    </select>
                    <input className="form-input" style={{width:'68px'}} type="number" min="0" placeholder="A" value={form.scoreA??''} onChange={e=>handleResultInput(match.id,'scoreA',e.target.value)}/>
                    <span style={{color:'var(--gray-500)'}}>–</span>
                    <input className="form-input" style={{width:'68px'}} type="number" min="0" placeholder="B" value={form.scoreB??''} onChange={e=>handleResultInput(match.id,'scoreB',e.target.value)}/>
                    <button className="btn btn-primary btn-sm" onClick={()=>saveResult(match)} disabled={saving[match.id]}>
                      {saving[match.id]?'...':'Save'}
                    </button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>

        {doneInStage.length > 0 && (
          <>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',marginBottom:'0.75rem',color:'var(--white)'}}>COMPLETED ({doneInStage.length})</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'0.35rem',marginBottom:'2rem'}}>
              {doneInStage.map(m=>(
                <div key={m.id} className="card" style={{padding:'0.5rem 1.1rem',opacity:0.6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'0.85rem'}}>{m.team_a} vs {m.team_b}</span>
                  <span className="match-result-badge">{m.score_a}–{m.score_b}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Group Standings Table */}
        {activeStage === 'Group Stage' && (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:'0.5rem'}}>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',color:'var(--white)'}}>GROUP STANDINGS</h2>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowStandings(s=>!s)}>
                {showStandings ? 'Hide' : 'Show'} Standings
              </button>
            </div>
            {showStandings && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'1rem',marginBottom:'2rem'}}>
                {groups.map(g => (
                  <div key={g} className="card" style={{padding:'1rem'}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',color:'var(--gold)',marginBottom:'0.6rem',letterSpacing:'0.05em'}}>GROUP {g}</div>
                    <table style={{width:'100%',fontSize:'0.78rem'}}>
                      <thead>
                        <tr>
                          <th style={{textAlign:'left',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>Team</th>
                          <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>P</th>
                          <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>W</th>
                          <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>D</th>
                          <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>L</th>
                          <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gray-500)',fontWeight:600}}>GD</th>
                          <th style={{textAlign:'center',paddingBottom:'4px',color:'var(--gold)',fontWeight:700}}>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(standingsByGroup[g] || []).map((row, i) => (
                          <tr key={row.team}>
                            <td style={{color: i < 2 ? 'var(--white)' : i === 2 ? '#f6ad55' : 'var(--gray-500)', fontWeight: i < 2 ? 600 : 400, paddingTop:'3px'}}>
                              {i===0?'🥇':i===1?'🥈':i===2?'🟡':''} {row.team}
                            </td>
                            <td style={{textAlign:'center',color:'var(--gray-500)'}}>{row.played}</td>
                            <td style={{textAlign:'center'}}>{row.won}</td>
                            <td style={{textAlign:'center'}}>{row.drawn}</td>
                            <td style={{textAlign:'center'}}>{row.lost}</td>
                            <td style={{textAlign:'center',color: (row.goals_for-row.goals_against)>0?'#68d391':(row.goals_for-row.goals_against)<0?'#fc8181':'var(--gray-300)'}}>{row.goals_for-row.goals_against>0?'+':''}{row.goals_for-row.goals_against}</td>
                            <td style={{textAlign:'center',fontWeight:700,color:'var(--gold)'}}>{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
