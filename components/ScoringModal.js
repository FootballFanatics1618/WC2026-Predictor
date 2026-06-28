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

  const sectionTitle = { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold)', marginBottom: '0.5rem' }
  const pad = '0.5rem 0.6rem'

  const th = { padding: pad, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-500)' }
  const td = { padding: pad, fontSize: '0.8rem', color: 'var(--gray-400)', borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const tdBold = { ...td, color: 'var(--white)', fontWeight: 600, whiteSpace: 'nowrap' }
  const tdScenario = { padding: pad, fontSize: '0.8rem', color: 'var(--gray-400)', borderBottom: '1px solid rgba(255,255,255,0.04)', overflowWrap: 'break-word' }
  const tdPts = { ...td, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }

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
          <div style={{ ...sectionTitle, padding: pad }}>Group Stage (unchanged)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto' }}>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Prediction</span>
            <span style={{ ...th, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Points</span>
            <span style={td}>Correct result</span><span style={{ ...tdPts, color: ptsColor('+3') }}>+3</span>
            <span style={td}>Correct result + correct score</span><span style={{ ...tdPts, color: ptsColor('+5') }}>+5</span>
          </div>
        </div>

        {/* Knockout Draw (Pens) */}
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: pad }}>Knockout — Draw (Penalties)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto' }}>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Prediction</span>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Scenario</span>
            <span style={{ ...th, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Points</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Correct result + correct score</span><span style={{ ...tdPts, color: ptsColor('+5') }}>+5</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Correct score, wrong result</span><span style={{ ...tdPts, color: ptsColor('+4') }}>+4</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Wrong score, correct result</span><span style={{ ...tdPts, color: ptsColor('+3') }}>+3</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Wrong score, wrong result</span><span style={{ ...tdPts, color: ptsColor('+2') }}>+2</span>
            <span style={tdBold}>Outright</span><span style={tdScenario}>Correct result</span><span style={{ ...tdPts, color: ptsColor('+1') }}>+1</span>
            <span style={tdBold}>Outright</span><span style={{ ...tdScenario, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Wrong result</span><span style={{ ...tdPts, borderBottom: '1px solid rgba(255,255,255,0.04)', color: ptsColor('0') }}>0</span>
          </div>
        </div>

        {/* Knockout Outright */}
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: pad }}>Knockout — Outright Win</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto' }}>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Prediction</span>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Scenario</span>
            <span style={{ ...th, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Points</span>
            <span style={tdBold}>Outright</span><span style={tdScenario}>Correct result + correct score</span><span style={{ ...tdPts, color: ptsColor('+5') }}>+5</span>
            <span style={tdBold}>Outright</span><span style={tdScenario}>Correct result, wrong score</span><span style={{ ...tdPts, color: ptsColor('+3') }}>+3</span>
            <span style={tdBold}>Outright</span><span style={tdScenario}>Wrong result</span><span style={{ ...tdPts, color: ptsColor('0') }}>0</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Correct result</span><span style={{ ...tdPts, color: ptsColor('+1') }}>+1</span>
            <span style={tdBold}>Draw</span><span style={{ ...tdScenario, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Wrong result</span><span style={{ ...tdPts, borderBottom: '1px solid rgba(255,255,255,0.04)', color: ptsColor('0') }}>0</span>
          </div>
        </div>

        {/* Sticky footer */}
        <div style={{ position: 'sticky', bottom: 0, marginTop: '1.5rem', padding: '1rem 1.25rem', marginLeft: '-1.25rem', marginRight: '-1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(26,26,22,1)', borderTop: '1px solid rgba(255,255,255,0.08)', zIndex: 10 }}>
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
