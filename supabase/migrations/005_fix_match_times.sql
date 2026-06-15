-- 005_fix_match_times.sql
-- Correct all 104 match dates, times, kickoff_utc, teams, groups, venues, and stages
-- Data sourced from fixtures-new.json (verified against FIFA.com UTC times)
-- Run this in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION et_to_utc(match_date date, et_time text)
RETURNS timestamptz AS $$
DECLARE
  hours int;
  mins int;
  raw_hour int;
BEGIN
  raw_hour := split_part(et_time, ':', 1)::int;
  mins := split_part(split_part(et_time, ':', 2), ' ', 1)::int;
  hours := raw_hour + 4;
  IF hours >= 24 THEN
    hours := hours - 24;
    RETURN (match_date + interval '1 day' + (hours || ' hours')::interval + (mins || ' minutes')::interval)::timestamptz;
  END IF;
  RETURN (match_date + (hours || ' hours')::interval + (mins || ' minutes')::interval)::timestamptz;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── ALL 104 MATCHES ──────────────────────────────────────

UPDATE public.matches SET
  match_date = '2026-06-11'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-11'::date, '15:00'),
  team_a = 'Mexico',
  team_b = 'South Africa',
  group_name = 'A',
  venue = 'Estadio Azteca, Mexico City',
  stage = 'Group Stage'
WHERE id = 1;

UPDATE public.matches SET
  match_date = '2026-06-11'::date,
  match_time = '22:00 ET',
  kickoff_utc = et_to_utc('2026-06-11'::date, '22:00'),
  team_a = 'South Korea',
  team_b = 'Czechia',
  group_name = 'A',
  venue = 'Estadio Akron, Guadalajara',
  stage = 'Group Stage'
WHERE id = 2;

UPDATE public.matches SET
  match_date = '2026-06-12'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-12'::date, '15:00'),
  team_a = 'Canada',
  team_b = 'Bosnia and Herzegovina',
  group_name = 'B',
  venue = 'BMO Field, Toronto',
  stage = 'Group Stage'
WHERE id = 3;

UPDATE public.matches SET
  match_date = '2026-06-12'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-12'::date, '21:00'),
  team_a = 'USA',
  team_b = 'Paraguay',
  group_name = 'D',
  venue = 'SoFi Stadium, Los Angeles',
  stage = 'Group Stage'
WHERE id = 4;

UPDATE public.matches SET
  match_date = '2026-06-13'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-13'::date, '15:00'),
  team_a = 'Qatar',
  team_b = 'Switzerland',
  group_name = 'B',
  venue = 'Levi''s Stadium, San Francisco',
  stage = 'Group Stage'
WHERE id = 5;

UPDATE public.matches SET
  match_date = '2026-06-13'::date,
  match_time = '18:00 ET',
  kickoff_utc = et_to_utc('2026-06-13'::date, '18:00'),
  team_a = 'Brazil',
  team_b = 'Morocco',
  group_name = 'C',
  venue = 'MetLife Stadium, New York/NJ',
  stage = 'Group Stage'
WHERE id = 6;

UPDATE public.matches SET
  match_date = '2026-06-13'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-13'::date, '21:00'),
  team_a = 'Haiti',
  team_b = 'Scotland',
  group_name = 'C',
  venue = 'Gillette Stadium, Boston',
  stage = 'Group Stage'
WHERE id = 7;

UPDATE public.matches SET
  match_date = '2026-06-14'::date,
  match_time = '00:00 ET',
  kickoff_utc = et_to_utc('2026-06-14'::date, '00:00'),
  team_a = 'Australia',
  team_b = 'Turkey',
  group_name = 'D',
  venue = 'BC Place, Vancouver',
  stage = 'Group Stage'
WHERE id = 8;

UPDATE public.matches SET
  match_date = '2026-06-14'::date,
  match_time = '13:00 ET',
  kickoff_utc = et_to_utc('2026-06-14'::date, '13:00'),
  team_a = 'Germany',
  team_b = 'Curacao',
  group_name = 'E',
  venue = 'NRG Stadium, Houston',
  stage = 'Group Stage'
WHERE id = 9;

UPDATE public.matches SET
  match_date = '2026-06-14'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-06-14'::date, '16:00'),
  team_a = 'Netherlands',
  team_b = 'Japan',
  group_name = 'F',
  venue = 'AT&T Stadium, Dallas',
  stage = 'Group Stage'
WHERE id = 10;

UPDATE public.matches SET
  match_date = '2026-06-14'::date,
  match_time = '19:00 ET',
  kickoff_utc = et_to_utc('2026-06-14'::date, '19:00'),
  team_a = 'Ivory Coast',
  team_b = 'Ecuador',
  group_name = 'E',
  venue = 'Lincoln Financial Field, Philadelphia',
  stage = 'Group Stage'
WHERE id = 11;

