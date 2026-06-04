import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
  }, [])

  return (
    <>
      <Navbar user={user} />
      <div className="page" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚽</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', color: 'var(--gold)', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          WORLD CUP 2026
        </h1>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--white)', letterSpacing: '0.04em', marginBottom: '1.5rem' }}>
          PREDICTOR LEAGUE
        </h2>
        <p style={{ color: 'var(--gray-300)', fontSize: '1.1rem', maxWidth: '520px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Predict match results and scorelines across all 48 teams. Compete with friends, climb the leaderboard, and call the Golden Boot winner.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' }}>
          {user ? (
            <>
              <Link href="/predict" className="btn btn-primary" style={{ fontSize: '1.1rem', padding: '0.8rem 2rem' }}>Make Predictions →</Link>
              <Link href="/leaderboard" className="btn btn-ghost" style={{ fontSize: '1.1rem', padding: '0.8rem 2rem' }}>View Leaderboard</Link>
            </>
          ) : (
            <>
              <Link href="/signup" className="btn btn-primary" style={{ fontSize: '1.1rem', padding: '0.8rem 2rem' }}>Join the League →</Link>
              <Link href="/login" className="btn btn-ghost" style={{ fontSize: '1.1rem', padding: '0.8rem 2rem' }}>Sign In</Link>
            </>
          )}
        </div>

        <div className="grid-3" style={{ maxWidth: '750px', margin: '0 auto' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>+3 pts</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Correct result</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>+5 pts</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Correct scoreline</div>
          </div>
          <div className="card-gold" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🥇</div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--gold)' }}>+10 pts</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Golden Boot bonus</div>
          </div>
        </div>
      </div>
    </>
  )
}
