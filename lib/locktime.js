// ─────────────────────────────────────────────────────────
// Lock times for the app
// ─────────────────────────────────────────────────────────

// Golden Boot lock: June 10, 2026 11:30 PM IST = June 10 18:00 UTC
export const GOLDEN_BOOT_LOCK = new Date('2026-06-10T18:00:00Z')

// Is the Golden Boot pick currently locked?
export function isGoldenBootLocked() {
  return new Date() >= GOLDEN_BOOT_LOCK
}

// Is a specific match locked for predictions?
// Lock 1 hour before kick-off.
// match_time is like "15:00 ET" (EDT = UTC-4 during June/July)
// So we convert to UTC by adding 4h, then compare now > kickoff_UTC - 1h
export function isMatchPredictionLocked(matchDate, matchTimeET) {
  if (!matchDate || !matchTimeET) return false
  const clean = matchTimeET.replace(' ET', '').trim()
  const [h, m] = clean.split(':').map(Number)
  // EDT = UTC-4, so UTC = ET + 4
  const kickoffUTC = new Date(`${matchDate}T${String(h + 4).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`)
  const lockTime = new Date(kickoffUTC.getTime() - 60 * 60 * 1000) // -1 hour
  return new Date() >= lockTime
}

// How long until lock (human-readable), returns null if already locked
export function timeUntilLock(matchDate, matchTimeET) {
  if (!matchDate || !matchTimeET) return null
  const clean = matchTimeET.replace(' ET', '').trim()
  const [h, m] = clean.split(':').map(Number)
  const kickoffUTC = new Date(`${matchDate}T${String(h + 4).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`)
  const lockTime = new Date(kickoffUTC.getTime() - 60 * 60 * 1000)
  const diff = lockTime - new Date()
  if (diff <= 0) return null
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `Locks in ${hours}h ${mins}m`
  if (mins > 0) return `Locks in ${mins}m`
  return 'Locking soon'
}
