-- Migration 020: Add NP (No Points), TP (Two Pointers), FP (Four Pointers) columns
-- to the league_table view for the leaderboard.

drop view if exists public.league_table;
create view public.league_table as
select
  p.id,
  p.username,
  p.golden_boot_pick,
  p.golden_boot_correct,
  count(pr.id) filter (where pr.match_id != 9999) as matches_predicted,
  count(pr.id) filter (where pr.is_result_correct = true and pr.match_id != 9999) as correct_results,
  count(pr.id) filter (where pr.is_score_correct = true) as correct_scorelines,
  count(pr.id) filter (where pr.points_earned = 0) + (
    select count(*) from public.matches m
    where m.result is not null
      and m.id != 9999
      and not exists (
        select 1 from public.predictions pr2
        where pr2.user_id = p.id and pr2.match_id = m.id
      )
  ) as no_points,
  count(pr.id) filter (where pr.points_earned = 2) as two_pointers,
  count(pr.id) filter (where pr.points_earned = 4) as four_pointers,
  coalesce(sum(pr.points_earned), 0) as points
from public.profiles p
left join public.predictions pr on p.id = pr.user_id
group by p.id, p.username, p.golden_boot_pick, p.golden_boot_correct
order by points desc, four_pointers desc, correct_scorelines desc, correct_results desc;