UPDATE public.matches SET
  match_date = '2026-06-14'::date,
  match_time = '22:00 ET',
  kickoff_utc = et_to_utc('2026-06-14'::date, '22:00'),
  team_a = 'Sweden',
  team_b = 'Tunisia',
  group_name = 'F',
  venue = 'Estadio BBVA, Monterrey',
  stage = 'Group Stage'
WHERE id = 12;

UPDATE public.matches SET
  match_date = '2026-06-15'::date,
  match_time = '12:00 ET',
  kickoff_utc = et_to_utc('2026-06-15'::date, '12:00'),
  team_a = 'Spain',
  team_b = 'Cape Verde',
  group_name = 'H',
  venue = 'Mercedes-Benz Stadium, Atlanta',
  stage = 'Group Stage'
WHERE id = 13;

UPDATE public.matches SET
  match_date = '2026-06-15'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-15'::date, '15:00'),
  team_a = 'Belgium',
  team_b = 'Egypt',
  group_name = 'G',
  venue = 'Lumen Field, Seattle',
  stage = 'Group Stage'
WHERE id = 14;

UPDATE public.matches SET
  match_date = '2026-06-15'::date,
  match_time = '18:00 ET',
  kickoff_utc = et_to_utc('2026-06-15'::date, '18:00'),
  team_a = 'Saudi Arabia',
  team_b = 'Uruguay',
  group_name = 'H',
  venue = 'Hard Rock Stadium, Miami',
  stage = 'Group Stage'
WHERE id = 15;

UPDATE public.matches SET
  match_date = '2026-06-15'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-15'::date, '21:00'),
  team_a = 'Iran',
  team_b = 'New Zealand',
  group_name = 'G',
  venue = 'SoFi Stadium, Los Angeles',
  stage = 'Group Stage'
WHERE id = 16;

UPDATE public.matches SET
  match_date = '2026-06-16'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-16'::date, '15:00'),
  team_a = 'France',
  team_b = 'Senegal',
  group_name = 'I',
  venue = 'MetLife Stadium, New York/NJ',
  stage = 'Group Stage'
WHERE id = 17;

UPDATE public.matches SET
  match_date = '2026-06-16'::date,
  match_time = '18:00 ET',
  kickoff_utc = et_to_utc('2026-06-16'::date, '18:00'),
  team_a = 'Iraq',
  team_b = 'Norway',
  group_name = 'I',
  venue = 'Gillette Stadium, Boston',
  stage = 'Group Stage'
WHERE id = 18;

UPDATE public.matches SET
  match_date = '2026-06-16'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-16'::date, '21:00'),
  team_a = 'Argentina',
  team_b = 'Algeria',
  group_name = 'J',
  venue = 'Arrowhead Stadium, Kansas City',
  stage = 'Group Stage'
WHERE id = 19;

UPDATE public.matches SET
  match_date = '2026-06-17'::date,
  match_time = '00:00 ET',
  kickoff_utc = et_to_utc('2026-06-17'::date, '00:00'),
  team_a = 'Austria',
  team_b = 'Jordan',
  group_name = 'J',
  venue = 'Levi''s Stadium, San Francisco',
  stage = 'Group Stage'
WHERE id = 20;

UPDATE public.matches SET
  match_date = '2026-06-17'::date,
  match_time = '13:00 ET',
  kickoff_utc = et_to_utc('2026-06-17'::date, '13:00'),
  team_a = 'Portugal',
  team_b = 'DR Congo',
  group_name = 'K',
  venue = 'NRG Stadium, Houston',
  stage = 'Group Stage'
WHERE id = 21;

UPDATE public.matches SET
  match_date = '2026-06-17'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-06-17'::date, '16:00'),
  team_a = 'England',
  team_b = 'Croatia',
  group_name = 'L',
  venue = 'AT&T Stadium, Dallas',
  stage = 'Group Stage'
WHERE id = 22;

UPDATE public.matches SET
  match_date = '2026-06-17'::date,
  match_time = '19:00 ET',
  kickoff_utc = et_to_utc('2026-06-17'::date, '19:00'),
  team_a = 'Ghana',
  team_b = 'Panama',
  group_name = 'L',
  venue = 'BMO Field, Toronto',
  stage = 'Group Stage'
WHERE id = 23;

UPDATE public.matches SET
  match_date = '2026-06-17'::date,
  match_time = '22:00 ET',
  kickoff_utc = et_to_utc('2026-06-17'::date, '22:00'),
  team_a = 'Uzbekistan',
  team_b = 'Colombia',
  group_name = 'K',
  venue = 'Estadio Azteca, Mexico City',
  stage = 'Group Stage'
WHERE id = 24;

UPDATE public.matches SET
  match_date = '2026-06-18'::date,
  match_time = '12:00 ET',
  kickoff_utc = et_to_utc('2026-06-18'::date, '12:00'),
  team_a = 'Czechia',
  team_b = 'South Africa',
  group_name = 'A',
  venue = 'Mercedes-Benz Stadium, Atlanta',
  stage = 'Group Stage'
