# WC2026 Predictor — Testing Runbook
> Agent-executable. Each step has a clear action, expected result, and rollback.
> Run steps in order. Do not skip ahead — some steps depend on state set by previous ones.

---

## Prerequisites

Before starting, have these ready:
- Supabase SQL Editor open (Dashboard → SQL Editor)
- App running locally or on Vercel
- Two browser windows: one logged in as **admin**, one as a **regular user**
- Admin email must be in `NEXT_PUBLIC_ADMIN_EMAILS` env var

---

## SECTION 1 — Prediction Lock

### Test 1.1 — UI hides prediction form when lock is active

**Setup**
```sql
-- Save the original value first
SELECT id, kickoff_utc FROM matches WHERE id = 1;
-- Note it down. Then set it to 30 minutes from now.
UPDATE matches
SET kickoff_utc = now() + INTERVAL '30 minutes'
WHERE id = 1;
```

**Action**
- In the regular user browser, go to `/predict`
- Find Match ID 1 in the Today or Upcoming tab

**Expected result**
- The result dropdown and scoreline dropdown are NOT visible
- A 🔒 lock icon or "No prediction made" message is shown instead
- The match card does not have any interactive inputs

**Rollback**
```sql
-- Put the original kickoff_utc back
UPDATE matches
SET kickoff_utc = '<original value you noted above>'
WHERE id = 1;
```

---

### Test 1.2 — Database rejects prediction even if UI is bypassed

**Setup**
- Same state as Test 1.1 (match ID 1 locked at now + 30 min)
- In the regular user browser, open DevTools → Console

**Action**
Run this in the browser console:
```js
const { data, error } = await supabase.from('predictions').insert({
  user_id: (await supabase.auth.getUser()).data.user.id,
  match_id: 1,
  predicted_result: 'teamA',
  predicted_score_a: 2,
  predicted_score_b: 0
})
console.log('data:', data)
console.log('error:', error)
```

**Expected result**
- `data` is `null`
- `error` is not null and contains `"violates row-level security policy"` or similar policy rejection message
- Nothing is written to the predictions table

**Verify**
```sql
SELECT * FROM predictions WHERE match_id = 1 AND user_id = '<regular user id>';
-- Should return 0 rows
```

**Rollback**
```sql
UPDATE matches
SET kickoff_utc = '<original value>'
WHERE id = 1;
```

---

### Test 1.3 — Prediction is allowed before lock window

**Setup**
```sql
-- Set kickoff_utc to 2 hours from now (well outside the 1-hour lock)
UPDATE matches
SET kickoff_utc = now() + INTERVAL '2 hours'
WHERE id = 1;
```

**Action**
- In the regular user browser, go to `/predict`
- Find Match ID 1
- Select any result and scoreline
- Click Save

**Expected result**
- Save succeeds
- Match card shows ✅ green tick
- Prediction is saved in the database

**Verify**
```sql
SELECT * FROM predictions WHERE match_id = 1;
-- Should return a row with the user's prediction
```

**Rollback**
```sql
-- Remove test prediction and restore kickoff
DELETE FROM predictions WHERE match_id = 1;
UPDATE matches SET kickoff_utc = '<original value>' WHERE id = 1;
```

---

## SECTION 2 — Admin Manual Override

### Test 2.1 — Admin can enter a score and predictions get points

**Setup**
```sql
-- Pick a match with result = NULL. Note the ID.
SELECT id, team_a, team_b, result FROM matches WHERE result IS NULL LIMIT 1;
```
- In the regular user browser, go to `/predict` and submit a prediction for that match
- Note what they predicted (e.g. Team A Win, 2–0)

**Action**
- In the admin browser, go to `/admin` → Match Results tab
- Find the same match in the Pending section
- Enter: result = Team A Win, Score A = 2, Score B = 0
- Click Override

**Expected result**
- Success message appears: "X predictions scored"
- Match moves to Completed section with a ✏ manual badge
- On the Leaderboard, the regular user's points have increased by:
  - +5 if their predicted result AND scoreline matched
  - +3 if only their result matched
  - +0 if neither matched

