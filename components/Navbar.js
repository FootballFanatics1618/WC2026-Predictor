import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Image from 'next/image'

const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',').map(e => e.trim())
  : []

export default function Navbar({ user }) {
  const router = useRouter()
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const isAdmin = user && ADMIN_EMAILS.includes(user.email)
  const currentPath = router.pathname

  useEffect(() => {
    setShowSignOutModal(false)
  }, [currentPath])

  useEffect(() => {
    if (!showSignOutModal) return
    const onKeyDown = event => {
      if (event.key === 'Escape') setShowSignOutModal(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showSignOutModal])

  async function handleLogout() {
    setShowSignOutModal(false)
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href) {
    return currentPath === href
  }

  function navClass(href) {
    return `nav-btn nav-btn-ghost${isActive(href) ? ' nav-btn-active' : ''}`
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <Image src="/ff-logo.jpg" alt="Football Fanatics" width={36} height={36}
            style={{ borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle' }} />
          <span>FF WC2026</span>
        </Link>
        <div className="nav-links">
          {user ? (
            <>
              <Link href="/predict" className={navClass('/predict')}>Predict</Link>
              <Link href="/leaderboard" className={navClass('/leaderboard')}>Leaderboard</Link>
              <Link href="/groups" className={navClass('/groups')}>Groups</Link>
              <Link href="/race" className={navClass('/race')}>Rank Race</Link>
              <a href="https://footballfanatics1618.github.io/WC2026-Predictor/" target="_blank" rel="noopener noreferrer" className="nav-btn nav-btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Insights
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
              {isAdmin && <Link href="/admin" className={navClass('/admin')}>Admin</Link>}
              <button onClick={() => setShowSignOutModal(true)} className="nav-btn nav-btn-ghost nav-btn-icon" aria-label="Sign out">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={navClass('/login')}>Sign In</Link>
              <Link href="/signup" className={navClass('/signup')}>Sign Up</Link>
            </>
          )}
        </div>
      </div>

      {showSignOutModal && typeof document !== 'undefined' && createPortal(
        <div className="nav-modal-backdrop" onClick={() => setShowSignOutModal(false)}>
          <div className="nav-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="signout-title">
            <div className="nav-modal-eyebrow">Confirm sign out</div>
            <h2 id="signout-title" className="nav-modal-title">Sign out?</h2>
            <p className="nav-modal-copy">
              You’ll need to sign in again to continue making predictions.
            </p>
            <div className="nav-modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSignOutModal(false)}>
                Dismiss
              </button>
              <button className="btn btn-danger" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </nav>
  )
}
