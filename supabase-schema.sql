-- ============================================================
-- FIFA World Cup 2026 Predictor — Supabase Database Schema v2
-- Updated: June 2026 — Full 104 matches + knockout logic
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. Profiles (linked to Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  golden_boot_pick text,
  golden_boot_correct boolean default false,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 2. Matches — group stage teams are fixed; knockout teams are dynamic
create table public.matches (
  id integer primary key,
  match_date date not null,
  match_time text not null,
  team_a text not null,
  team_b text not null,
  group_name text,               -- NULL for knockout matches
  stage text not null,           -- "Group Stage", "Round of 32", "Round of 16", "Quarter-final", "Semi-final", "3rd Place Play-off", "Final"
  venue text not null,
  knockout_slot text,            -- e.g. "R32-M73", "R16-M89", "QF-M97", "FINAL-M104"
  -- Knockout source tracking: which match feeds each team
  team_a_from_match integer references public.matches(id),  -- winner/runner-up of this match plays here as team_a
  team_b_from_match integer references public.matches(id),
  team_a_qualifier text,         -- "winner", "runner-up", "best3rd", "loser"
  team_b_qualifier text,
  -- Result
  result text check (result in ('teamA', 'teamB', 'draw', null)),
  score_a integer,
  score_b integer,
  is_final boolean default false,  -- mark the Final match for special golden boot tiebreak
  created_at timestamp with time zone default timezone('utc', now())
);

-- 3. Group standings (materialised after each matchday)
create table public.group_standings (
  id uuid default gen_random_uuid() primary key,
  group_name text not null,
  team text not null,
  played integer default 0,
  won integer default 0,
  drawn integer default 0,
  lost integer default 0,
  goals_for integer default 0,
  goals_against integer default 0,
  goal_diff integer generated always as (goals_for - goals_against) stored,
  points integer default 0,
  position integer,              -- 1-4 within group, set after all 3 matchdays
  updated_at timestamp with time zone default timezone('utc', now()),
  unique(group_name, team)
);

-- 4. Predictions
create table public.predictions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  match_id integer references public.matches(id) on delete cascade not null,
  predicted_result text check (predicted_result in ('teamA', 'teamB', 'draw')) not null,
  predicted_score_a integer not null,
  predicted_score_b integer not null,
  is_result_correct boolean,
  is_score_correct boolean,
  points_earned integer default 0,
  created_at timestamp with time zone default timezone('utc', now()),
  unique(user_id, match_id)
);

-- 5. Row Level Security
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.group_standings enable row level security;
alter table public.predictions enable row level security;

create policy "profiles_read_all"   on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "matches_read_all"    on public.matches for select using (true);

create policy "standings_read_all"  on public.group_standings for select using (true);

create policy "predictions_read_all"    on public.predictions for select using (true);
create policy "predictions_insert_own"  on public.predictions for insert with check (auth.uid() = user_id);
create policy "predictions_update_own"  on public.predictions for update using (auth.uid() = user_id);

-- 6. Leaderboard view
create or replace view public.league_table as
select
  p.id,
  p.username,
  p.golden_boot_pick,
  p.golden_boot_correct,
  count(pr.id) filter (where pr.match_id != 9999) as matches_predicted,
  count(pr.id) filter (where pr.is_result_correct = true and pr.match_id != 9999) as correct_results,
  count(pr.id) filter (where pr.is_score_correct = true) as correct_scorelines,
  coalesce(sum(pr.points_earned), 0) as points
from public.profiles p
left join public.predictions pr on p.id = pr.user_id
group by p.id, p.username, p.golden_boot_pick, p.golden_boot_correct
order by points desc, correct_scorelines desc, correct_results desc;

-- 7. Function to automatically update knockout match team names
-- Call this from the admin panel after each group stage match settles
create or replace function public.resolve_knockout_teams()
returns void language plpgsql as $$
declare
  r record;
