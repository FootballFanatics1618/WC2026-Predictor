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
// IST Time Utilities
// All fixtures are stored with ET (Eastern Time / UTC-4 in summer) dates & times.
// IST = UTC+5:30 = EDT + 9h30m
//
// IMPORTANT: The match_date in the DB is the LOCAL ET date of the fixture.
// When converting to IST, we must also account for the date rolling forward.
//
// toISTFull(timeET) → { time: "12:30 AM IST", dayOffset: 0|1 }
//   dayOffset = 1 means the IST kickoff falls on the *next* calendar day vs the ET date.
//
// toIST(timeET) → "12:30 AM IST"  (legacy convenience wrapper)
//
// getISTDate(matchDate, matchTimeET) → Date object representing the IST kickoff instant
//   Use this to compare against the user's local "today" in IST.
// ─────────────────────────────────────────────────────────────────────────────

export function toISTFull(timeET) {
  if (!timeET) return { time: "", dayOffset: 0 }
  const clean = timeET.replace(" ET", "").trim()
  const [h, m] = clean.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return { time: timeET, dayOffset: 0 }
  // EDT = UTC-4; IST = UTC+5:30; difference = +9h30m
  let istH = h + 9
  let istM = m + 30
  if (istM >= 60) { istM -= 60; istH += 1 }
  const dayOffset = istH >= 24 ? 1 : 0
  istH = istH % 24
  const period = istH >= 12 ? "PM" : "AM"
  const h12 = istH % 12 === 0 ? 12 : istH % 12
  const mm = String(istM).padStart(2, "0")
  return { time: `${h12}:${mm} ${period} IST`, dayOffset }
}

// Convenience wrapper — returns just the time string (legacy compat)
export function toIST(timeET) {
  return toISTFull(timeET).time
}

/**
 * Returns the actual UTC Date object for a match's kickoff, given the ET date and time.
 * This correctly handles EDT (UTC-4) and is safe to compare against new Date() on any device.
 *
 * @param {string} matchDate  e.g. "2026-06-12"
 * @param {string} matchTimeET e.g. "15:00 ET"
 * @returns {Date}
 */
export function getKickoffUTC(matchDate, matchTimeET) {
  const clean = (matchTimeET || "").replace(" ET", "").trim()
  const [h, m] = clean.split(":").map(Number)
  if (!matchDate || isNaN(h) || isNaN(m)) return null
  // EDT = UTC-4
  return new Date(`${matchDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-04:00`)
}

/**
 * Returns the IST Date object for the *day* on which the IST kickoff falls.
 * Use this when you need to compare a match's IST date against "today in IST".
 *
 * @param {string} matchDate  e.g. "2026-06-11"
 * @param {string} matchTimeET e.g. "14:30 ET"
 * @returns {Date}  A Date representing midnight (IST) of the IST kickoff date
 */
export function getISTKickoffDate(matchDate, matchTimeET) {
  const kickoffUTC = getKickoffUTC(matchDate, matchTimeET)
  if (!kickoffUTC) return null
  // Convert to IST: UTC+5:30 = +330 minutes
  const istMs = kickoffUTC.getTime() + 5.5 * 60 * 60 * 1000
  const istDate = new Date(istMs)
  // Return a Date at midnight UTC that represents the IST calendar date
  return new Date(Date.UTC(
    istDate.getUTCFullYear(),
    istDate.getUTCMonth(),
    istDate.getUTCDate()
  ))
}

/**
 * Returns today's date in IST as a "YYYY-MM-DD" string.
 */
export function todayIST() {
  const now = new Date()
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000
  const d = new Date(istMs)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}

/**
 * Returns the IST calendar date of a match as a "YYYY-MM-DD" string.
 */
export function matchISTDate(matchDate, matchTimeET) {
  const d = getISTKickoffDate(matchDate, matchTimeET)
  if (!d) return matchDate
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}
