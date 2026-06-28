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

  function ptsColor(pts) {
    if (pts === '0') return 'var(--gray-600)'
    if (pts === '+5') return 'var(--gold)'
    return 'var(--white)'
  }

  function Row({ cols, pts, children }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {children}
        <span style={{ marginLeft: 'auto', flexShrink: 0, fontWeight: 700, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: ptsColor(pts), whiteSpace: 'nowrap' }}>{pts}</span>
      </div>
    )
  }

  function ColHeader({ children, right }) {
    return (
      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-500)', padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: right ? 'right' : 'left', flex: right ? '0 0 auto' : 1 }}>{children}</span>
    )
  }

  function Cell({ children, bold }) {
    return (
      <span style={{ fontSize: '0.8rem', color: bold ? 'var(--white)' : 'var(--gray-400)', fontWeight: bold ? 600 : 400, flex: 1, minWidth: 0 }}>{children}</span>
    )
  }

  return createPortal(
    <div className="nav-modal-backdrop" onClick={handleDismiss}>
      <div className="nav-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="scoring-title" style={{ width: 'min(92vw, 520px)', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', paddingBottom: 0 }}>
        <div className="nav-modal-eyebrow">New scoring system</div>
        <h2 id="scoring-title" className="nav-modal-title">Knockout Predictions Just Got Smarter</h2>

        {/* Group Stage */}
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: '0.5rem 0.6rem 0' }}>Group Stage (unchanged)</div>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <ColHeader>Prediction</ColHeader>
            <ColHeader right>Points</ColHeader>
          </div>
          <Row pts="+3"><Cell>Correct result</Cell></Row>
          <Row pts="+5"><Cell>Correct result + correct score</Cell></Row>
        </div>

        {/* Knockout Draw (Pens) */}
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: '0.5rem 0.6rem 0' }}>Knockout — Draw (Penalties)</div>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <ColHeader>Prediction</ColHeader>
            <ColHeader>Scenario</ColHeader>
            <ColHeader right>Points</ColHeader>
          </div>
          <Row pts="+5"><Cell bold>Draw</Cell><Cell>Correct result + correct score</Cell></Row>
          <Row pts="+4"><Cell bold>Draw</Cell><Cell>Correct score, wrong result</Cell></Row>
          <Row pts="+3"><Cell bold>Draw</Cell><Cell>Wrong score, correct result</Cell></Row>
          <Row pts="+2"><Cell bold>Draw</Cell><Cell>Wrong score, wrong result</Cell></Row>
          <Row pts="+1"><Cell bold>Outright</Cell><Cell>Correct result</Cell></Row>
          <Row pts="0"><Cell bold>Outright</Cell><Cell>Wrong result</Cell></Row>
        </div>

        {/* Knockout Outright */}
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: '0.5rem 0.6rem 0' }}>Knockout — Outright Win</div>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <ColHeader>Prediction</ColHeader>
            <ColHeader>Scenario</ColHeader>
            <ColHeader right>Points</ColHeader>
          </div>
          <Row pts="+5"><Cell bold>Outright</Cell><Cell>Correct result + correct score</Cell></Row>
          <Row pts="+3"><Cell bold>Outright</Cell><Cell>Correct result, wrong score</Cell></Row>
          <Row pts="0"><Cell bold>Outright</Cell><Cell>Wrong result</Cell></Row>
          <Row pts="+1"><Cell bold>Draw</Cell><Cell>Correct result</Cell></Row>
          <Row pts="0"><Cell bold>Draw</Cell><Cell>Wrong result</Cell></Row>
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
