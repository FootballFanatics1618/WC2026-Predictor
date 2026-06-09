-- 004_sync_fixtures.sql
-- Update matches table with fixture data from worldcup2026-fixtures.json
-- Generated from lib/data.js MATCHES array
--
-- IMPORTANT: This only updates schedule/fixture data (dates, times, teams, groups, venues).
-- It does NOT touch result, score_a, score_b, or any prediction data.
-- Run this in Supabase SQL Editor.

-- Helper: convert ET time (HH:MM) to UTC timestamp for a given date
-- ET = UTC-4 during DST (June-July), so UTC = ET + 4 hours
CREATE OR REPLACE FUNCTION et_to_utc(match_date date, et_time text)
RETURNS timestamptz AS $$
DECLARE
  hours int;
  mins int;
  raw_hour int;
BEGIN
  raw_hour := split_part(et_time, ':', 1)::int;
  mins := split_part(split_part(et_time, ':', 2), ' ', 1)::int;
  hours := raw_hour + 4; -- ET is UTC-4
  IF hours >= 24 THEN
    hours := hours - 24;
    RETURN (match_date + interval '1 day' + (hours || ' hours')::interval + (mins || ' minutes')::interval)::timestamptz;
  END IF;
  RETURN (match_date + (hours || ' hours')::interval + (mins || ' minutes')::interval)::timestamptz;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update all group stage matches (1-72)
UPDATE matches SET
  match_date = v.date::date,
  match_time = v.time,
  team_a = v.team_a,
  team_b = v.team_b,
  group_name = v.group_name,
  venue = v.venue,
  kickoff_utc = et_to_utc(v.date::date, v.time)
