import Link from 'next/link'

export default function Custom404() {
  return (
    <div className="page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '520px', width: '100%' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', color: 'var(--gold)', marginBottom: '0.75rem' }}>
          404
        </div>
        <h1 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--white)' }}>Page not found</h1>
        <p style={{ color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          The page you’re looking for does not exist or has moved.
        </p>
        <Link href="/predict" className="btn btn-primary">
          Return to Predict
        </Link>
      </div>
    </div>
  )
}