**Verify**
```sql
SELECT predicted_result, predicted_score_a, predicted_score_b,
       is_result_correct, is_score_correct, points_earned
FROM predictions
WHERE match_id = <match id>;
```

**Rollback**
```sql
-- Remove result so the match goes back to pending
UPDATE matches SET result = NULL, score_a = NULL, score_b = NULL,
  sync_source = NULL, auto_synced_at = NULL
WHERE id = <match id>;

-- Zero out prediction points for that match
UPDATE predictions
SET is_result_correct = NULL, is_score_correct = NULL, points_earned = 0
WHERE match_id = <match id>;
```

---

### Test 2.2 — Admin cannot enter a contradicting result and score

**Action**
- In the admin browser, go to `/admin` → Match Results tab
- Find any pending match
- Select "Team A Win" as result
- Enter Score A = 0, Score B = 2 (this contradicts the result)
- Click Override

**Expected result**
- An alert/error message appears saying the score doesn't match the result
- Nothing is written to the database

**Verify**
```sql
SELECT result FROM matches WHERE id = <match id>;
-- Should still be NULL
```

**Rollback**
None needed — nothing was written.

---

## SECTION 3 — Auto-Sync (Manual Trigger)

### Test 3.1 — Sync Now button calls the edge function and logs the run

**Setup**
```sql
-- Simulate a finished match the sync function hasn't processed yet:
-- Set kickoff_utc to 3 hours ago, result still NULL
UPDATE matches
SET kickoff_utc = now() - INTERVAL '3 hours'
WHERE id = 2 AND result IS NULL;
```

**Action**
- In the admin browser, go to `/admin` → Auto-Sync tab
- Click **Sync Now**
- Wait for the response message (usually 3–5 seconds)

**Expected result**
- Response message shows: "Sync complete — X match(es) updated, Y predictions scored"
- A new row appears in the Sync Log table at the top with today's date and `source = manual`
- `matches_updated` is at least 1 if the API returned a result for that match

**Verify**
```sql
-- Check sync log
SELECT * FROM sync_log ORDER BY ran_at DESC LIMIT 3;

-- Check the match was updated
SELECT id, result, score_a, score_b, sync_source, auto_synced_at
FROM matches WHERE id = 2;
```

**Rollback**
```sql
UPDATE matches
SET result = NULL, score_a = NULL, score_b = NULL,
    sync_source = NULL, auto_synced_at = NULL,
    kickoff_utc = '<original value>'
WHERE id = 2;

UPDATE predictions
SET is_result_correct = NULL, is_score_correct = NULL, points_earned = 0
WHERE match_id = 2;

DELETE FROM sync_log WHERE source = 'manual' AND ran_at > now() - INTERVAL '10 minutes';
```

---

### Test 3.2 — Sync Now does nothing if no matches are pending

**Setup**
- Ensure no matches have `result IS NULL AND kickoff_utc < now() - 2 hours`
  (All past matches should already have results after normal operation)

**Action**
- In the admin browser, go to `/admin` → Auto-Sync tab
- Click **Sync Now**

**Expected result**
- Response message: "No pending matches to sync"
- A new row appears in the Sync Log with `matches_checked = 0`, `matches_updated = 0`

**Rollback**
None needed.

---

## SECTION 4 — pg_cron Schedule

### Test 4.1 — All cron jobs are registered

