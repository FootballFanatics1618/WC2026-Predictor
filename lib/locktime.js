// ─────────────────────────────────────────────────────────
// Lock times for the app
// ─────────────────────────────────────────────────────────

// Golden Boot lock: June 10, 2026 11:30 PM IST = June 10 18:00 UTC
export const GOLDEN_BOOT_LOCK = new Date('2026-06-10T18:00:00Z')

// Converts ET date+time string to a UTC Date object (EDT = UTC-4, summer)
function etToUTC(matchDate, matchTimeET) {
  const clean = matchTimeET.replace(' ET', '').trim()
  const [h, m] = clean.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  // ET is UTC-4 in summer (EDT). Add 4 hours to get UTC.
  // If UTC hours exceed 23 the date rolls to the next day — Date handles this automatically.
  return new Date(`${matchDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-04:00`)
}

// Is the Golden Boot pick currently locked?
export function isGoldenBootLocked() {
  return new Date() >= GOLDEN_BOOT_LOCK
}

// Is a specific match locked for predictions?
// Uses kickoff_utc if available (DB-authoritative), falls back to ET conversion
// Lock 1 hour before kick-off.
export function isMatchPredictionLocked(matchDate, matchTimeET, kickoffUTC) {
  if (kickoffUTC) {
    const lockTime = new Date(new Date(kickoffUTC).getTime() - 60 * 60 * 1000)
    return new Date() >= lockTime
  }
  if (!matchDate || !matchTimeET) return false
  const kickoff = etToUTC(matchDate, matchTimeET)
  if (!kickoff) return false
  const lockTime = new Date(kickoff.getTime() - 60 * 60 * 1000)
  return new Date() >= lockTime
}

// How long until lock (human-readable), returns null if already locked
// Uses kickoff_utc if available (DB-authoritative), falls back to ET conversion
export function timeUntilLock(matchDate, matchTimeET, kickoffUTC) {
  let lockTime
  if (kickoffUTC) {
    lockTime = new Date(new Date(kickoffUTC).getTime() - 60 * 60 * 1000)
  } else {
    if (!matchDate || !matchTimeET) return null
    const kickoff = etToUTC(matchDate, matchTimeET)
    if (!kickoff) return null
    lockTime = new Date(kickoff.getTime() - 60 * 60 * 1000)
  }
  const diff = lockTime - new Date()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `Locks in ${days}d ${hours}h`
  if (hours > 0) return `Locks in ${hours}h ${mins}m`
  if (mins > 0) return `Locks in ${mins}m`
  return 'Locking soon'
}