begin
  -- For each knockout match, look up source match results and update team_a / team_b
  for r in select * from public.matches where stage != 'Group Stage' order by id loop
    -- Update team_a
    if r.team_a_from_match is not null then
      declare
        src_match public.matches;
        resolved_team text;
      begin
        select * into src_match from public.matches where id = r.team_a_from_match;
        if src_match.result is not null then
          if r.team_a_qualifier = 'winner' then
            resolved_team := case src_match.result when 'teamA' then src_match.team_a when 'teamB' then src_match.team_b else null end;
          elsif r.team_a_qualifier = 'runner-up' then
            resolved_team := case src_match.result when 'teamA' then src_match.team_b when 'teamB' then src_match.team_a else null end;
          elsif r.team_a_qualifier = 'loser' then
            resolved_team := case src_match.result when 'teamA' then src_match.team_b when 'teamB' then src_match.team_a else null end;
          end if;
          if resolved_team is not null then
            update public.matches set team_a = resolved_team where id = r.id;
          end if;
        end if;
      end;
    end if;
    -- Update team_b
    if r.team_b_from_match is not null then
      declare
        src_match public.matches;
        resolved_team text;
      begin
        select * into src_match from public.matches where id = r.team_b_from_match;
        if src_match.result is not null then
          if r.team_b_qualifier = 'winner' then
            resolved_team := case src_match.result when 'teamA' then src_match.team_a when 'teamB' then src_match.team_b else null end;
          elsif r.team_b_qualifier = 'runner-up' then
            resolved_team := case src_match.result when 'teamA' then src_match.team_b when 'teamB' then src_match.team_a else null end;
          elsif r.team_b_qualifier = 'loser' then
            resolved_team := case src_match.result when 'teamA' then src_match.team_b when 'teamB' then src_match.team_a else null end;
          end if;
          if resolved_team is not null then
            update public.matches set team_b = resolved_team where id = r.id;
          end if;
        end if;
      end;
    end if;
  end loop;
end;
$$;

