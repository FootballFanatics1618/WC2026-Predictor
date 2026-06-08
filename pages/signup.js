import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'

// ─── Main Signup Page ─────────────────────────────────────────────────────────
export default function Signup() {
  const router = useRouter()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  // Step 1: create auth user + profile (no GB pick yet)
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email || !form.password) {
      setError('All fields are required.'); return
    }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)

    const username = `${form.firstName.trim()} ${form.lastName.trim()}`
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
    if (existing) { setError('That name is already registered.'); setLoading(false); return }

    const { data: authData, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (authError) { setError(authError.message); setLoading(false); return }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      username,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
    })
    if (profileError) { setError(profileError.message); setLoading(false); return }

    router.push('/predict?welcome=1')
  }

  return (
    <>
      <Navbar user={null} />
      <div className="page" style={{ maxWidth: '460px', paddingTop: '3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--gold)' }}>JOIN THE LEAGUE</div>
          <p style={{ color: 'var(--gray-500)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Sign up, then set your Golden Boot pick from the home page
          </p>
        </div>
        <div className="card-gold">
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">First Name</label>
                <input className="form-input" name="firstName" value={form.firstName} onChange={handleChange} placeholder="Rahul" autoComplete="given-name" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Last Name</label>
                <input className="form-input" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Sharma" autoComplete="family-name" />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Email</label>
              <input className="form-input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@email.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" />
            </div>
            <div className="alert alert-info" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
              🥇 After signing up, go to the <strong>Home page</strong> to set your Golden Boot pick (worth +10 pts!)
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--gray-500)' }}>
            Already have an account? <Link href="/login" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </>
  )
}
