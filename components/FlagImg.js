import { getFlagImg, isKnockoutPlaceholder } from '../lib/flags'

// Renders a real flag image for a team name.
// Falls back to a trophy icon for knockout placeholders, nothing for unknowns.
export default function FlagImg({ team, size = 22 }) {
  if (!team) return null
  if (isKnockoutPlaceholder(team)) {
    return <span style={{ fontSize: size * 0.9, lineHeight: 1, verticalAlign: 'middle' }}>🏆</span>
  }
  const props = getFlagImg(team, size)
  if (!props) return null
  // Using a plain <img> — no Next.js Image needed for external CDN flags
  return (
    <img
      src={props.src}
      alt={props.alt}
      width={props.width}
      height={props.height}
      style={props.style}
      loading="lazy"
    />
  )
}