WHERE id = 25;

UPDATE public.matches SET
  match_date = '2026-06-18'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-18'::date, '15:00'),
  team_a = 'Switzerland',
  team_b = 'Bosnia and Herzegovina',
  group_name = 'B',
  venue = 'SoFi Stadium, Los Angeles',
  stage = 'Group Stage'
WHERE id = 26;

UPDATE public.matches SET
  match_date = '2026-06-18'::date,
  match_time = '18:00 ET',
  kickoff_utc = et_to_utc('2026-06-18'::date, '18:00'),
  team_a = 'Canada',
  team_b = 'Qatar',
  group_name = 'B',
  venue = 'BC Place, Vancouver',
  stage = 'Group Stage'
WHERE id = 27;

UPDATE public.matches SET
  match_date = '2026-06-18'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-18'::date, '21:00'),
  team_a = 'Mexico',
  team_b = 'South Korea',
  group_name = 'A',
  venue = 'Estadio Akron, Guadalajara',
  stage = 'Group Stage'
WHERE id = 28;

UPDATE public.matches SET
  match_date = '2026-06-19'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-19'::date, '15:00'),
  team_a = 'USA',
  team_b = 'Australia',
  group_name = 'D',
  venue = 'Lumen Field, Seattle',
  stage = 'Group Stage'
WHERE id = 29;

UPDATE public.matches SET
  match_date = '2026-06-19'::date,
  match_time = '18:00 ET',
  kickoff_utc = et_to_utc('2026-06-19'::date, '18:00'),
  team_a = 'Scotland',
  team_b = 'Morocco',
  group_name = 'C',
  venue = 'Gillette Stadium, Boston',
  stage = 'Group Stage'
WHERE id = 30;

UPDATE public.matches SET
  match_date = '2026-06-19'::date,
  match_time = '20:30 ET',
  kickoff_utc = et_to_utc('2026-06-19'::date, '20:30'),
  team_a = 'Brazil',
  team_b = 'Haiti',
  group_name = 'C',
  venue = 'Lincoln Financial Field, Philadelphia',
  stage = 'Group Stage'
WHERE id = 31;

UPDATE public.matches SET
  match_date = '2026-06-19'::date,
  match_time = '23:00 ET',
  kickoff_utc = et_to_utc('2026-06-19'::date, '23:00'),
  team_a = 'Turkey',
  team_b = 'Paraguay',
  group_name = 'D',
  venue = 'Levi''s Stadium, San Francisco',
  stage = 'Group Stage'
WHERE id = 32;

UPDATE public.matches SET
  match_date = '2026-06-20'::date,
  match_time = '13:00 ET',
  kickoff_utc = et_to_utc('2026-06-20'::date, '13:00'),
  team_a = 'Netherlands',
  team_b = 'Sweden',
  group_name = 'F',
  venue = 'NRG Stadium, Houston',
  stage = 'Group Stage'
WHERE id = 33;

UPDATE public.matches SET
  match_date = '2026-06-20'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-06-20'::date, '16:00'),
  team_a = 'Germany',
  team_b = 'Ivory Coast',
  group_name = 'E',
  venue = 'BMO Field, Toronto',
  stage = 'Group Stage'
WHERE id = 34;

UPDATE public.matches SET
  match_date = '2026-06-20'::date,
  match_time = '20:00 ET',
  kickoff_utc = et_to_utc('2026-06-20'::date, '20:00'),
  team_a = 'Ecuador',
  team_b = 'Curacao',
  group_name = 'E',
  venue = 'Arrowhead Stadium, Kansas City',
  stage = 'Group Stage'
WHERE id = 35;

UPDATE public.matches SET
  match_date = '2026-06-21'::date,
  match_time = '00:00 ET',
  kickoff_utc = et_to_utc('2026-06-21'::date, '00:00'),
  team_a = 'Tunisia',
  team_b = 'Japan',
  group_name = 'F',
  venue = 'Estadio BBVA, Monterrey',
  stage = 'Group Stage'
WHERE id = 36;

UPDATE public.matches SET
  match_date = '2026-06-21'::date,
  match_time = '12:00 ET',
  kickoff_utc = et_to_utc('2026-06-21'::date, '12:00'),
  team_a = 'Spain',
  team_b = 'Saudi Arabia',
  group_name = 'H',
  venue = 'Mercedes-Benz Stadium, Atlanta',
  stage = 'Group Stage'
WHERE id = 37;

UPDATE public.matches SET
  match_date = '2026-06-21'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-21'::date, '15:00'),
  team_a = 'Belgium',
  team_b = 'Iran',
  group_name = 'G',
  venue = 'SoFi Stadium, Los Angeles',
  stage = 'Group Stage'
WHERE id = 38;