-- 8. Seed all 104 matches
insert into public.matches (id, match_date, match_time, team_a, team_b, group_name, stage, venue, knockout_slot) values
-- GROUP STAGE ─────────────────────────────────────────────────────────────────
(1,  '2026-06-11','15:00 ET','Mexico',        'South Africa',         'A','Group Stage','Estadio Azteca, Mexico City',null),
(2,  '2026-06-11','22:00 ET','South Korea',   'Czechia',              'A','Group Stage','Estadio Akron, Guadalajara',null),
(3,  '2026-06-12','15:00 ET','Canada',        'Bosnia and Herzegovina','B','Group Stage','BMO Field, Toronto',null),
(4,  '2026-06-12','21:00 ET','USA',           'Paraguay',             'D','Group Stage','SoFi Stadium, Los Angeles',null),
(5,  '2026-06-13','12:00 ET','Switzerland',   'Qatar',                'B','Group Stage','Levi''s Stadium, San Francisco',null),
(6,  '2026-06-13','15:00 ET','Brazil',        'Morocco',              'C','Group Stage','MetLife Stadium, New York/NJ',null),
(7,  '2026-06-14','02:00 ET','Haiti',         'Scotland',             'C','Group Stage','Gillette Stadium, Boston',null),
(8,  '2026-06-14','05:00 ET','Australia',     'Turkey',               'D','Group Stage','SoFi Stadium, Los Angeles',null),
(9,  '2026-06-14','15:00 ET','Spain',         'Cape Verde',           'H','Group Stage','Mercedes-Benz Stadium, Atlanta',null),
(10, '2026-06-14','18:00 ET','Germany',       'Curacao',              'E','Group Stage','AT&T Stadium, Dallas',null),
(11, '2026-06-14','22:00 ET','Netherlands',   'Japan',                'F','Group Stage','AT&T Stadium, Dallas',null),
(12, '2026-06-15','12:00 ET','Belgium',       'New Zealand',          'G','Group Stage','Lumen Field, Seattle',null),
(13, '2026-06-15','15:00 ET','France',        'Iraq',                 'I','Group Stage','MetLife Stadium, New York/NJ',null),
(14, '2026-06-15','18:00 ET','Portugal',      'Uzbekistan',           'K','Group Stage','NRG Stadium, Houston',null),
(15, '2026-06-15','22:00 ET','Argentina',     'Algeria',              'J','Group Stage','Arrowhead Stadium, Kansas City',null),
(16, '2026-06-16','09:00 ET','Saudi Arabia',  'Uruguay',              'H','Group Stage','Mercedes-Benz Stadium, Atlanta',null),
(17, '2026-06-16','12:00 ET','Egypt',         'Iran',                 'G','Group Stage','Lumen Field, Seattle',null),
(18, '2026-06-16','15:00 ET','England',       'Croatia',              'L','Group Stage','AT&T Stadium, Dallas',null),
(19, '2026-06-16','18:00 ET','Ecuador',       'Ivory Coast',          'E','Group Stage','Arrowhead Stadium, Kansas City',null),
(20, '2026-06-16','21:00 ET','Senegal',       'Norway',               'I','Group Stage','Lincoln Financial Field, Philadelphia',null),
(21, '2026-06-17','12:00 ET','Sweden',        'Tunisia',              'F','Group Stage','NRG Stadium, Houston',null),
(22, '2026-06-17','15:00 ET','Colombia',      'DR Congo',             'K','Group Stage','Arrowhead Stadium, Kansas City',null),
(23, '2026-06-17','18:00 ET','Ghana',         'Panama',               'L','Group Stage','NRG Stadium, Houston',null),
(24, '2026-06-17','22:00 ET','Austria',       'Jordan',               'J','Group Stage','AT&T Stadium, Dallas',null),
(25, '2026-06-18','12:00 ET','South Africa',  'Czechia',              'A','Group Stage','Estadio BBVA, Monterrey',null),
(26, '2026-06-18','15:00 ET','Mexico',        'South Korea',          'A','Group Stage','Estadio Azteca, Mexico City',null),
(27, '2026-06-18','18:00 ET','Switzerland',   'Bosnia and Herzegovina','B','Group Stage','BC Place, Vancouver',null),
(28, '2026-06-18','21:00 ET','USA',           'Australia',            'D','Group Stage','Lumen Field, Seattle',null),
(29, '2026-06-19','12:00 ET','Qatar',         'Canada',               'B','Group Stage','BC Place, Vancouver',null),
(30, '2026-06-19','15:00 ET','Brazil',        'Haiti',                'C','Group Stage','Lincoln Financial Field, Philadelphia',null),
(31, '2026-06-19','18:00 ET','Morocco',       'Scotland',             'C','Group Stage','Gillette Stadium, Boston',null),
(32, '2026-06-19','21:00 ET','Paraguay',      'Turkey',               'D','Group Stage','SoFi Stadium, Los Angeles',null),
(33, '2026-06-20','09:00 ET','Cape Verde',    'Saudi Arabia',         'H','Group Stage','Mercedes-Benz Stadium, Atlanta',null),
(34, '2026-06-20','12:00 ET','Germany',       'Ecuador',              'E','Group Stage','AT&T Stadium, Dallas',null),
(35, '2026-06-20','15:00 ET','Netherlands',   'Sweden',               'F','Group Stage','AT&T Stadium, Dallas',null),
(36, '2026-06-20','18:00 ET','Belgium',       'Egypt',                'G','Group Stage','Hard Rock Stadium, Miami',null),
(37, '2026-06-21','12:00 ET','Spain',         'Uruguay',              'H','Group Stage','Estadio Akron, Guadalajara',null),
(38, '2026-06-21','15:00 ET','France',        'Senegal',              'I','Group Stage','MetLife Stadium, New York/NJ',null),
(39, '2026-06-21','18:00 ET','Tunisia',       'Japan',                'F','Group Stage','NRG Stadium, Houston',null),
(40, '2026-06-21','22:00 ET','Argentina',     'Austria',              'J','Group Stage','AT&T Stadium, Dallas',null),
(41, '2026-06-22','12:00 ET','Ivory Coast',   'Germany',              'E','Group Stage','Arrowhead Stadium, Kansas City',null),
(42, '2026-06-22','15:00 ET','Portugal',      'Colombia',             'K','Group Stage','NRG Stadium, Houston',null),
(43, '2026-06-22','18:00 ET','Iraq',          'Norway',               'I','Group Stage','Lincoln Financial Field, Philadelphia',null),
(44, '2026-06-22','22:00 ET','Iran',          'New Zealand',          'G','Group Stage','Hard Rock Stadium, Miami',null),
(45, '2026-06-23','12:00 ET','England',       'Ghana',                'L','Group Stage','Gillette Stadium, Boston',null),
(46, '2026-06-23','15:00 ET','Croatia',       'Panama',               'L','Group Stage','BMO Field, Toronto',null),
(47, '2026-06-23','18:00 ET','Curacao',       'Ecuador',              'E','Group Stage','Arrowhead Stadium, Kansas City',null),
(48, '2026-06-23','22:00 ET','Algeria',       'Jordan',               'J','Group Stage','Levi''s Stadium, San Francisco',null),
(49, '2026-06-24','12:00 ET','DR Congo',      'Uzbekistan',           'K','Group Stage','NRG Stadium, Houston',null),
(50, '2026-06-24','15:00 ET','South Korea',   'South Africa',         'A','Group Stage','Mercedes-Benz Stadium, Atlanta',null),
(51, '2026-06-24','18:00 ET','Czechia',       'Mexico',               'A','Group Stage','Estadio BBVA, Monterrey',null),
(52, '2026-06-24','22:00 ET','Australia',     'Paraguay',             'D','Group Stage','SoFi Stadium, Los Angeles',null),
(53, '2026-06-25','15:00 ET','Bosnia and Herzegovina','Canada',       'B','Group Stage','BMO Field, Toronto',null),
(54, '2026-06-25','15:00 ET','Qatar',         'Switzerland',          'B','Group Stage','BC Place, Vancouver',null),
(55, '2026-06-25','19:00 ET','Turkey',        'USA',                  'D','Group Stage','SoFi Stadium, Los Angeles',null),
(56, '2026-06-25','22:00 ET','Ecuador',       'Germany',              'E','Group Stage','AT&T Stadium, Dallas',null),
(57, '2026-06-26','12:00 ET','Haiti',         'Morocco',              'C','Group Stage','Gillette Stadium, Boston',null),
(58, '2026-06-26','12:00 ET','Scotland',      'Brazil',               'C','Group Stage','Lincoln Financial Field, Philadelphia',null),
(59, '2026-06-26','16:00 ET','Ivory Coast',   'Curacao',              'E','Group Stage','Arrowhead Stadium, Kansas City',null),
(60, '2026-06-26','20:00 ET','Japan',         'Sweden',               'F','Group Stage','NRG Stadium, Houston',null),
(61, '2026-06-26','20:00 ET','Tunisia',       'Netherlands',          'F','Group Stage','AT&T Stadium, Dallas',null),
(62, '2026-06-27','12:00 ET','Iran',          'Belgium',              'G','Group Stage','Lumen Field, Seattle',null),
(63, '2026-06-27','12:00 ET','New Zealand',   'Egypt',                'G','Group Stage','Hard Rock Stadium, Miami',null),
(64, '2026-06-27','16:00 ET','Uruguay',       'Cape Verde',           'H','Group Stage','Estadio Akron, Guadalajara',null),
(65, '2026-06-27','16:00 ET','Saudi Arabia',  'Spain',                'H','Group Stage','Mercedes-Benz Stadium, Atlanta',null),
(66, '2026-06-27','20:00 ET','Iraq',          'France',               'I','Group Stage','MetLife Stadium, New York/NJ',null),
(67, '2026-06-27','20:00 ET','Norway',        'Senegal',              'I','Group Stage','Lincoln Financial Field, Philadelphia',null),
(68, '2026-06-27','22:00 ET','England',       'Panama',               'L','Group Stage','BMO Field, Toronto',null),
(69, '2026-06-27','22:00 ET','Croatia',       'Ghana',                'L','Group Stage','NRG Stadium, Houston',null),
(70, '2026-06-27','22:00 ET','Algeria',       'Argentina',            'J','Group Stage','Levi''s Stadium, San Francisco',null),
(71, '2026-06-27','22:00 ET','Jordan',        'Austria',              'J','Group Stage','AT&T Stadium, Dallas',null),
(72, '2026-06-27','22:00 ET','Uzbekistan',    'Colombia',             'K','Group Stage','Arrowhead Stadium, Kansas City',null),
-- ROUND OF 32 ─────────────────────────────────────────────────────────────────
(73, '2026-06-28','15:00 ET','Runner-up A',   'Runner-up B',          null,'Round of 32','SoFi Stadium, Los Angeles','R32-M73'),
(74, '2026-06-29','16:30 ET','Winner E',      'Best 3rd (A/B/C/D/F)', null,'Round of 32','Gillette Stadium, Boston','R32-M74'),
(75, '2026-06-29','21:00 ET','Winner F',      'Runner-up C',          null,'Round of 32','Estadio BBVA, Monterrey','R32-M75'),
(76, '2026-06-30','13:00 ET','Winner C',      'Runner-up F',          null,'Round of 32','NRG Stadium, Houston','R32-M76'),
(77, '2026-06-30','17:00 ET','Winner I',      'Best 3rd (C/D/F/G/H)', null,'Round of 32','MetLife Stadium, New York/NJ','R32-M77'),
(78, '2026-06-30','21:00 ET','Runner-up E',   'Runner-up I',          null,'Round of 32','AT&T Stadium, Dallas','R32-M78'),
(79, '2026-07-01','02:00 ET','Winner A',      'Best 3rd (C/E/F/H/I)', null,'Round of 32','Estadio Azteca, Mexico City','R32-M79'),
(80, '2026-07-01','12:00 ET','Winner L',      'Best 3rd (E/H/I/J/K)', null,'Round of 32','Mercedes-Benz Stadium, Atlanta','R32-M80'),
(81, '2026-07-01','20:00 ET','Winner D',      'Best 3rd (B/E/F/I/J)', null,'Round of 32','Levi''s Stadium, San Francisco','R32-M81'),
(82, '2026-07-01','16:00 ET','Winner G',      'Best 3rd (A/E/H/I/J)', null,'Round of 32','Lumen Field, Seattle','R32-M82'),
(83, '2026-07-02','19:00 ET','Runner-up K',   'Runner-up L',          null,'Round of 32','BMO Field, Toronto','R32-M83'),
(84, '2026-07-02','15:00 ET','Winner H',      'Runner-up J',          null,'Round of 32','SoFi Stadium, Los Angeles','R32-M84'),
(85, '2026-07-02','23:00 ET','Winner B',      'Best 3rd (E/F/G/I/J)', null,'Round of 32','BC Place, Vancouver','R32-M85'),
(86, '2026-07-03','18:00 ET','Winner J',      'Runner-up H',          null,'Round of 32','Hard Rock Stadium, Miami','R32-M86'),
(87, '2026-07-03','21:30 ET','Winner K',      'Best 3rd (D/E/I/J/L)', null,'Round of 32','Arrowhead Stadium, Kansas City','R32-M87'),
(88, '2026-07-04','14:00 ET','Runner-up D',   'Runner-up G',          null,'Round of 32','AT&T Stadium, Dallas','R32-M88'),
-- ROUND OF 16 ─────────────────────────────────────────────────────────────────
(89, '2026-07-05','16:00 ET','Winner M74',    'Winner M77',           null,'Round of 16','Lincoln Financial Field, Philadelphia','R16-M89'),
(90, '2026-07-05','21:00 ET','Winner M73',    'Winner M75',           null,'Round of 16','NRG Stadium, Houston','R16-M90'),
(91, '2026-07-06','21:00 ET','Winner M76',    'Winner M78',           null,'Round of 16','MetLife Stadium, New York/NJ','R16-M91'),
(92, '2026-07-07','16:00 ET','Winner M79',    'Winner M80',           null,'Round of 16','Estadio Azteca, Mexico City','R16-M92'),
(93, '2026-07-07','21:00 ET','Winner M81',    'Winner M82',           null,'Round of 16','Levi''s Stadium, San Francisco','R16-M93'),
(94, '2026-07-08','16:00 ET','Winner M83',    'Winner M84',           null,'Round of 16','SoFi Stadium, Los Angeles','R16-M94'),
(95, '2026-07-08','21:00 ET','Winner M85',    'Winner M86',           null,'Round of 16','Hard Rock Stadium, Miami','R16-M95'),
(96, '2026-07-09','20:00 ET','Winner M87',    'Winner M88',           null,'Round of 16','AT&T Stadium, Dallas','R16-M96'),
-- QUARTER-FINALS ──────────────────────────────────────────────────────────────
(97, '2026-07-11','15:00 ET','Winner M89',    'Winner M90',           null,'Quarter-final','MetLife Stadium, New York/NJ','QF-M97'),
(98, '2026-07-11','20:00 ET','Winner M91',    'Winner M92',           null,'Quarter-final','AT&T Stadium, Dallas','QF-M98'),
(99, '2026-07-12','15:00 ET','Winner M93',    'Winner M94',           null,'Quarter-final','Levi''s Stadium, San Francisco','QF-M99'),
(100,'2026-07-12','20:00 ET','Winner M95',    'Winner M96',           null,'Quarter-final','NRG Stadium, Houston','QF-M100'),
-- SEMI-FINALS ─────────────────────────────────────────────────────────────────
(101,'2026-07-14','19:00 ET','Winner M97',    'Winner M98',           null,'Semi-final','MetLife Stadium, New York/NJ','SF-M101'),
(102,'2026-07-15','19:00 ET','Winner M99',    'Winner M100',          null,'Semi-final','AT&T Stadium, Dallas','SF-M102'),
-- 3RD PLACE ───────────────────────────────────────────────────────────────────
(103,'2026-07-18','15:00 ET','Loser M101',    'Loser M102',           null,'3rd Place Play-off','Hard Rock Stadium, Miami','3PO-M103'),
-- FINAL ───────────────────────────────────────────────────────────────────────
(104,'2026-07-19','15:00 ET','Winner M101',   'Winner M102',          null,'Final','MetLife Stadium, New York/NJ','FINAL-M104');

