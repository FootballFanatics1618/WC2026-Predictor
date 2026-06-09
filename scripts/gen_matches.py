#!/usr/bin/env python3
"""Generate the MATCHES array for data.js from fixtures-new.json."""

import json
import os
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES_PATH = os.path.join(BASE_DIR, "fixtures-new.json")

VENUE_MAP = {
    "Mexico City": "Estadio Azteca, Mexico City",
    "Guadalajara (Zapopan)": "Estadio Akron, Guadalajara",
    "Toronto": "BMO Field, Toronto",
    "Los Angeles (Inglewood)": "SoFi Stadium, Los Angeles",
    "San Francisco Bay Area (Santa Clara)": "Levi's Stadium, San Francisco",
    "New York/New Jersey (East Rutherford)": "MetLife Stadium, New York/NJ",
    "Boston (Foxborough)": "Gillette Stadium, Boston",
    "Atlanta": "Mercedes-Benz Stadium, Atlanta",
    "Houston": "NRG Stadium, Houston",
    "Dallas (Arlington)": "AT&T Stadium, Dallas",
    "Seattle": "Lumen Field, Seattle",
    "Miami (Miami Gardens)": "Hard Rock Stadium, Miami",
    "Kansas City": "Arrowhead Stadium, Kansas City",
    "Vancouver": "BC Place, Vancouver",
    "Monterrey (Guadalupe)": "Estadio BBVA, Monterrey",
    "Philadelphia": "Lincoln Financial Field, Philadelphia",
}

TEAM_NAME_MAP = {
    "Czech Republic": "Czechia",
    "Bosnia & Herzegovina": "Bosnia and Herzegovina",
    "Cabo Verde": "Cape Verde",
    "\u00dcrkiye": "Turkey",
    "C\u00f4te d'Ivoire": "Ivory Coast",
    "IR Iran": "Iran",
    "Korea Republic": "South Korea",
    "Congo DR": "DR Congo",
}

STAGE_MAP = {
    "Round of 32": "Round of 32",
    "Round of 16": "Round of 16",
    "Quarter-final": "Quarter-final",
    "Semi-final": "Semi-final",
    "Match for third place": "3rd Place Play-off",
    "Final": "Final",
}


def map_stage(round_str):
    if round_str.startswith("Matchday"):
        return "Group Stage"
    return STAGE_MAP.get(round_str, round_str)


def map_team_name(name):
    return TEAM_NAME_MAP.get(name, name)


def parse_time_field(time_str):
    """Parse time field like '13:00 UTC-6' into (hours, minutes, offset_hours)."""
    parts = time_str.split()
    hm = parts[0].split(":")
    hour = int(hm[0])
    minute = int(hm[1])
    offset_str = parts[1]  # e.g. "UTC-6"
    sign = -1 if offset_str[3] == "-" else 1
    off_val = int(offset_str[4:])
    offset_hours = sign * off_val
    return hour, minute, offset_hours


def local_to_et(date_str, time_str):
    """Convert local time to ET (UTC-4 during DST).

    Formula: UTC = local - offset, ET = UTC - 4.
    """
    local_h, local_m, offset = parse_time_field(time_str)

    dt = datetime.strptime(date_str, "%Y-%m-%d")

    # Convert local time to minutes since midnight
    local_minutes = local_h * 60 + local_m

    # UTC = local - offset (offset is negative for west of UTC)
    utc_minutes = local_minutes - offset * 60

    # Normalize UTC to [0, 1440) and adjust date
    while utc_minutes >= 1440:
        utc_minutes -= 1440
        dt += timedelta(days=1)
    while utc_minutes < 0:
        utc_minutes += 1440
        dt -= timedelta(days=1)

    # ET = UTC - 4 (ET is UTC-4 during DST)
    et_minutes = utc_minutes - 4 * 60

    # Normalize ET to [0, 1440) and adjust date
    while et_minutes >= 1440:
        et_minutes -= 1440
        dt += timedelta(days=1)
    while et_minutes < 0:
        et_minutes += 1440
        dt -= timedelta(days=1)

    et_h = et_minutes // 60
    et_m = et_minutes % 60

    date_et = dt.strftime("%Y-%m-%d")
    time_et = f"{et_h:02d}:{et_m:02d}"
    return date_et, time_et


def main():
    with open(FIXTURES_PATH) as f:
        data = json.load(f)

    matches = data["matches"]
    lines = []

    for i, m in enumerate(matches):
        match_id = i + 1
        date_et, time_et = local_to_et(m["date"], m["time"])
        team_a = map_team_name(m["team1"])
        team_b = map_team_name(m["team2"])

        group_raw = m.get("group")
        group = group_raw.replace("Group ", "") if group_raw else None

        venue = VENUE_MAP.get(m["ground"], m["ground"])
        stage = map_stage(m["round"])

        # Determine knockout slot
        knockout_slot = None
        if "num" in m:
            num = m["num"]
        elif stage == "3rd Place Play-off":
            num = 103
        elif stage == "Final":
            num = 104
        else:
            num = None

        if num is not None:
            if num <= 88:
                knockout_slot = f"R32-M{num}"
            elif num <= 96:
                knockout_slot = f"R16-M{num}"
            elif num <= 100:
                knockout_slot = f"QF-M{num}"
            elif num <= 102:
                knockout_slot = f"SF-M{num}"
            elif num == 103:
                knockout_slot = f"3PO-M{num}"
            elif num == 104:
                knockout_slot = f"FINAL-M{num}"

        group_field = f'group:"{group}"' if group else "group:null"
        ks_field = f', knockoutSlot:"{knockout_slot}"' if knockout_slot else ""

        line = (
            f'  {{{match_id}, date:"{date_et}", time:"{time_et} ET", '
            f'teamA:"{team_a}", teamB:"{team_b}", '
            f'{group_field}, venue:"{venue}", stage:"{stage}"{ks_field}}},'
        )
        lines.append(line)

    print("\n".join(lines))


if __name__ == "__main__":
    main()