UPDATE public.matches SET
  match_date = '2026-06-21'::date,
  match_time = '18:00 ET',
  kickoff_utc = et_to_utc('2026-06-21'::date, '18:00'),
  team_a = 'Uruguay',
  team_b = 'Cape Verde',
  group_name = 'H',
  venue = 'Hard Rock Stadium, Miami',
  stage = 'Group Stage'
WHERE id = 39;

UPDATE public.matches SET
  match_date = '2026-06-21'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-21'::date, '21:00'),
  team_a = 'New Zealand',
  team_b = 'Egypt',
  group_name = 'G',
  venue = 'BC Place, Vancouver',
  stage = 'Group Stage'
WHERE id = 40;

UPDATE public.matches SET
  match_date = '2026-06-22'::date,
  match_time = '13:00 ET',
  kickoff_utc = et_to_utc('2026-06-22'::date, '13:00'),
  team_a = 'Argentina',
  team_b = 'Austria',
  group_name = 'J',
  venue = 'AT&T Stadium, Dallas',
  stage = 'Group Stage'
WHERE id = 41;

UPDATE public.matches SET
  match_date = '2026-06-22'::date,
  match_time = '17:00 ET',
  kickoff_utc = et_to_utc('2026-06-22'::date, '17:00'),
  team_a = 'France',
  team_b = 'Iraq',
  group_name = 'I',
  venue = 'Lincoln Financial Field, Philadelphia',
  stage = 'Group Stage'
WHERE id = 42;

UPDATE public.matches SET
  match_date = '2026-06-22'::date,
  match_time = '20:00 ET',
  kickoff_utc = et_to_utc('2026-06-22'::date, '20:00'),
  team_a = 'Norway',
  team_b = 'Senegal',
  group_name = 'I',
  venue = 'MetLife Stadium, New York/NJ',
  stage = 'Group Stage'
WHERE id = 43;

UPDATE public.matches SET
  match_date = '2026-06-22'::date,
  match_time = '23:00 ET',
  kickoff_utc = et_to_utc('2026-06-22'::date, '23:00'),
  team_a = 'Jordan',
  team_b = 'Algeria',
  group_name = 'J',
  venue = 'Levi''s Stadium, San Francisco',
  stage = 'Group Stage'
WHERE id = 44;

UPDATE public.matches SET
  match_date = '2026-06-23'::date,
  match_time = '13:00 ET',
  kickoff_utc = et_to_utc('2026-06-23'::date, '13:00'),
  team_a = 'Portugal',
  team_b = 'Uzbekistan',
  group_name = 'K',
  venue = 'NRG Stadium, Houston',
  stage = 'Group Stage'
WHERE id = 45;

UPDATE public.matches SET
  match_date = '2026-06-23'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-06-23'::date, '16:00'),
  team_a = 'England',
  team_b = 'Ghana',
  group_name = 'L',
  venue = 'Gillette Stadium, Boston',
  stage = 'Group Stage'
WHERE id = 46;

UPDATE public.matches SET
  match_date = '2026-06-23'::date,
  match_time = '19:00 ET',
  kickoff_utc = et_to_utc('2026-06-23'::date, '19:00'),
  team_a = 'Panama',
  team_b = 'Croatia',
  group_name = 'L',
  venue = 'BMO Field, Toronto',
  stage = 'Group Stage'
WHERE id = 47;

UPDATE public.matches SET
  match_date = '2026-06-23'::date,
  match_time = '22:00 ET',
  kickoff_utc = et_to_utc('2026-06-23'::date, '22:00'),
  team_a = 'Colombia',
  team_b = 'DR Congo',
  group_name = 'K',
  venue = 'Estadio Akron, Guadalajara',
  stage = 'Group Stage'
WHERE id = 48;

UPDATE public.matches SET
  match_date = '2026-06-24'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-24'::date, '15:00'),
  team_a = 'Switzerland',
  team_b = 'Canada',
  group_name = 'B',
  venue = 'BC Place, Vancouver',
  stage = 'Group Stage'
WHERE id = 49;

UPDATE public.matches SET
  match_date = '2026-06-24'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-24'::date, '15:00'),
  team_a = 'Bosnia and Herzegovina',
  team_b = 'Qatar',
  group_name = 'B',
  venue = 'Lumen Field, Seattle',
  stage = 'Group Stage'
WHERE id = 50;

UPDATE public.matches SET
  match_date = '2026-06-24'::date,
  match_time = '18:00 ET',
  kickoff_utc = et_to_utc('2026-06-24'::date, '18:00'),
  team_a = 'Scotland',
  team_b = 'Brazil',
  group_name = 'C',
  venue = 'Hard Rock Stadium, Miami',
  stage = 'Group Stage'
WHERE id = 51;

UPDATE public.matches SET
  match_date = '2026-06-24'::date,
  match_time = '18:00 ET',
  kickoff_utc = et_to_utc('2026-06-24'::date, '18:00'),
  team_a = 'Morocco',
  team_b = 'Haiti',
  group_name = 'C',
  venue = 'Mercedes-Benz Stadium, Atlanta',
  stage = 'Group Stage'