-- Mark the Final match
update public.matches set is_final = true where id = 104;

-- ============================================================
-- SCHEMA ADDITIONS v4 (run only if upgrading from v3)
-- ============================================================

-- Group standings table (stores live W/D/L/GD/Pts per team per group)
create table if not exists public.group_standings (
  id uuid default gen_random_uuid() primary key,
  group_name text not null,
  team text not null,
  played integer default 0,
  won integer default 0,
  drawn integer default 0,
  lost integer default 0,
  goals_for integer default 0,
  goals_against integer default 0,
  points integer default 0,
  updated_at timestamp with time zone default timezone('utc', now()),
  unique(group_name, team)
);

alter table public.group_standings enable row level security;
create policy "standings_read_all" on public.group_standings for select using (true);
create policy "standings_insert_all" on public.group_standings for insert with check (true);
create policy "standings_update_all" on public.group_standings for update using (true);
create policy "standings_delete_all" on public.group_standings for delete using (true);

-- Add first_name / last_name columns to profiles if not present
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;

-- ============================================================
-- RUN THIS BLOCK if upgrading from v3 (safe to re-run)
-- ============================================================

-- group_standings: persists live W/D/L/GD/Pts per team
create table if not exists public.group_standings (
  group_name text not null,
  team text not null,
  played integer default 0,
  won integer default 0,
  drawn integer default 0,
  lost integer default 0,
  goals_for integer default 0,
  goals_against integer default 0,
  points integer default 0,
  updated_at timestamp with time zone default timezone('utc', now()),
  primary key (group_name, team)
);
alter table public.group_standings enable row level security;
drop policy if exists "standings_read_all" on public.group_standings;
drop policy if exists "standings_write_all" on public.group_standings;
create policy "standings_read_all" on public.group_standings for select using (true);
create policy "standings_write_all" on public.group_standings for all using (true);

