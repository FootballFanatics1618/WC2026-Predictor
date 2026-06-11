// ISO 3166-1 alpha-2 codes for all 48 WC2026 teams
// Used with flagcdn.com for real flag images on all platforms
export const FLAG_CODES = {
  "Mexico": "mx",
  "South Korea": "kr",
  "Czechia": "cz",
  "South Africa": "za",
  "Switzerland": "ch",
  "Canada": "ca",
  "Qatar": "qa",
  "Bosnia and Herzegovina": "ba",
  "Brazil": "br",
  "Morocco": "ma",
  "Haiti": "ht",
  "Scotland": "gb-sct",
  "USA": "us",
  "Turkey": "tr",
  "Australia": "au",
  "Paraguay": "py",
  "Germany": "de",
  "Ecuador": "ec",
  "Ivory Coast": "ci",
  "Curacao": "cw",
  "Netherlands": "nl",
  "Japan": "jp",
  "Sweden": "se",
  "Tunisia": "tn",
  "Belgium": "be",
  "Egypt": "eg",
  "Iran": "ir",
  "New Zealand": "nz",
  "Spain": "es",
  "Cape Verde": "cv",
  "Saudi Arabia": "sa",
  "Uruguay": "uy",
  "France": "fr",
  "Senegal": "sn",
  "Iraq": "iq",
  "Norway": "no",
  "Argentina": "ar",
  "Algeria": "dz",
  "Austria": "at",
  "Jordan": "jo",
  "Portugal": "pt",
  "DR Congo": "cd",
  "Uzbekistan": "uz",
  "Colombia": "co",
  "England": "gb-eng",
  "Croatia": "hr",
  "Ghana": "gh",
  "Panama": "pa",
}

// Returns a URL to a 40x30 flag image from flagcdn.com (free, no API key)
export function getFlagUrl(teamName) {
  const code = FLAG_CODES[teamName]
  if (!code) return null
  return `https://flagcdn.com/w40/${code}.png`
}

// React component-safe: returns props for an <img> tag
export function getFlagImg(teamName, size = 24) {
  const code = FLAG_CODES[teamName]
  if (!code) return null
  return {
    src: `https://flagcdn.com/w40/${code}.png`,
    alt: teamName,
    width: Math.round(size * 4/3),
    height: size,
    style: { borderRadius: '2px', objectFit: 'cover', verticalAlign: 'middle', flexShrink: 0 }
  }
}

export function isKnockoutPlaceholder(teamName) {
  if (!teamName) return false
  return teamName.includes("Winner") || teamName.includes("Runner") || teamName.includes("Best") || teamName.includes("Loser")
}

// ─────────────────────────────────────────────────────────────────────────────
// IST Time Utilities (kickoff_utc-based, preferred)
// Uses the stored UTC kickoff timestamp for reliable IST conversion.
// ─────────────────────────────────────────────────────────────────────────────

// Returns the IST date string (YYYY-MM-DD) for a match, or for "now" if called without args
export function getISTDate(kickoffUTC) {
  const d = kickoffUTC ? new Date(kickoffUTC) : new Date()
  const istOff = 5.5 * 60 * 60 * 1000
  const ist = new Date(d.getTime() + istOff)
  const y = ist.getUTCFullYear()
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0')
  const day = String(ist.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isISTToday(match) {
  if (!match.kickoff_utc) {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    return match.match_date === today
  }
  return getISTDate(match.kickoff_utc) === getISTDate()
}

export function isISTPastDay(match) {
  return getISTDate(match.kickoff_utc) < getISTDate()
}

// IST conversion: uses kickoff_utc (preferred) or legacy ET time
export function toIST(timeET, kickoffUTC) {
  if (kickoffUTC) {
    const d = new Date(kickoffUTC)
    const istOff = 5.5 * 60 * 60 * 1000
    const ist = new Date(d.getTime() + istOff)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const h = ist.getUTCHours()
    const m = ist.getUTCMinutes()
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${days[ist.getUTCDay()]}, ${months[ist.getUTCMonth()]} ${ist.getUTCDate()}, ${h12}:${String(m).padStart(2, '0')} ${period} IST`
  }
  if (!timeET) return ''
  const clean = timeET.replace(' ET', '').trim()
  const [h, m] = clean.split(':').map(Number)
  let istH = h + 9
  let istM = m + 30
  if (istM >= 60) { istM -= 60; istH += 1 }
  const nextDay = istH >= 24
  istH = istH % 24
  const period = istH >= 12 ? 'PM' : 'AM'
  const h12 = istH % 12 === 0 ? 12 : istH % 12
  const mm = String(istM).padStart(2, '0')
  return `${h12}:${mm} ${period} IST${nextDay ? ' (+1 day)' : ''}`
}

// ─────────────────────────────────────────────────────────────────────────────
// IST Time Utilities (ET-based, legacy)
// For code that still uses match_date + match_time from the DB.
// ─────────────────────────────────────────────────────────────────────────────

export function toISTFull(timeET) {
  if (!timeET) return { time: "", dayOffset: 0 }
  const clean = timeET.replace(" ET", "").trim()
  const [h, m] = clean.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return { time: timeET, dayOffset: 0 }
  let istH = h + 9
  let istM = m + 30
  if (istM >= 60) { istM -= 60; istH += 1 }
  const dayOffset = istH >= 24 ? 1 : 0
  istH = istH % 24
  const period = istH >= 12 ? 'PM' : 'AM'
  const h12 = istH % 12 === 0 ? 12 : istH % 12
  const mm = String(istM).padStart(2, "0")
  return { time: `${h12}:${mm} ${period} IST`, dayOffset }
}

export function getKickoffUTC(matchDate, matchTimeET) {
  const clean = (matchTimeET || "").replace(" ET", "").trim()
  const [h, m] = clean.split(":").map(Number)
  if (!matchDate || isNaN(h) || isNaN(m)) return null
  return new Date(`${matchDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-04:00`)
}

export function getISTKickoffDate(matchDate, matchTimeET) {
  const kickoffUTC = getKickoffUTC(matchDate, matchTimeET)
  if (!kickoffUTC) return null
  const istMs = kickoffUTC.getTime() + 5.5 * 60 * 60 * 1000
  const istDate = new Date(istMs)
  return new Date(Date.UTC(
    istDate.getUTCFullYear(),
    istDate.getUTCMonth(),
    istDate.getUTCDate()
  ))
}

export function todayIST() {
  const now = new Date()
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000
  const d = new Date(istMs)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}

export function matchISTDate(matchDate, matchTimeET) {
  const d = getISTKickoffDate(matchDate, matchTimeET)
  if (!d) return matchDate
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}