WHERE id = 52;

UPDATE public.matches SET
  match_date = '2026-06-24'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-24'::date, '21:00'),
  team_a = 'Czechia',
  team_b = 'Mexico',
  group_name = 'A',
  venue = 'Estadio Azteca, Mexico City',
  stage = 'Group Stage'
WHERE id = 53;

UPDATE public.matches SET
  match_date = '2026-06-24'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-24'::date, '21:00'),
  team_a = 'South Africa',
  team_b = 'South Korea',
  group_name = 'A',
  venue = 'Estadio BBVA, Monterrey',
  stage = 'Group Stage'
WHERE id = 54;

UPDATE public.matches SET
  match_date = '2026-06-25'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-06-25'::date, '16:00'),
  team_a = 'Curacao',
  team_b = 'Ivory Coast',
  group_name = 'E',
  venue = 'Lincoln Financial Field, Philadelphia',
  stage = 'Group Stage'
WHERE id = 55;

UPDATE public.matches SET
  match_date = '2026-06-25'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-06-25'::date, '16:00'),
  team_a = 'Ecuador',
  team_b = 'Germany',
  group_name = 'E',
  venue = 'MetLife Stadium, New York/NJ',
  stage = 'Group Stage'
WHERE id = 56;

UPDATE public.matches SET
  match_date = '2026-06-25'::date,
  match_time = '19:00 ET',
  kickoff_utc = et_to_utc('2026-06-25'::date, '19:00'),
  team_a = 'Japan',
  team_b = 'Sweden',
  group_name = 'F',
  venue = 'AT&T Stadium, Dallas',
  stage = 'Group Stage'
WHERE id = 57;

UPDATE public.matches SET
  match_date = '2026-06-25'::date,
  match_time = '19:00 ET',
  kickoff_utc = et_to_utc('2026-06-25'::date, '19:00'),
  team_a = 'Tunisia',
  team_b = 'Netherlands',
  group_name = 'F',
  venue = 'Arrowhead Stadium, Kansas City',
  stage = 'Group Stage'
WHERE id = 58;

UPDATE public.matches SET
  match_date = '2026-06-25'::date,
  match_time = '22:00 ET',
  kickoff_utc = et_to_utc('2026-06-25'::date, '22:00'),
  team_a = 'Turkey',
  team_b = 'USA',
  group_name = 'D',
  venue = 'SoFi Stadium, Los Angeles',
  stage = 'Group Stage'
WHERE id = 59;

UPDATE public.matches SET
  match_date = '2026-06-25'::date,
  match_time = '22:00 ET',
  kickoff_utc = et_to_utc('2026-06-25'::date, '22:00'),
  team_a = 'Paraguay',
  team_b = 'Australia',
  group_name = 'D',
  venue = 'Levi''s Stadium, San Francisco',
  stage = 'Group Stage'
WHERE id = 60;

UPDATE public.matches SET
  match_date = '2026-06-26'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-26'::date, '15:00'),
  team_a = 'Norway',
  team_b = 'France',
  group_name = 'I',
  venue = 'Gillette Stadium, Boston',
  stage = 'Group Stage'
WHERE id = 61;

UPDATE public.matches SET
  match_date = '2026-06-26'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-26'::date, '15:00'),
  team_a = 'Senegal',
  team_b = 'Iraq',
  group_name = 'I',
  venue = 'BMO Field, Toronto',
  stage = 'Group Stage'
WHERE id = 62;

UPDATE public.matches SET
  match_date = '2026-06-26'::date,
  match_time = '20:00 ET',
  kickoff_utc = et_to_utc('2026-06-26'::date, '20:00'),
  team_a = 'Cape Verde',
  team_b = 'Saudi Arabia',
  group_name = 'H',
  venue = 'NRG Stadium, Houston',
  stage = 'Group Stage'
WHERE id = 63;

UPDATE public.matches SET
  match_date = '2026-06-26'::date,
  match_time = '20:00 ET',
  kickoff_utc = et_to_utc('2026-06-26'::date, '20:00'),
  team_a = 'Uruguay',
  team_b = 'Spain',
  group_name = 'H',
  venue = 'Estadio Akron, Guadalajara',
  stage = 'Group Stage'
WHERE id = 64;

UPDATE public.matches SET
  match_date = '2026-06-26'::date,
  match_time = '23:00 ET',
  kickoff_utc = et_to_utc('2026-06-26'::date, '23:00'),
  team_a = 'Egypt',
  team_b = 'Iran',
  group_name = 'G',
  venue = 'Lumen Field, Seattle',
  stage = 'Group Stage'
WHERE id = 65;

UPDATE public.matches SET
  match_date = '2026-06-26'::date,
  match_time = '23:00 ET',
  kickoff_utc = et_to_utc('2026-06-26'::date, '23:00'),
  team_a = 'New Zealand',
  team_b = 'Belgium',
  group_name = 'G',
  venue = 'BC Place, Vancouver',
  stage = 'Group Stage'
