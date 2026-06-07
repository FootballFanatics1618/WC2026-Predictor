import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'

// ─── Main Signup Page ─────────────────────────────────────────────────────────
export default function Signup() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  // Step 1: create auth user + profile (no GB pick yet)
  async function handleAccountSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.username.trim() || !form.email || !form.password) {
      setError('All fields are required.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)

    // Username check
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('username', form.username.trim()).single()
    if (existing) {
      setError('That username is already taken.')
      setLoading(false)
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })
    if (authError) { setError(authError.message); setLoading(false); return }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      username: form.username.trim(),
      golden_boot_pick: null,
    })
    if (profileError) { setError(profileError.message); setLoading(false); return }

    setLoading(false)
    router.push('/predict?welcome=1')
  }

  return (
    <>
      <Navbar user={null} />
      <div className="page" style={{ maxWidth: '480px', paddingTop: '3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--gold)' }}>JOIN THE LEAGUE</div>
          <p style={{ color: 'var(--gray-500)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Create your account</p>
        </div>
        <div className="card-gold">
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleAccountSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" name="username" value={form.username} onChange={handleChange} placeholder="e.g. goalking99" autoComplete="off" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@email.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Creating account...' : 'Create Account & Join →'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--gray-500)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </>
  )
}
