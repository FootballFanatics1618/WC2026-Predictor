import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const STORAGE_KEY = 'scoringV2Dismissed'

export default function ScoringModal({ user }) {
  const [visible, setVisible] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!user) return
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY)) return
    setVisible(true)
  }, [user])

  useEffect(() => {
    if (!visible) return
    const onKeyDown = e => { if (e.key === 'Escape') handleDismiss() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [visible])

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  const thStyle = { textAlign: 'left', padding: '0.5rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-500)', borderBottom: '1px solid rgba(255,255,255,0.08)' }
  const tdLabel = { padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: 'var(--gray-400)', borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const tdPts = { padding: '0.45rem 0.6rem', fontSize: '0.8rem', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const sectionTitle = { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold)', marginBottom: '0.5rem' }
  const subHead = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-400)', padding: '0.35rem 0.6rem', background: 'rgba(255,255,255,0.03)' }

  function ptsColor(pts) {
    if (pts === '0') return 'var(--gray-600)'
    if (pts === '+5') return 'var(--gold)'
    return 'var(--white)'
  }

  return createPortal(
    <div className="nav-modal-backdrop" onClick={handleDismiss}>
      <div className="nav-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="scoring-title" style={{ width: 'min(92vw, 520px)', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', paddingBottom: 0 }}>
        <div className="nav-modal-eyebrow">New scoring system</div>
        <h2 id="scoring-title" className="nav-modal-title">Knockout Predictions Just Got Smarter</h2>

        {/* Group Stage */}
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: '0.5rem 0.6rem 0' }}>Group Stage (unchanged)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thStyle}>Prediction</th><th style={{ ...thStyle, textAlign: 'right' }}>Points</th></tr></thead>
            <tbody>
              <tr><td style={tdLabel}>Correct result</td><td style={{ ...tdPts, color: ptsColor('+3') }}>+3</td></tr>
              <tr><td style={tdLabel}>Correct result + correct score</td><td style={{ ...tdPts, color: ptsColor('+5') }}>+5</td></tr>
            </tbody>
          </table>
        </div>

        {/* Knockout Draw (Pens) */}
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: '0.5rem 0.6rem 0' }}>Knockout — Draw (Penalties)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thStyle}>Prediction</th><th style={thStyle}>Scenario</th><th style={{ ...thStyle, textAlign: 'right' }}>Points</th></tr></thead>
            <tbody>
              <tr><td style={{ ...subHead, borderRadius: 0 }} colSpan={3}>You predicted DRAW</td></tr>
              <tr><td style={tdLabel}>Draw</td><td style={tdLabel}>Correct result + correct score</td><td style={{ ...tdPts, color: ptsColor('+5') }}>+5</td></tr>
              <tr><td style={tdLabel}>Draw</td><td style={tdLabel}>Correct score, wrong result</td><td style={{ ...tdPts, color: ptsColor('+4') }}>+4</td></tr>
              <tr><td style={tdLabel}>Draw</td><td style={tdLabel}>Wrong score, correct result</td><td style={{ ...tdPts, color: ptsColor('+3') }}>+3</td></tr>
              <tr><td style={tdLabel}>Draw</td><td style={tdLabel}>Wrong score, wrong result</td><td style={{ ...tdPts, color: ptsColor('+2') }}>+2</td></tr>
              <tr><td style={{ ...subHead, borderRadius: 0 }} colSpan={3}>You predicted OUTRIGHT</td></tr>
              <tr><td style={tdLabel}>Outright</td><td style={tdLabel}>Correct result</td><td style={{ ...tdPts, color: ptsColor('+1') }}>+1</td></tr>
              <tr><td style={tdLabel}>Outright</td><td style={tdLabel}>Wrong result</td><td style={{ ...tdPts, color: ptsColor('0') }}>0</td></tr>
            </tbody>
          </table>
        </div>

        {/* Knockout Outright */}
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: '0.5rem 0.6rem 0' }}>Knockout — Outright Win</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thStyle}>Prediction</th><th style={thStyle}>Scenario</th><th style={{ ...thStyle, textAlign: 'right' }}>Points</th></tr></thead>
            <tbody>
              <tr><td style={{ ...subHead, borderRadius: 0 }} colSpan={3}>You predicted OUTRIGHT</td></tr>
              <tr><td style={tdLabel}>Outright</td><td style={tdLabel}>Correct result + correct score</td><td style={{ ...tdPts, color: ptsColor('+5') }}>+5</td></tr>
              <tr><td style={tdLabel}>Outright</td><td style={tdLabel}>Correct result, wrong score</td><td style={{ ...tdPts, color: ptsColor('+3') }}>+3</td></tr>
              <tr><td style={tdLabel}>Outright</td><td style={tdLabel}>Wrong result</td><td style={{ ...tdPts, color: ptsColor('0') }}>0</td></tr>
              <tr><td style={{ ...subHead, borderRadius: 0 }} colSpan={3}>You predicted DRAW</td></tr>
              <tr><td style={tdLabel}>Draw</td><td style={tdLabel}>Correct result</td><td style={{ ...tdPts, color: ptsColor('+1') }}>+1</td></tr>
              <tr><td style={tdLabel}>Draw</td><td style={tdLabel}>Wrong result</td><td style={{ ...tdPts, color: ptsColor('0') }}>0</td></tr>
            </tbody>
          </table>
        </div>

        {/* Sticky footer */}
        <div style={{ position: 'sticky', bottom: 0, marginTop: '1.5rem', padding: '1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(26,26,22,0.98)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--gray-400)', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--gold)', cursor: 'pointer' }}
            />
            I understand
          </label>
          <button
            className="btn btn-primary btn-sm"
            disabled={!checked}
            onClick={handleDismiss}
            style={{ opacity: checked ? 1 : 0.4, cursor: checked ? 'pointer' : 'not-allowed' }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
