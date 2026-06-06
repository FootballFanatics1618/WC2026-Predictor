// Country flag emoji map for all 48 WC2026 teams
export const FLAGS = {
  // Group A
  "Mexico": "🇲🇽",
  "South Korea": "🇰🇷",
  "Czechia": "🇨🇿",
  "South Africa": "🇿🇦",
  // Group B
  "Switzerland": "🇨🇭",
  "Canada": "🇨🇦",
  "Qatar": "🇶🇦",
  "Bosnia and Herzegovina": "🇧🇦",
  // Group C
  "Brazil": "🇧🇷",
  "Morocco": "🇲🇦",
  "Haiti": "🇭🇹",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  // Group D
  "USA": "🇺🇸",
  "Turkey": "🇹🇷",
  "Australia": "🇦🇺",
  "Paraguay": "🇵🇾",
  // Group E
  "Germany": "🇩🇪",
  "Ecuador": "🇪🇨",
  "Ivory Coast": "🇨🇮",
  "Curacao": "🇨🇼",
  // Group F
  "Netherlands": "🇳🇱",
  "Japan": "🇯🇵",
  "Sweden": "🇸🇪",
  "Tunisia": "🇹🇳",
  // Group G
  "Belgium": "🇧🇪",
  "Egypt": "🇪🇬",
  "Iran": "🇮🇷",
  "New Zealand": "🇳🇿",
  // Group H
  "Spain": "🇪🇸",
  "Cape Verde": "🇨🇻",
  "Saudi Arabia": "🇸🇦",
  "Uruguay": "🇺🇾",
  // Group I
  "France": "🇫🇷",
  "Senegal": "🇸🇳",
  "Iraq": "🇮🇶",
  "Norway": "🇳🇴",
  // Group J
  "Argentina": "🇦🇷",
  "Algeria": "🇩🇿",
  "Austria": "🇦🇹",
  "Jordan": "🇯🇴",
  // Group K
  "Portugal": "🇵🇹",
  "DR Congo": "🇨🇩",
  "Uzbekistan": "🇺🇿",
  "Colombia": "🇨🇴",
  // Group L
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Croatia": "🇭🇷",
  "Ghana": "🇬🇭",
  "Panama": "🇵🇦",
}

export function getFlag(teamName) {
  if (!teamName) return ""
  // For knockout placeholder labels like "Winner M74", return nothing
  if (teamName.includes("Winner") || teamName.includes("Runner") || teamName.includes("Best") || teamName.includes("Loser")) return "🏆"
  return FLAGS[teamName] || "🏳️"
}

// IST offset = UTC+5:30
// Convert "HH:MM ET" to IST
// ET = EST (UTC-5) Nov-Mar, EDT (UTC-4) Apr-Oct
// WC2026 runs June–July so EDT applies (UTC-4)
// IST = EDT + 9h30m
export function toIST(timeET) {
  if (!timeET) return ""
  const clean = timeET.replace(" ET", "").trim()
  const [h, m] = clean.split(":").map(Number)
  // EDT = UTC-4, IST = UTC+5:30 → diff = +9h30m
  let istH = h + 9
  let istM = m + 30
  if (istM >= 60) { istM -= 60; istH += 1 }
  istH = istH % 24
  const period = istH >= 12 ? "PM" : "AM"
  const h12 = istH % 12 === 0 ? 12 : istH % 12
  const mm = String(istM).padStart(2, "0")
  return `${h12}:${mm} ${period} IST`
}