FROM (VALUES
  (1,  '2026-06-11', '11:00 ET', 'Mexico',             'South Africa',            'A', 'Estadio Azteca, Mexico City'),
  (2,  '2026-06-11', '18:00 ET', 'South Korea',        'Czechia',                 'A', 'Estadio Akron, Guadalajara'),
  (3,  '2026-06-12', '15:00 ET', 'Canada',             'Bosnia and Herzegovina',   'B', 'BMO Field, Toronto'),
  (4,  '2026-06-12', '15:00 ET', 'USA',                'Paraguay',                 'D', 'SoFi Stadium, Los Angeles'),
  (5,  '2026-06-13', '09:00 ET', 'Qatar',              'Switzerland',              'B', 'Levi''s Stadium, San Francisco'),
  (6,  '2026-06-13', '18:00 ET', 'Brazil',             'Morocco',                  'C', 'MetLife Stadium, New York/NJ'),
  (7,  '2026-06-13', '18:00 ET', 'Australia',          'Turkey',                   'D', 'SoFi Stadium, Los Angeles'),
  (8,  '2026-06-13', '21:00 ET', 'Haiti',              'Scotland',                 'C', 'Gillette Stadium, Boston'),
  (9,  '2026-06-14', '11:00 ET', 'Germany',            'Curacao',                  'E', 'AT&T Stadium, Dallas'),
  (10, '2026-06-14', '14:00 ET', 'Netherlands',        'Japan',                    'F', 'AT&T Stadium, Dallas'),
  (11, '2026-06-14', '18:00 ET', 'Sweden',             'Tunisia',                  'F', 'Estadio BBVA, Monterrey'),
  (12, '2026-06-14', '19:00 ET', 'Ivory Coast',        'Ecuador',                  'E', 'Lincoln Financial Field, Philadelphia'),
  (13, '2026-06-15', '09:00 ET', 'Belgium',            'Egypt',                    'G', 'Lumen Field, Seattle'),
  (14, '2026-06-15', '12:00 ET', 'Spain',              'Cape Verde',               'H', 'Mercedes-Benz Stadium, Atlanta'),
  (15, '2026-06-15', '15:00 ET', 'Iran',               'New Zealand',              'G', 'SoFi Stadium, Los Angeles'),
  (16, '2026-06-15', '18:00 ET', 'Saudi Arabia',       'Uruguay',                  'H', 'Hard Rock Stadium, Miami'),
  (17, '2026-06-16', '15:00 ET', 'France',             'Senegal',                  'I', 'MetLife Stadium, New York/NJ'),
  (18, '2026-06-16', '18:00 ET', 'Iraq',               'Norway',                   'I', 'Gillette Stadium, Boston'),
  (19, '2026-06-16', '18:00 ET', 'Austria',            'Jordan',                   'J', 'Levi''s Stadium, San Francisco'),
  (20, '2026-06-16', '19:00 ET', 'Argentina',          'Algeria',                  'J', 'Arrowhead Stadium, Kansas City'),
  (21, '2026-06-17', '11:00 ET', 'Portugal',           'DR Congo',                 'K', 'NRG Stadium, Houston'),
  (22, '2026-06-17', '14:00 ET', 'England',            'Croatia',                  'L', 'AT&T Stadium, Dallas'),
  (23, '2026-06-17', '18:00 ET', 'Uzbekistan',         'Colombia',                 'K', 'Estadio Azteca, Mexico City'),
  (24, '2026-06-17', '19:00 ET', 'Ghana',              'Panama',                   'L', 'BMO Field, Toronto'),
  (25, '2026-06-18', '09:00 ET', 'Switzerland',        'Bosnia and Herzegovina',   'B', 'BC Place, Vancouver'),
  (26, '2026-06-18', '12:00 ET', 'Czechia',            'South Africa',             'A', 'Estadio BBVA, Monterrey'),
  (27, '2026-06-18', '12:00 ET', 'Canada',             'Qatar',                    'B', 'BC Place, Vancouver'),
  (28, '2026-06-18', '17:00 ET', 'Mexico',             'South Korea',              'A', 'Estadio Azteca, Mexico City'),
  (29, '2026-06-19', '09:00 ET', 'USA',                'Australia',                'D', 'Lumen Field, Seattle'),
  (30, '2026-06-19', '17:00 ET', 'Turkey',             'Paraguay',                 'D', 'Levi''s Stadium, San Francisco'),
  (31, '2026-06-19', '18:00 ET', 'Scotland',           'Morocco',                  'C', 'Gillette Stadium, Boston'),
  (32, '2026-06-19', '20:30 ET', 'Brazil',             'Haiti',                    'C', 'Lincoln Financial Field, Philadelphia'),
  (33, '2026-06-20', '11:00 ET', 'Netherlands',        'Sweden',                   'F', 'NRG Stadium, Houston'),
  (34, '2026-06-20', '16:00 ET', 'Germany',            'Ivory Coast',              'E', 'BMO Field, Toronto'),
  (35, '2026-06-20', '18:00 ET', 'Ecuador',            'Curacao',                  'E', 'Arrowhead Stadium, Kansas City'),
  (36, '2026-06-20', '20:00 ET', 'Tunisia',            'Japan',                    'F', 'Estadio BBVA, Monterrey'),
  (37, '2026-06-21', '09:00 ET', 'Belgium',            'Iran',                     'G', 'SoFi Stadium, Los Angeles'),
  (38, '2026-06-21', '12:00 ET', 'Spain',              'Saudi Arabia',             'H', 'Mercedes-Benz Stadium, Atlanta'),
  (39, '2026-06-21', '15:00 ET', 'New Zealand',        'Egypt',                    'G', 'BC Place, Vancouver'),
  (40, '2026-06-21', '18:00 ET', 'Uruguay',            'Cape Verde',               'H', 'Hard Rock Stadium, Miami'),
  (41, '2026-06-22', '11:00 ET', 'Argentina',          'Austria',                  'J', 'AT&T Stadium, Dallas'),
  (42, '2026-06-22', '17:00 ET', 'France',             'Iraq',                     'I', 'Lincoln Financial Field, Philadelphia'),
  (43, '2026-06-22', '17:00 ET', 'Jordan',             'Algeria',                  'J', 'Levi''s Stadium, San Francisco'),
  (44, '2026-06-22', '20:00 ET', 'Norway',             'Senegal',                  'I', 'MetLife Stadium, New York/NJ'),
  (45, '2026-06-23', '11:00 ET', 'Portugal',           'Uzbekistan',               'K', 'NRG Stadium, Houston'),
  (46, '2026-06-23', '16:00 ET', 'England',            'Ghana',                    'L', 'Gillette Stadium, Boston'),
  (47, '2026-06-23', '18:00 ET', 'Colombia',           'DR Congo',                 'K', 'Estadio Akron, Guadalajara'),
  (48, '2026-06-23', '19:00 ET', 'Panama',             'Croatia',                  'L', 'BMO Field, Toronto'),
  (49, '2026-06-24', '09:00 ET', 'Switzerland',        'Canada',                   'B', 'BC Place, Vancouver'),
  (50, '2026-06-24', '09:00 ET', 'Bosnia and Herzegovina', 'Qatar',               'B', 'Lumen Field, Seattle'),
  (51, '2026-06-24', '17:00 ET', 'Czechia',            'Mexico',                   'A', 'Estadio BBVA, Monterrey'),
  (52, '2026-06-24', '17:00 ET', 'South Africa',       'South Korea',              'A', 'Mercedes-Benz Stadium, Atlanta'),
  (53, '2026-06-24', '18:00 ET', 'Scotland',           'Brazil',                   'C', 'Hard Rock Stadium, Miami'),
  (54, '2026-06-24', '18:00 ET', 'Morocco',            'Haiti',                    'C', 'Mercedes-Benz Stadium, Atlanta'),
  (55, '2026-06-25', '16:00 ET', 'Curacao',            'Ivory Coast',              'E', 'Lincoln Financial Field, Philadelphia'),
  (56, '2026-06-25', '16:00 ET', 'Ecuador',            'Germany',                  'E', 'MetLife Stadium, New York/NJ'),
  (57, '2026-06-25', '16:00 ET', 'Turkey',             'USA',                      'D', 'SoFi Stadium, Los Angeles'),
  (58, '2026-06-25', '16:00 ET', 'Paraguay',           'Australia',                'D', 'Levi''s Stadium, San Francisco'),
  (59, '2026-06-25', '17:00 ET', 'Japan',              'Sweden',                   'F', 'AT&T Stadium, Dallas'),
  (60, '2026-06-25', '17:00 ET', 'Tunisia',            'Netherlands',              'F', 'Arrowhead Stadium, Kansas City'),
  (61, '2026-06-26', '15:00 ET', 'Norway',             'France',                   'I', 'Gillette Stadium, Boston'),
  (62, '2026-06-26', '15:00 ET', 'Senegal',            'Iraq',                     'I', 'BMO Field, Toronto'),
  (63, '2026-06-26', '16:00 ET', 'Uruguay',            'Spain',                    'H', 'Estadio Akron, Guadalajara'),
  (64, '2026-06-26', '17:00 ET', 'Egypt',              'Iran',                     'G', 'Lumen Field, Seattle'),
  (65, '2026-06-26', '17:00 ET', 'New Zealand',        'Belgium',                  'G', 'BC Place, Vancouver'),
  (66, '2026-06-26', '18:00 ET', 'Cape Verde',         'Saudi Arabia',             'H', 'NRG Stadium, Houston'),
  (67, '2026-06-27', '17:00 ET', 'Panama',             'England',                  'L', 'MetLife Stadium, New York/NJ'),
  (68, '2026-06-27', '17:00 ET', 'Croatia',            'Ghana',                    'L', 'Lincoln Financial Field, Philadelphia'),
  (69, '2026-06-27', '19:30 ET', 'Colombia',           'Portugal',                 'K', 'Hard Rock Stadium, Miami'),
  (70, '2026-06-27', '19:30 ET', 'DR Congo',           'Uzbekistan',               'K', 'Mercedes-Benz Stadium, Atlanta'),
  (71, '2026-06-27', '20:00 ET', 'Algeria',            'Austria',                  'J', 'Arrowhead Stadium, Kansas City'),
  (72, '2026-06-27', '20:00 ET', 'Jordan',             'Argentina',                'J', 'AT&T Stadium, Dallas')
) AS v(id, date, time, team_a, team_b, group_name, venue)
WHERE matches.id = v.id;

