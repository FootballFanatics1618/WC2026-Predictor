import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Navbar({ user }) {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">⚽ WC2026 Predictor</Link>
      <div className="nav-links">
        {user ? (
          <>
            <Link href="/predict" className="nav-btn nav-btn-ghost">Predict</Link>
            <Link href="/leaderboard" className="nav-btn nav-btn-ghost">Leaderboard</Link>
            <Link href="/admin" className="nav-btn nav-btn-ghost">Admin</Link>
            <button onClick={handleLogout} className="nav-btn nav-btn-ghost">Sign Out</button>
          </>
        ) : (
          <>
            <Link href="/login" className="nav-btn nav-btn-ghost">Sign In</Link>
            <Link href="/signup" className="nav-btn nav-btn-gold">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  )
}
