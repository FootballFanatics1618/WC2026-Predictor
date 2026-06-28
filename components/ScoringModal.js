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

  return createPortal(
    <div className="nav-modal-backdrop" onClick={handleDismiss}>
      <div className="nav-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="scoring-title" style={{ maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="nav-modal-eyebrow">New scoring system</div>
        <h2 id="scoring-title" className="nav-modal-title">Knockout Predictions Just Got Smarter</h2>

        {/* Group Stage */}
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>Group Stage (unchanged)</div>
          <ScoringRow pts="+3" label="Correct result" />
          <ScoringRow pts="+5" label="Correct result + correct score" />
        </div>

        {/* Knockout Draw (Pens) */}
        <div style={{ marginTop: '0.6rem', padding: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold)', marginBottom: '0.5rem' }}>Knockout — Draw (Penalties)</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-400)', marginBottom: '0.3rem' }}>If you predicted the DRAW:</div>
          <ScoringRow pts="+5" label="Correct result + correct score" />
          <ScoringRow pts="+4" label="Correct score, wrong result" />
          <ScoringRow pts="+3" label="Wrong score, correct result" />
          <ScoringRow pts="+2" label="Wrong score, wrong result" />
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-400)', marginTop: '0.5rem', marginBottom: '0.3rem' }}>If you predicted OUTRIGHT:</div>
          <ScoringRow pts="+1" label="Correct result" />
          <ScoringRow pts="0" label="Wrong result" />
        </div>

        {/* Knockout Outright */}
        <div style={{ marginTop: '0.6rem', padding: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold)', marginBottom: '0.5rem' }}>Knockout — Outright Win</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-400)', marginBottom: '0.3rem' }}>If you predicted OUTRIGHT:</div>
          <ScoringRow pts="+5" label="Correct result + correct score" />
          <ScoringRow pts="+3" label="Correct result, wrong score" />
          <ScoringRow pts="0" label="Wrong result" />
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-400)', marginTop: '0.5rem', marginBottom: '0.3rem' }}>If you predicted DRAW:</div>
          <ScoringRow pts="+1" label="Correct result" />
          <ScoringRow pts="0" label="Wrong result" />
        </div>

        {/* Checkbox + Dismiss */}
        <div style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
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

function ScoringRow({ pts, label }) {
  const color = pts === '0' ? 'var(--gray-600)' : pts === '+5' ? 'var(--gold)' : 'var(--white)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0', fontSize: '0.82rem' }}>
      <span style={{ color: 'var(--gray-500)' }}>{label}</span>
      <span style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{pts} pts</span>
    </div>
  )
}