**Action**
```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

**Expected result**
Exactly 9 rows returned:
```
sync-scores-catchall
sync-scores-window-A-1
sync-scores-window-A-2
sync-scores-window-B-1
sync-scores-window-B-2
sync-scores-window-C-1
sync-scores-window-C-2
sync-scores-window-D-1
sync-scores-window-D-2
```
All should have `active = true`.

**Rollback**
None needed — this is read-only.

---

### Test 4.2 — Cron job has run at least once

> Note: This test can only pass after a scheduled time has passed.
> The first cron window is 18:30 UTC. Run this check after that time.

**Action**
```sql
-- Check Supabase's internal cron run history
SELECT jobname, start_time, status
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- Check your own sync log for cron-triggered runs
SELECT * FROM sync_log WHERE source = 'cron' ORDER BY ran_at DESC LIMIT 5;
```

**Expected result**
- At least one row in `cron.job_run_details` with `status = 'succeeded'`
- At least one row in `sync_log` with `source = 'cron'`

**Rollback**
None needed — read-only.

---

## SECTION 5 — Scoring Accuracy

### Test 5.1 — Points are calculated correctly for all outcomes

**Setup**
```sql
-- Pick a match with result = NULL
SELECT id, team_a, team_b FROM matches WHERE result IS NULL LIMIT 1;
-- Note the match ID, call it <test_match_id>
```

Create predictions for 3 test users (or use existing users):
```sql
-- User A: correct result AND correct score → should get 5 pts
INSERT INTO predictions (user_id, match_id, predicted_result, predicted_score_a, predicted_score_b)
VALUES ('<user_a_id>', <test_match_id>, 'teamA', 2, 0);

-- User B: correct result, wrong score → should get 3 pts
INSERT INTO predictions (user_id, match_id, predicted_result, predicted_score_a, predicted_score_b)
VALUES ('<user_b_id>', <test_match_id>, 'teamA', 1, 0);

-- User C: wrong result → should get 0 pts
INSERT INTO predictions (user_id, match_id, predicted_result, predicted_score_a, predicted_score_b)
VALUES ('<user_c_id>', <test_match_id>, 'draw', 1, 1);
```

**Action**
- In admin browser, go to `/admin` → Match Results tab
- Enter: Team A Win, Score A = 2, Score B = 0
- Click Override

**Expected result**
```sql
SELECT u.user_id,
       p.predicted_result, p.predicted_score_a, p.predicted_score_b,
       p.is_result_correct, p.is_score_correct, p.points_earned
FROM predictions p
JOIN profiles u ON u.id = p.user_id
WHERE p.match_id = <test_match_id>;
```
| User | is_result_correct | is_score_correct | points_earned |
|---|---|---|---|
| A | true | true | 5 |
| B | true | false | 3 |
| C | false | false | 0 |

**Rollback**
```sql
DELETE FROM predictions WHERE match_id = <test_match_id>;
UPDATE matches SET result = NULL, score_a = NULL, score_b = NULL,
  sync_source = NULL WHERE id = <test_match_id>;
```

---

## SECTION 6 — UI Features

### Test 6.1 — Green tick appears on predicted match card

**Action**
- Log in as regular user, go to `/predict`
- Find any unlocked match
- Submit a prediction and save it

**Expected result**
- The match card immediately shows a ✅ green tick in the top-right corner
- The tick persists if you refresh the page

**Rollback**
```sql
DELETE FROM predictions
WHERE user_id = '<user_id>' AND match_id = <match_id>;
```

---

### Test 6.2 — Date chip flips to ✅ when all matches on a day are predicted

**Action**
- Go to `/predict` → Upcoming tab
- Find a date that has exactly 2 matches (visible in the chip as a number)
- Predict and save the first match — chip should still show the count
- Predict and save the second match — chip should flip to ✅

**Expected result**
- Chip shows count (e.g. `2`) after first prediction
- Chip shows ✅ after all predictions on that date are saved

**Rollback**
```sql
DELETE FROM predictions
WHERE user_id = '<user_id>'
  AND match_id IN (<match_id_1>, <match_id_2>);