WHERE id = 66;

UPDATE public.matches SET
  match_date = '2026-06-27'::date,
  match_time = '17:00 ET',
  kickoff_utc = et_to_utc('2026-06-27'::date, '17:00'),
  team_a = 'Panama',
  team_b = 'England',
  group_name = 'L',
  venue = 'MetLife Stadium, New York/NJ',
  stage = 'Group Stage'
WHERE id = 67;

UPDATE public.matches SET
  match_date = '2026-06-27'::date,
  match_time = '17:00 ET',
  kickoff_utc = et_to_utc('2026-06-27'::date, '17:00'),
  team_a = 'Croatia',
  team_b = 'Ghana',
  group_name = 'L',
  venue = 'Lincoln Financial Field, Philadelphia',
  stage = 'Group Stage'
WHERE id = 68;

UPDATE public.matches SET
  match_date = '2026-06-27'::date,
  match_time = '19:30 ET',
  kickoff_utc = et_to_utc('2026-06-27'::date, '19:30'),
  team_a = 'Colombia',
  team_b = 'Portugal',
  group_name = 'K',
  venue = 'Hard Rock Stadium, Miami',
  stage = 'Group Stage'
WHERE id = 69;

UPDATE public.matches SET
  match_date = '2026-06-27'::date,
  match_time = '19:30 ET',
  kickoff_utc = et_to_utc('2026-06-27'::date, '19:30'),
  team_a = 'DR Congo',
  team_b = 'Uzbekistan',
  group_name = 'K',
  venue = 'Mercedes-Benz Stadium, Atlanta',
  stage = 'Group Stage'
WHERE id = 70;

UPDATE public.matches SET
  match_date = '2026-06-27'::date,
  match_time = '22:00 ET',
  kickoff_utc = et_to_utc('2026-06-27'::date, '22:00'),
  team_a = 'Algeria',
  team_b = 'Austria',
  group_name = 'J',
  venue = 'Arrowhead Stadium, Kansas City',
  stage = 'Group Stage'
WHERE id = 71;

UPDATE public.matches SET
  match_date = '2026-06-27'::date,
  match_time = '22:00 ET',
  kickoff_utc = et_to_utc('2026-06-27'::date, '22:00'),
  team_a = 'Jordan',
  team_b = 'Argentina',
  group_name = 'J',
  venue = 'AT&T Stadium, Dallas',
  stage = 'Group Stage'
WHERE id = 72;

UPDATE public.matches SET
  match_date = '2026-06-28'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-06-28'::date, '15:00'),
  team_a = 'Runner-up A',
  team_b = 'Runner-up B',
  group_name = NULL,
  venue = 'SoFi Stadium, Los Angeles',
  stage = 'Round of 32'
WHERE id = 73;

UPDATE public.matches SET
  match_date = '2026-06-29'::date,
  match_time = '13:00 ET',
  kickoff_utc = et_to_utc('2026-06-29'::date, '13:00'),
  team_a = 'Winner C',
  team_b = 'Runner-up F',
  group_name = NULL,
  venue = 'NRG Stadium, Houston',
  stage = 'Round of 32'
WHERE id = 74;

UPDATE public.matches SET
  match_date = '2026-06-29'::date,
  match_time = '16:30 ET',
  kickoff_utc = et_to_utc('2026-06-29'::date, '16:30'),
  team_a = 'Winner E',
  team_b = 'Best 3rd (A/B/C/D/F)',
  group_name = NULL,
  venue = 'Gillette Stadium, Boston',
  stage = 'Round of 32'
WHERE id = 75;

UPDATE public.matches SET
  match_date = '2026-06-29'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-29'::date, '21:00'),
  team_a = 'Winner F',
  team_b = 'Runner-up C',
  group_name = NULL,
  venue = 'Estadio BBVA, Monterrey',
  stage = 'Round of 32'
WHERE id = 76;

UPDATE public.matches SET
  match_date = '2026-06-30'::date,
  match_time = '13:00 ET',
  kickoff_utc = et_to_utc('2026-06-30'::date, '13:00'),
  team_a = 'Runner-up E',
  team_b = 'Runner-up I',
  group_name = NULL,
  venue = 'AT&T Stadium, Dallas',
  stage = 'Round of 32'
WHERE id = 77;

UPDATE public.matches SET
  match_date = '2026-06-30'::date,
  match_time = '17:00 ET',
  kickoff_utc = et_to_utc('2026-06-30'::date, '17:00'),
  team_a = 'Winner I',
  team_b = 'Best 3rd (C/D/F/G/H)',
  group_name = NULL,
  venue = 'MetLife Stadium, New York/NJ',
  stage = 'Round of 32'
WHERE id = 78;