-- Update knockout matches (73-104) — dates, times, venues only (team placeholders stay)
UPDATE matches SET
  match_date = v.date::date,
  match_time = v.time,
  venue = v.venue,
  kickoff_utc = et_to_utc(v.date::date, v.time)
FROM (VALUES
  (73,  '2026-06-28', '09:00 ET', 'SoFi Stadium, Los Angeles'),
  (74,  '2026-06-29', '16:30 ET', 'Gillette Stadium, Boston'),
  (75,  '2026-06-29', '17:00 ET', 'Estadio BBVA, Monterrey'),
  (76,  '2026-06-29', '11:00 ET', 'NRG Stadium, Houston'),
  (77,  '2026-06-30', '17:00 ET', 'MetLife Stadium, New York/NJ'),
  (78,  '2026-06-30', '11:00 ET', 'AT&T Stadium, Dallas'),
  (79,  '2026-06-30', '17:00 ET', 'Estadio Azteca, Mexico City'),
  (80,  '2026-07-01', '12:00 ET', 'Mercedes-Benz Stadium, Atlanta'),
  (81,  '2026-07-01', '14:00 ET', 'Levi''s Stadium, San Francisco'),
  (82,  '2026-07-01', '10:00 ET', 'Lumen Field, Seattle'),
  (83,  '2026-07-02', '19:00 ET', 'BMO Field, Toronto'),
  (84,  '2026-07-02', '09:00 ET', 'SoFi Stadium, Los Angeles'),
  (85,  '2026-07-02', '17:00 ET', 'BC Place, Vancouver'),
  (86,  '2026-07-03', '18:00 ET', 'Hard Rock Stadium, Miami'),
  (87,  '2026-07-03', '19:30 ET', 'Arrowhead Stadium, Kansas City'),
  (88,  '2026-07-03', '12:00 ET', 'AT&T Stadium, Dallas'),
  (89,  '2026-07-04', '17:00 ET', 'Lincoln Financial Field, Philadelphia'),
  (90,  '2026-07-04', '11:00 ET', 'NRG Stadium, Houston'),
  (91,  '2026-07-05', '16:00 ET', 'MetLife Stadium, New York/NJ'),
  (92,  '2026-07-05', '16:00 ET', 'Estadio Azteca, Mexico City'),
  (93,  '2026-07-06', '13:00 ET', 'Levi''s Stadium, San Francisco'),
  (94,  '2026-07-06', '14:00 ET', 'SoFi Stadium, Los Angeles'),
  (95,  '2026-07-07', '12:00 ET', 'Hard Rock Stadium, Miami'),
  (96,  '2026-07-07', '10:00 ET', 'AT&T Stadium, Dallas'),
  (97,  '2026-07-09', '16:00 ET', 'MetLife Stadium, New York/NJ'),
  (98,  '2026-07-10', '09:00 ET', 'AT&T Stadium, Dallas'),
  (99,  '2026-07-11', '17:00 ET', 'Levi''s Stadium, San Francisco'),
  (100, '2026-07-11', '19:00 ET', 'NRG Stadium, Houston'),
  (101, '2026-07-14', '13:00 ET', 'MetLife Stadium, New York/NJ'),
  (102, '2026-07-15', '15:00 ET', 'AT&T Stadium, Dallas'),
  (103, '2026-07-18', '17:00 ET', 'Hard Rock Stadium, Miami'),
  (104,'2026-07-19', '15:00 ET', 'MetLife Stadium, New York/NJ')
) AS v(id, date, time, venue)
WHERE matches.id = v.id;

-- Drop the helper function
DROP FUNCTION IF EXISTS et_to_utc(date, text);