```

---

### Test 6.3 — Golden Boot page locks after tournament start date

**Setup**
- In `lib/data.js`, temporarily change:
```js
export const TOURNAMENT_START = new Date('2024-01-01') // past date
```
- Redeploy or restart local dev server

**Action**
- Log in as any user, go to `/golden-boot`

**Expected result**
- The player picker is greyed out and not interactive
- Save button is not visible
- A red lock message is shown: "Tournament started June 11. No more changes allowed."

**Rollback**
- Restore `lib/data.js`:
```js
export const TOURNAMENT_START = new Date('2026-06-11T00:00:00')
```

---

### Test 6.4 — Admin link is hidden from non-admin users

**Action**
- Log in as a regular user (not in `NEXT_PUBLIC_ADMIN_EMAILS`)
- Look at the navigation bar

**Expected result**
- The Admin link is NOT visible in the nav
- Manually visiting `/admin` shows "No admin access" message

**Action**
- Log in as an admin user (email in `NEXT_PUBLIC_ADMIN_EMAILS`)
- Look at the navigation bar

**Expected result**
- The Admin link IS visible in the nav and highlighted in gold

**Rollback**
None needed — read-only test.

---

## SECTION 7 — Full End-to-End Flow

### Test 7.1 — Complete match lifecycle from prediction to points

This combines everything into one run-through.

**Steps**
1. Regular user submits a prediction on match ID 3 (must be unlocked)
2. Confirm prediction is saved:
```sql
SELECT * FROM predictions WHERE match_id = 3;
```
3. Simulate match finishing — set kickoff to 3 hours ago:
```sql
UPDATE matches SET kickoff_utc = now() - INTERVAL '3 hours' WHERE id = 3;
```
4. Admin clicks Sync Now → check response says match was updated
5. If API doesn't return a result for match 3, use manual override instead
6. Check leaderboard — user's points should reflect the result
7. Check sync log has a new entry

**Expected result**
- Points appear on leaderboard without admin manually entering the score
- Sync log shows the run with `matches_updated >= 1`

**Rollback**
```sql
UPDATE matches SET result = NULL, score_a = NULL, score_b = NULL,
  kickoff_utc = '<original>', sync_source = NULL WHERE id = 3;
UPDATE predictions SET is_result_correct = NULL, is_score_correct = NULL,
  points_earned = 0 WHERE match_id = 3;
DELETE FROM sync_log WHERE ran_at > now() - INTERVAL '30 minutes';
```

---

## Master Rollback — Reset Everything to Original State

If you need to undo all test data at once:

```sql
-- 1. Clear all test predictions (keep real ones by filtering to test user IDs)
DELETE FROM predictions
WHERE user_id IN ('<test_user_id_1>', '<test_user_id_2>', '<test_user_id_3>');

-- 2. Clear all match results (ONLY run this before the tournament starts)
UPDATE matches SET
  result       = NULL,
  score_a      = NULL,
  score_b      = NULL,
  sync_source  = NULL,
  auto_synced_at = NULL;

-- 3. Restore kickoff times from match_date + match_time
-- (re-run the migration calculation)
UPDATE matches
SET kickoff_utc = (
  match_date::text || ' ' ||
  regexp_replace(match_time, '\s*ET\s*$', '') ||
  ':00+00'
)::timestamptz + INTERVAL '4 hours';

-- 4. Clear sync log test entries
DELETE FROM sync_log WHERE source IN ('manual', 'test');