UPDATE public.matches SET
  match_date = '2026-06-30'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-06-30'::date, '21:00'),
  team_a = 'Winner A',
  team_b = 'Best 3rd (C/E/F/H/I)',
  group_name = NULL,
  venue = 'Estadio Azteca, Mexico City',
  stage = 'Round of 32'
WHERE id = 79;

UPDATE public.matches SET
  match_date = '2026-07-01'::date,
  match_time = '12:00 ET',
  kickoff_utc = et_to_utc('2026-07-01'::date, '12:00'),
  team_a = 'Winner L',
  team_b = 'Best 3rd (E/H/I/J/K)',
  group_name = NULL,
  venue = 'Mercedes-Benz Stadium, Atlanta',
  stage = 'Round of 32'
WHERE id = 80;

UPDATE public.matches SET
  match_date = '2026-07-01'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-07-01'::date, '16:00'),
  team_a = 'Winner G',
  team_b = 'Best 3rd (A/E/H/I/J)',
  group_name = NULL,
  venue = 'Lumen Field, Seattle',
  stage = 'Round of 32'
WHERE id = 81;

UPDATE public.matches SET
  match_date = '2026-07-01'::date,
  match_time = '20:00 ET',
  kickoff_utc = et_to_utc('2026-07-01'::date, '20:00'),
  team_a = 'Winner D',
  team_b = 'Best 3rd (B/E/F/I/J)',
  group_name = NULL,
  venue = 'Levi''s Stadium, San Francisco',
  stage = 'Round of 32'
WHERE id = 82;

UPDATE public.matches SET
  match_date = '2026-07-02'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-07-02'::date, '15:00'),
  team_a = 'Winner H',
  team_b = 'Runner-up J',
  group_name = NULL,
  venue = 'SoFi Stadium, Los Angeles',
  stage = 'Round of 32'
WHERE id = 83;

UPDATE public.matches SET
  match_date = '2026-07-02'::date,
  match_time = '19:00 ET',
  kickoff_utc = et_to_utc('2026-07-02'::date, '19:00'),
  team_a = 'Runner-up K',
  team_b = 'Runner-up L',
  group_name = NULL,
  venue = 'BMO Field, Toronto',
  stage = 'Round of 32'
WHERE id = 84;

UPDATE public.matches SET
  match_date = '2026-07-02'::date,
  match_time = '23:00 ET',
  kickoff_utc = et_to_utc('2026-07-02'::date, '23:00'),
  team_a = 'Winner B',
  team_b = 'Best 3rd (E/F/G/I/J)',
  group_name = NULL,
  venue = 'BC Place, Vancouver',
  stage = 'Round of 32'
WHERE id = 85;

UPDATE public.matches SET
  match_date = '2026-07-03'::date,
  match_time = '14:00 ET',
  kickoff_utc = et_to_utc('2026-07-03'::date, '14:00'),
  team_a = 'Runner-up D',
  team_b = 'Runner-up G',
  group_name = NULL,
  venue = 'AT&T Stadium, Dallas',
  stage = 'Round of 32'
WHERE id = 86;

UPDATE public.matches SET
  match_date = '2026-07-03'::date,
  match_time = '18:00 ET',
  kickoff_utc = et_to_utc('2026-07-03'::date, '18:00'),
  team_a = 'Winner J',
  team_b = 'Runner-up H',
  group_name = NULL,
  venue = 'Hard Rock Stadium, Miami',
  stage = 'Round of 32'
WHERE id = 87;

UPDATE public.matches SET
  match_date = '2026-07-03'::date,
  match_time = '21:30 ET',
  kickoff_utc = et_to_utc('2026-07-03'::date, '21:30'),
  team_a = 'Winner K',
  team_b = 'Best 3rd (D/E/I/J/L)',
  group_name = NULL,
  venue = 'Arrowhead Stadium, Kansas City',
  stage = 'Round of 32'
WHERE id = 88;

UPDATE public.matches SET
  match_date = '2026-07-04'::date,
  match_time = '13:00 ET',
  kickoff_utc = et_to_utc('2026-07-04'::date, '13:00'),
  team_a = 'Winner M73',
  team_b = 'Winner M75',
  group_name = NULL,
  venue = 'NRG Stadium, Houston',
  stage = 'Round of 16'
WHERE id = 89;

UPDATE public.matches SET
  match_date = '2026-07-04'::date,
  match_time = '17:00 ET',
  kickoff_utc = et_to_utc('2026-07-04'::date, '17:00'),
  team_a = 'Winner M74',
  team_b = 'Winner M77',
  group_name = NULL,
  venue = 'Lincoln Financial Field, Philadelphia',
  stage = 'Round of 16'
WHERE id = 90;

UPDATE public.matches SET
  match_date = '2026-07-05'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-07-05'::date, '16:00'),
  team_a = 'Winner M76',
  team_b = 'Winner M78',
  group_name = NULL,
  venue = 'MetLife Stadium, New York/NJ',
  stage = 'Round of 16'
