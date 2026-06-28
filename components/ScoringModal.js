import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const STORAGE_KEY = 'scoringV2Dismissed'

export default function ScoringModal({ user }) {
  const [visible, setVisible] = useState(false)
  const [checked, setChecked] = useState(false)
  const [tab, setTab] = useState('logic')

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

  const sectionTitle = { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold)' }
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

  const tabBase = { padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--gray-500)', transition: 'all 0.15s' }
  const tabActive = { ...tabBase, background: 'rgba(255,255,255,0.08)', color: 'var(--white)' }

  function LogicTab() {
    return (
      <>
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: pad }}>Group Stage (unchanged)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto' }}>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Prediction</span>
            <span style={{ ...th, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Points</span>
            <span style={td}>Correct result</span><span style={{ ...tdPts, color: ptsColor('+3') }}>+3</span>
            <span style={td}>Correct result + correct score</span><span style={{ ...tdPts, color: ptsColor('+5') }}>+5</span>
          </div>
        </div>

        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: pad }}>Knockout — Draw (Penalties)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto' }}>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Prediction</span>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Scenario</span>
            <span style={{ ...th, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Points</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Correct result + correct winner</span><span style={{ ...tdPts, color: ptsColor('+5') }}>+5</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Correct score, wrong winner</span><span style={{ ...tdPts, color: ptsColor('+4') }}>+4</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Wrong score, correct winner</span><span style={{ ...tdPts, color: ptsColor('+3') }}>+3</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Wrong score, wrong winner</span><span style={{ ...tdPts, color: ptsColor('+2') }}>+2</span>
            <span style={tdBold}>Outright</span><span style={tdScenario}>Correct winner</span><span style={{ ...tdPts, color: ptsColor('+1') }}>+1</span>
            <span style={tdBold}>Outright</span><span style={{ ...tdScenario, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Wrong winner</span><span style={{ ...tdPts, borderBottom: '1px solid rgba(255,255,255,0.04)', color: ptsColor('0') }}>0</span>
          </div>
        </div>

        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: pad }}>Knockout — Outright Win</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto' }}>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Prediction</span>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Scenario</span>
            <span style={{ ...th, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Points</span>
            <span style={tdBold}>Outright</span><span style={tdScenario}>Correct result + correct score</span><span style={{ ...tdPts, color: ptsColor('+5') }}>+5</span>
            <span style={tdBold}>Outright</span><span style={tdScenario}>Correct result, wrong score</span><span style={{ ...tdPts, color: ptsColor('+3') }}>+3</span>
            <span style={tdBold}>Outright</span><span style={tdScenario}>Wrong result</span><span style={{ ...tdPts, color: ptsColor('0') }}>0</span>
            <span style={tdBold}>Draw</span><span style={tdScenario}>Correct winner</span><span style={{ ...tdPts, color: ptsColor('+1') }}>+1</span>
            <span style={tdBold}>Draw</span><span style={{ ...tdScenario, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Wrong winner</span><span style={{ ...tdPts, borderBottom: '1px solid rgba(255,255,255,0.04)', color: ptsColor('0') }}>0</span>
          </div>
        </div>
      </>
    )
  }

  function ExampleTab() {
    return (
      <>
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: pad }}>Group Stage</div>
          <div style={{ padding: '0.6rem 0.6rem 0.4rem', fontSize: '0.78rem', color: 'var(--gray-500)' }}>Brazil vs Serbia — <span style={{ color: 'var(--white)', fontWeight: 600 }}>Brazil Win 2-0</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto' }}>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>You picked</span>
            <span style={{ ...th, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Points</span>
            <span style={td}>Brazil 2-0 (exact)</span><span style={{ ...tdPts, color: ptsColor('+5') }}>+5</span>
            <span style={td}>Brazil 1-0 (right team)</span><span style={{ ...tdPts, color: ptsColor('+3') }}>+3</span>
            <span style={td}>Serbia 1-0 (wrong team)</span><span style={{ ...tdPts, color: ptsColor('0') }}>0</span>
          </div>
        </div>

        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: pad }}>Knockout — Draw (Penalties)</div>
          <div style={{ padding: '0.6rem 0.6rem 0.4rem', fontSize: '0.78rem', color: 'var(--gray-500)' }}>France vs Argentina — ends <span style={{ color: 'var(--white)', fontWeight: 600 }}>1-1, France win on pens</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto' }}>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>You picked</span>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>What happened</span>
            <span style={{ ...th, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Points</span>
            <span style={tdBold}>Draw 1-1, France</span><span style={tdScenario}>Score ✓ winner ✓</span><span style={{ ...tdPts, color: ptsColor('+5') }}>+5</span>
            <span style={tdBold}>Draw 1-1, Argentina</span><span style={tdScenario}>Score ✓ winner ✗</span><span style={{ ...tdPts, color: ptsColor('+4') }}>+4</span>
            <span style={tdBold}>Draw 2-2, France</span><span style={tdScenario}>Score ✗ winner ✓</span><span style={{ ...tdPts, color: ptsColor('+3') }}>+3</span>
            <span style={tdBold}>Draw 2-2, Argentina</span><span style={tdScenario}>Score ✗ winner ✗</span><span style={{ ...tdPts, color: ptsColor('+2') }}>+2</span>
            <span style={tdBold}>France 2-0</span><span style={tdScenario}>Outright — right winner</span><span style={{ ...tdPts, color: ptsColor('+1') }}>+1</span>
            <span style={tdBold}>Argentina 3-1</span><span style={{ ...tdScenario, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Outright — wrong winner</span><span style={{ ...tdPts, borderBottom: '1px solid rgba(255,255,255,0.04)', color: ptsColor('0') }}>0</span>
          </div>
        </div>

        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ ...sectionTitle, padding: pad }}>Knockout — Outright Win</div>
          <div style={{ padding: '0.6rem 0.6rem 0.4rem', fontSize: '0.78rem', color: 'var(--gray-500)' }}>Brazil vs Croatia — <span style={{ color: 'var(--white)', fontWeight: 600 }}>Brazil win 4-1</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto' }}>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>You picked</span>
            <span style={{ ...th, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>What happened</span>
            <span style={{ ...th, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Points</span>
            <span style={tdBold}>Brazil 4-1</span><span style={tdScenario}>Exact match</span><span style={{ ...tdPts, color: ptsColor('+5') }}>+5</span>
            <span style={tdBold}>Brazil 2-0</span><span style={tdScenario}>Right team, wrong score</span><span style={{ ...tdPts, color: ptsColor('+3') }}>+3</span>
            <span style={tdBold}>Croatia 1-0</span><span style={tdScenario}>Wrong team</span><span style={{ ...tdPts, color: ptsColor('0') }}>0</span>
            <span style={tdBold}>Draw 1-1, Brazil</span><span style={tdScenario}>Right winner (Brazil)</span><span style={{ ...tdPts, color: ptsColor('+1') }}>+1</span>
            <span style={tdBold}>Draw 2-2, Croatia</span><span style={{ ...tdScenario, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Wrong winner (Croatia)</span><span style={{ ...tdPts, borderBottom: '1px solid rgba(255,255,255,0.04)', color: ptsColor('0') }}>0</span>
          </div>
        </div>
      </>
    )
  }

  return createPortal(
    <div className="nav-modal-backdrop" onClick={handleDismiss}>
      <div className="nav-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="scoring-title" style={{ width: 'min(92vw, 520px)', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', paddingBottom: 0 }}>
        <div className="nav-modal-eyebrow">New scoring system</div>
        <h2 id="scoring-title" className="nav-modal-title">Knockout Predictions Just Got Smarter</h2>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button style={tab === 'logic' ? tabActive : tabBase} onClick={() => setTab('logic')}>Logic</button>
          <button style={tab === 'example' ? tabActive : tabBase} onClick={() => setTab('example')}>Example</button>
        </div>

        {tab === 'logic' ? <LogicTab /> : <ExampleTab />}

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
