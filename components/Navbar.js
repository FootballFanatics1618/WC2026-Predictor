import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Image from 'next/image'

export default function Navbar({ user }) {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        <Image src="/ff-logo.jpg" alt="Football Fanatics" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', marginRight: '10px', verticalAlign: 'middle' }} />
        <span>Football Fanatics WC2026 Predictor</span>
      </Link>
      <div className="nav-links">
        {user ? (
          <>
            <Link href="/predict" className="nav-btn nav-btn-ghost">Predict</Link>
            <Link href="/others" className="nav-btn nav-btn-ghost">Others' Picks</Link>
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