WHERE id = 91;

UPDATE public.matches SET
  match_date = '2026-07-05'::date,
  match_time = '20:00 ET',
  kickoff_utc = et_to_utc('2026-07-05'::date, '20:00'),
  team_a = 'Winner M79',
  team_b = 'Winner M80',
  group_name = NULL,
  venue = 'Estadio Azteca, Mexico City',
  stage = 'Round of 16'
WHERE id = 92;

UPDATE public.matches SET
  match_date = '2026-07-06'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-07-06'::date, '15:00'),
  team_a = 'Winner M83',
  team_b = 'Winner M84',
  group_name = NULL,
  venue = 'AT&T Stadium, Dallas',
  stage = 'Round of 16'
WHERE id = 93;

UPDATE public.matches SET
  match_date = '2026-07-06'::date,
  match_time = '20:00 ET',
  kickoff_utc = et_to_utc('2026-07-06'::date, '20:00'),
  team_a = 'Winner M81',
  team_b = 'Winner M82',
  group_name = NULL,
  venue = 'Lumen Field, Seattle',
  stage = 'Round of 16'
WHERE id = 94;

UPDATE public.matches SET
  match_date = '2026-07-07'::date,
  match_time = '12:00 ET',
  kickoff_utc = et_to_utc('2026-07-07'::date, '12:00'),
  team_a = 'Winner M86',
  team_b = 'Winner M88',
  group_name = NULL,
  venue = 'Mercedes-Benz Stadium, Atlanta',
  stage = 'Round of 16'
WHERE id = 95;

UPDATE public.matches SET
  match_date = '2026-07-07'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-07-07'::date, '16:00'),
  team_a = 'Winner M85',
  team_b = 'Winner M87',
  group_name = NULL,
  venue = 'BC Place, Vancouver',
  stage = 'Round of 16'
WHERE id = 96;

UPDATE public.matches SET
  match_date = '2026-07-09'::date,
  match_time = '16:00 ET',
  kickoff_utc = et_to_utc('2026-07-09'::date, '16:00'),
  team_a = 'Winner M89',
  team_b = 'Winner M90',
  group_name = NULL,
  venue = 'Gillette Stadium, Boston',
  stage = 'Quarter-final'
WHERE id = 97;

UPDATE public.matches SET
  match_date = '2026-07-10'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-07-10'::date, '15:00'),
  team_a = 'Winner M93',
  team_b = 'Winner M94',
  group_name = NULL,
  venue = 'SoFi Stadium, Los Angeles',
  stage = 'Quarter-final'
WHERE id = 98;

UPDATE public.matches SET
  match_date = '2026-07-11'::date,
  match_time = '17:00 ET',
  kickoff_utc = et_to_utc('2026-07-11'::date, '17:00'),
  team_a = 'Winner M91',
  team_b = 'Winner M92',
  group_name = NULL,
  venue = 'Hard Rock Stadium, Miami',
  stage = 'Quarter-final'
WHERE id = 99;

UPDATE public.matches SET
  match_date = '2026-07-11'::date,
  match_time = '21:00 ET',
  kickoff_utc = et_to_utc('2026-07-11'::date, '21:00'),
  team_a = 'Winner M95',
  team_b = 'Winner M96',
  group_name = NULL,
  venue = 'Arrowhead Stadium, Kansas City',
  stage = 'Quarter-final'
WHERE id = 100;

UPDATE public.matches SET
  match_date = '2026-07-14'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-07-14'::date, '15:00'),
  team_a = 'Winner M97',
  team_b = 'Winner M98',
  group_name = NULL,
  venue = 'AT&T Stadium, Dallas',
  stage = 'Semi-final'
WHERE id = 101;

UPDATE public.matches SET
  match_date = '2026-07-15'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-07-15'::date, '15:00'),
  team_a = 'Winner M99',
  team_b = 'Winner M100',
  group_name = NULL,
  venue = 'Mercedes-Benz Stadium, Atlanta',
  stage = 'Semi-final'
WHERE id = 102;

UPDATE public.matches SET
  match_date = '2026-07-18'::date,
  match_time = '17:00 ET',
  kickoff_utc = et_to_utc('2026-07-18'::date, '17:00'),
  team_a = 'Loser M101',
  team_b = 'Loser M102',
  group_name = NULL,
  venue = 'Hard Rock Stadium, Miami',
  stage = '3rd Place Play-off'
WHERE id = 103;

UPDATE public.matches SET
  match_date = '2026-07-19'::date,
  match_time = '15:00 ET',
  kickoff_utc = et_to_utc('2026-07-19'::date, '15:00'),
  team_a = 'Winner M101',
  team_b = 'Winner M102',
  group_name = NULL,
  venue = 'MetLife Stadium, New York/NJ',
  stage = 'Final'
WHERE id = 104;

DROP FUNCTION IF EXISTS et_to_utc(date, text);
