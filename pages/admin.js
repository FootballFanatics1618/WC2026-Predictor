import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

const ADMIN_EMAILS = ['your-email@gmail.com'] // ← CHANGE THIS

const STAGE_ORDER = ['Group Stage','Round of 32','Round of 16','Quarter-final','Semi-final','3rd Place Play-off','Final']

export default function Admin() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [matches, setMatches] = useState([])
  const [resultForm, setResultForm] = useState({})
  const [saving, setSaving] = useState({})
  const [goldenBootWinner, setGoldenBootWinner] = useState('')
  const [gbSaving, setGbSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeStage, setActiveStage] = useState('Group Stage')
  const [loading, setLoading] = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)
    if (!ADMIN_EMAILS.includes(session.user.email)) { setLoading(false); return }
    setIsAdmin(true)
    await loadMatches()
    setLoading(false)
  }

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_date').order('match_time')
    setMatches(data || [])
  }

  function handleResultInput(matchId, field, value) {
    setResultForm(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: value } }))
  }

  async function saveResult(match) {
    const form = resultForm[match.id]
    if (!form?.result || form.scoreA === undefined || form.scoreB === undefined || form.scoreA === '' || form.scoreB === '') {
      alert('Please fill in result, score A and score B.')
      return
    }
    setSaving(s => ({ ...s, [match.id]: true }))
    const scoreA = parseInt(form.scoreA)
    const scoreB = parseInt(form.scoreB)

    // Validate: result must match score
    const scoreDiff = scoreA - scoreB
    if (form.result === 'teamA' && scoreDiff <= 0) { alert('Score doesn\'t match Team A win result'); setSaving(s => ({...s,[match.id]:false})); return }
    if (form.result === 'teamB' && scoreDiff >= 0) { alert('Score doesn\'t match Team B win result'); setSaving(s => ({...s,[match.id]:false})); return }
    if (form.result === 'draw' && scoreDiff !== 0) { alert('Score doesn\'t match Draw result'); setSaving(s => ({...s,[match.id]:false})); return }

    const { error: matchError } = await supabase.from('matches').update({
      result: form.result, score_a: scoreA, score_b: scoreB,
    }).eq('id', match.id)

    if (matchError) { alert('Error saving: ' + matchError.message); setSaving(s => ({...s,[match.id]:false})); return }

    // Score all predictions for this match
    const { data: preds } = await supabase.from('predictions').select('*').eq('match_id', match.id)
    for (const pred of (preds || [])) {
      const isResultCorrect = pred.predicted_result === form.result
      const isScoreCorrect = isResultCorrect && pred.predicted_score_a === scoreA && pred.predicted_score_b === scoreB
      const points = isScoreCorrect ? 5 : isResultCorrect ? 3 : 0
      await supabase.from('predictions').update({
        is_result_correct: isResultCorrect,
        is_score_correct: isScoreCorrect,
        points_earned: points,
      }).eq('id', pred.id)
    }

    // For knockout matches: update the next match's team_a or team_b dynamically
    if (match.stage !== 'Group Stage') {
      await resolveKnockoutProgression(match, form.result, scoreA, scoreB)
    }

    setMessage(`✅ ${match.team_a} ${scoreA}–${scoreB} ${match.team_b} saved! ${preds?.length || 0} predictions scored.`)
    await loadMatches()
    setSaving(s => ({ ...s, [match.id]: false }))
  }

  // After a knockout match result, find any dependent future match and update it
  async function resolveKnockoutProgression(completedMatch, result, scoreA, scoreB) {
    const winner = result === 'teamA' ? completedMatch.team_a : completedMatch.team_b
    const loser  = result === 'teamA' ? completedMatch.team_b : completedMatch.team_a

    // Find matches that reference this match slot
    const slot = completedMatch.knockout_slot // e.g. "R32-M73"
    const matchNum = completedMatch.id

    // Update any future match whose team_a or team_b text references this match
    const { data: futureMathces } = await supabase.from('matches').select('*')
      .or(`team_a.ilike.%M${matchNum}%,team_b.ilike.%M${matchNum}%`)

    for (const fm of (futureMathces || [])) {
      const updates = {}
      if (fm.team_a.includes(`M${matchNum}`)) {
        updates.team_a = fm.team_a.includes('Loser') ? loser : winner
      }
      if (fm.team_b.includes(`M${matchNum}`)) {
        updates.team_b = fm.team_b.includes('Loser') ? loser : winner
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('matches').update(updates).eq('id', fm.id)
      }
    }
  }

  async function awardGoldenBoot() {
    if (!goldenBootWinner.trim()) { alert('Enter a player name.'); return }
    setGbSaving(true)
    const { data: winners } = await supabase.from('profiles').select('id').eq('golden_boot_pick', goldenBootWinner.trim())
    for (const winner of (winners || [])) {
      await supabase.from('predictions').upsert({
        user_id: winner.id, match_id: 9999,
        predicted_result: 'teamA', predicted_score_a: 0, predicted_score_b: 0,
        is_result_correct: true, is_score_correct: false, points_earned: 10,
      }, { onConflict: 'user_id,match_id' })
      await supabase.from('profiles').update({ golden_boot_correct: true }).eq('id', winner.id)
    }
    setMessage(`🥇 Golden Boot: ${goldenBootWinner}! ${winners?.length || 0} players receive +10 pts.`)
    setGbSaving(false)
  }

  if (loading) return <><Navbar user={user}/><div className="page" style={{textAlign:'center',paddingTop:'5rem',color:'var(--gray-500)'}}>Loading...</div></>

  if (!isAdmin) return (
    <><Navbar user={user}/>
    <div className="page" style={{textAlign:'center',paddingTop:'5rem',color:'var(--gray-500)'}}>
      <p>⛔ No admin access. Add your email to ADMIN_EMAILS in pages/admin.js</p>
    </div></>
  )

  const stageMatches = matches.filter(m => m.stage === activeStage)
  const pendingInStage = stageMatches.filter(m => m.result === null)
  const doneInStage = stageMatches.filter(m => m.result !== null)
  const totalDone = matches.filter(m => m.result !== null).length

  return (
    <>
      <Navbar user={user} />
      <div className="page">
        <h1 className="section-title">ADMIN PANEL</h1>
        <p style={{color:'var(--gray-500)',marginBottom:'1rem',fontSize:'0.9rem'}}>
          Enter results here — scores auto-populate the leaderboard and unlock the next round's predictions. {totalDone}/104 matches completed.
        </p>

        {message && <div className="alert alert-success" style={{marginBottom:'1.5rem'}}>{message}<button onClick={()=>setMessage('')} style={{marginLeft:'1rem',background:'none',border:'none',color:'inherit',cursor:'pointer'}}>×</button></div>}

        {/* Golden Boot */}
        <div className="card-gold" style={{marginBottom:'2rem'}}>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',color:'var(--gold)',marginBottom:'0.75rem'}}>🥇 AWARD GOLDEN BOOT</h2>
          <p style={{fontSize:'0.85rem',color:'var(--gray-500)',marginBottom:'0.75rem'}}>Use only at end of tournament. All users who predicted this player get +10 pts.</p>
          <div style={{display:'flex',gap:'0.75rem',alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:1}}>
              <label className="form-label">Golden Boot Winner Name (exact spelling)</label>
              <input className="form-input" value={goldenBootWinner} onChange={e=>setGoldenBootWinner(e.target.value)} placeholder="e.g. Erling Haaland"/>
            </div>
            <button className="btn btn-primary" onClick={awardGoldenBoot} disabled={gbSaving}>{gbSaving?'Awarding...':'Award +10 pts'}</button>
          </div>
        </div>

        {/* Stage tabs */}
        <div className="tabs" style={{overflowX:'auto',flexWrap:'nowrap',marginBottom:'1.5rem'}}>
          {STAGE_ORDER.map(s => {
            const cnt = matches.filter(m=>m.stage===s&&m.result===null).length
            return (
              <button key={s} className={`tab-btn ${activeStage===s?'active':''}`} onClick={()=>setActiveStage(s)} style={{whiteSpace:'nowrap',fontSize:'0.8rem'}}>
                {s} {cnt>0&&<span style={{background:'var(--danger)',color:'#fff',borderRadius:'99px',padding:'1px 6px',fontSize:'0.7rem',marginLeft:'4px'}}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',marginBottom:'1rem',color:'var(--white)'}}>
          PENDING ({pendingInStage.length})
        </h2>

        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',marginBottom:'2rem'}}>
          {pendingInStage.length === 0 && (
            <div className="card" style={{textAlign:'center',padding:'2rem',color:'var(--gray-500)'}}>
              All {activeStage} matches completed! 🎉
            </div>
          )}
          {pendingInStage.map(match => {
            const form = resultForm[match.id] || {}
            const isKnockout = match.stage !== 'Group Stage'
            const bothTeamsKnown = !match.team_a.includes('Winner') && !match.team_a.includes('Runner') && !match.team_a.includes('Best') && !match.team_a.includes('Loser')
              && !match.team_b.includes('Winner') && !match.team_b.includes('Runner') && !match.team_b.includes('Best') && !match.team_b.includes('Loser')
            return (
              <div key={match.id} className="card" style={{padding:'1rem 1.25rem',opacity: isKnockout && !bothTeamsKnown ? 0.5 : 1}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:'220px'}}>
                    <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:'0.15rem'}}>
                      {match.team_a} <span style={{color:'var(--gray-500)',fontWeight:400}}>vs</span> {match.team_b}
                    </div>
                    <div style={{fontSize:'0.78rem',color:'var(--gray-500)'}}>
                      {format(parseISO(match.match_date),'EEE MMM d')} · {match.match_time} · {match.stage}
                      {match.group_name && ` · Group ${match.group_name}`}
                    </div>
                    {isKnockout && !bothTeamsKnown && (
                      <div style={{fontSize:'0.75rem',color:'var(--gold)',marginTop:'0.2rem'}}>⏳ Awaiting group stage results</div>
                    )}
                  </div>

                  {bothTeamsKnown && <>
                    <select className="form-select" style={{width:'160px'}} value={form.result||''} onChange={e=>handleResultInput(match.id,'result',e.target.value)}>
                      <option value="">— Result —</option>
                      <option value="teamA">{match.team_a} Win</option>
                      {match.stage === 'Group Stage' && <option value="draw">Draw</option>}
                      <option value="teamB">{match.team_b} Win</option>
                    </select>
                    <input className="form-input" style={{width:'75px'}} type="number" min="0" placeholder={match.team_a.substring(0,3)} value={form.scoreA??''} onChange={e=>handleResultInput(match.id,'scoreA',e.target.value)}/>
                    <span style={{color:'var(--gray-500)'}}>–</span>
                    <input className="form-input" style={{width:'75px'}} type="number" min="0" placeholder={match.team_b.substring(0,3)} value={form.scoreB??''} onChange={e=>handleResultInput(match.id,'scoreB',e.target.value)}/>
                    <button className="btn btn-primary btn-sm" onClick={()=>saveResult(match)} disabled={saving[match.id]}>
                      {saving[match.id]?'Saving...':'Save'}
                    </button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>

        {doneInStage.length > 0 && (
          <>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',marginBottom:'1rem',color:'var(--white)'}}>COMPLETED ({doneInStage.length})</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
              {doneInStage.map(m=>(
                <div key={m.id} className="card" style={{padding:'0.6rem 1.25rem',opacity:0.65,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'0.875rem'}}>{m.team_a} vs {m.team_b}</span>
                  <span className="match-result-badge">{m.score_a}–{m.score_b}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