-- 5. Restore lib/data.js TOURNAMENT_START if you changed it
-- export const TOURNAMENT_START = new Date('2026-06-11T00:00:00')
```

---

## SECTION 8 — Others Page

### Test 8.1 — Other users' predictions are visible

**Setup**
- Two users (User A and User B) must both have predictions on the same match
```sql
-- Verify both users have predictions on the same match
SELECT match_id, user_id, predicted_result, predicted_score_a, predicted_score_b
FROM predictions
WHERE match_id IN (
  SELECT match_id FROM predictions GROUP BY match_id HAVING COUNT(*) >= 2
)
ORDER BY match_id, user_id;
```
- Pick a match ID with at least 2 predictions — call it `<shared_match_id>`

**Action**
- Log in as User A
- Go to `/others`
- Click on the match that has predictions from both users

**Expected result**
- User A sees their own prediction AND User B's prediction for that match
- Each prediction shows the username, predicted result, and scoreline
- If the match is completed, the correct/incorrect status is shown per prediction

**Verify**
```sql
SELECT p.user_id, pr.username, p.predicted_result, p.predicted_score_a, p.predicted_score_b
FROM predictions p
JOIN profiles pr ON pr.id = p.user_id
WHERE p.match_id = <shared_match_id>;
-- Should return at least 2 rows
```

**Rollback**
None needed — read-only test.

---

### Test 8.2 — Others page groups predictions by match date

**Action**
- Log in as any user, go to `/others`
- Look at the match cards displayed

**Expected result**
- Matches are grouped and sorted by date
- Completed matches show the final score prominently
- Uncompleted matches show "VS" instead of a score
- Stage and group labels are visible on each card

**Rollback**
None needed — read-only test.

---

## SECTION 9 — Mobile Responsive Layout

### Test 9.1 — Navbar links are horizontally scrollable on mobile

**Setup**
- Open the app in a browser and resize to mobile width (≤760px), or use DevTools device toolbar

**Action**
- Look at the navigation bar
- Swipe/drag horizontally across the nav links

**Expected result**
- All nav links (Today, Predict, Others, Leaderboard, Admin, sign-out icon) are on a single line
- If links overflow the screen width, horizontal scrolling is possible by dragging
- The cursor changes to a grabbing hand when dragging
- The sign-out power icon (SVG) is visible at the end of the nav
- No scrollbar is visible

**Rollback**
None needed — read-only test.

---

### Test 9.2 — Date chips are scrollable on predict page (mobile)

**Setup**
- Resize to mobile width (≤760px) or use DevTools device toolbar
- Go to `/predict` → Upcoming tab

**Action**
- Swipe/drag horizontally across the date chips
- Tap a chip that is off-screen to the right

**Expected result**
- Date chips scroll horizontally without breaking layout
- Tapping an off-screen chip auto-scrolls it to the center of the viewport
- Dragging works with mouse or touch
- No visible scrollbar

**Rollback**
None needed — read-only test.

---

### Test 9.3 — Date chips are scrollable on admin page (mobile)

**Setup**
- Resize to mobile width (≤760px) or use DevTools device toolbar
- Go to `/admin` → Results tab

**Action**
- Swipe/drag horizontally across the day pills

**Expected result**
- Day pills scroll horizontally without breaking layout
- The stage dropdown is visible and full-width above the day pills
- Dragging works with mouse or touch
- Selecting a day pill auto-scrolls it to the center

**Rollback**
None needed — read-only test.

---

## Test Completion Checklist

| # | Test | Pass | Notes |
|---|---|---|---|
| 1.1 | UI hides form when locked | ☐ | |
| 1.2 | DB rejects bypassed insert | ☐ | |
| 1.3 | Prediction allowed before lock | ☐ | |
| 2.1 | Admin override saves and scores | ☐ | |
| 2.2 | Contradicting result blocked | ☐ | |
| 3.1 | Sync Now updates match + log | ☐ | |
| 3.2 | Sync Now no-ops when nothing pending | ☐ | |
| 4.1 | All 9 cron jobs registered | ☐ | |
| 4.2 | Cron has run at least once | ☐ | After 18:30 UTC |
| 5.1 | Points calculated correctly | ☐ | |
| 6.1 | Green tick on predicted card | ☐ | |
| 6.2 | Date chip flips to ✅ | ☐ | |
| 6.3 | GB page locks after start date | ☐ | |
| 6.4 | Admin link hidden from users | ☐ | |
| 7.1 | Full end-to-end lifecycle | ☐ | |
| 8.1 | Others page shows other users' predictions | ☐ | |
| 8.2 | Others page groups by match date | ☐ | |
| 9.1 | Navbar horizontal scroll on mobile | ☐ | |
| 9.2 | Predict date chips scroll on mobile | ☐ | |
| 9.3 | Admin day pills scroll on mobile | ☐ | |
