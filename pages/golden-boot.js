import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import GoldenBootPicker from '../components/GoldenBootPicker'
import { supabase } from '../lib/supabase'
import { TOURNAMENT_START, PLAYER_TEAM_MAP } from '../lib/data'

export default function GoldenBootPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pick, setPick] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const isLocked = new Date() >= TOURNAMENT_START

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(data)
    setPick(data?.golden_boot_pick || '')
    setLoading(false)
  }

  async function handleSave() {
    if (!pick) { setError('Please select a player.'); return }
    setSaving(true)
    setError('')
    const { error } = await supabase.from('profiles').update({ golden_boot_pick: pick }).eq('id', user.id)
    if (error) { setError(error.message) }
    else { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    setSaving(false)
  }

  if (loading) return (
    <><Navbar user={user} /><div className="page" style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--gray-500)' }}>Loading...</div></>
  )

  return (
    <>
      <Navbar user={user} />
      <div className="page" style={{ maxWidth: '520px', paddingTop: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--gold)' }}>🥇 GOLDEN BOOT</div>
          <p style={{ color: 'var(--gray-500)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {isLocked
              ? 'The tournament has started — your pick is locked.'
              : 'Pick the player you think will be top scorer. Locks at tournament start (June 11).'}
          </p>
        </div>

        <div className="card-gold">
          {/* Points banner */}
          <div style={{
            background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <span style={{ fontSize: '1.5rem' }}>🏆</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.95rem' }}>+10 Bonus Points</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Awarded if your pick wins (or ties for) Golden Boot</div>
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          {saved && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>✅ Golden Boot pick saved!</div>}

          <div className="form-group">
            <label className="form-label">
              {isLocked ? 'Your pick (locked)' : 'Search by player name or country'}
            </label>
            <GoldenBootPicker value={pick} onChange={setPick} disabled={isLocked} />
            {pick && !isLocked && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                {PLAYER_TEAM_MAP[pick]} · {pick}
              </div>
            )}
          </div>

          {isLocked && (
            <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.875rem', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--danger)' }}>
              🔒 Tournament started June 11. No more changes allowed.
            </div>
          )}

          {!isLocked && (
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: '1rem' }}
              onClick={handleSave}
              disabled={saving || !pick || pick === profile?.golden_boot_pick}
            >
              {saving ? 'Saving...' : pick === profile?.golden_boot_pick ? 'Current pick saved' : 'Save Pick'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <Link href="/predict" className="btn btn-ghost btn-sm">
            Return to Predict
          </Link>
        </div>
      </div>
    </>
  )
}