-- first_name / last_name on profiles
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;

-- Seed group_standings rows for all 48 teams
-- (initial zeros; updated by admin after each match)
insert into public.group_standings (group_name, team) values
('A','Mexico'),('A','South Korea'),('A','Czechia'),('A','South Africa'),
('B','Switzerland'),('B','Canada'),('B','Qatar'),('B','Bosnia and Herzegovina'),
('C','Brazil'),('C','Morocco'),('C','Haiti'),('C','Scotland'),
('D','USA'),('D','Turkey'),('D','Australia'),('D','Paraguay'),
('E','Germany'),('E','Ecuador'),('E','Ivory Coast'),('E','Curacao'),
('F','Netherlands'),('F','Japan'),('F','Sweden'),('F','Tunisia'),
('G','Belgium'),('G','Egypt'),('G','Iran'),('G','New Zealand'),
('H','Spain'),('H','Cape Verde'),('H','Saudi Arabia'),('H','Uruguay'),
('I','France'),('I','Senegal'),('I','Iraq'),('I','Norway'),
('J','Argentina'),('J','Algeria'),('J','Austria'),('J','Jordan'),
('K','Portugal'),('K','DR Congo'),('K','Uzbekistan'),('K','Colombia'),
('L','England'),('L','Croatia'),('L','Ghana'),('L','Panama')
on conflict (group_name, team) do nothing;
