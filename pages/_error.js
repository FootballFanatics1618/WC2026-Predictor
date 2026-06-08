import Link from 'next/link'

function ErrorPage({ statusCode }) {
  const title = statusCode
    ? `A ${statusCode} error occurred`
    : 'An unexpected error occurred'

  return (
    <div className="page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '520px', width: '100%' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', color: 'var(--gold)', marginBottom: '0.75rem' }}>
          Oops
        </div>
        <h1 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--white)' }}>{title}</h1>
        <p style={{ color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          Something went wrong while loading the page. You can head back to predictions and try again.
        </p>
        <Link href="/predict" className="btn btn-primary">
          Return to Predict
        </Link>
      </div>
    </div>
  )
}

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res?.statusCode || err?.statusCode || 500
  return { statusCode }
}

export default ErrorPage
