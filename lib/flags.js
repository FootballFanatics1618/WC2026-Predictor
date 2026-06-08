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

// IST conversion: EDT (UTC-4) + 9h30m = IST (UTC+5:30)
// Returns { time: "12:30 AM IST", dayOffset: 1 }
// dayOffset=1 means the IST kickoff is on the *next* calendar day vs the ET date
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
  const period = istH >= 12 ? "PM" : "AM"
  const h12 = istH % 12 === 0 ? 12 : istH % 12
  const mm = String(istM).padStart(2, "0")
  return { time: `${h12}:${mm} ${period} IST`, dayOffset }
}

// Convenience wrapper — returns just the time string (legacy compat)
export function toIST(timeET) {
  return toISTFull(timeET).time
}
