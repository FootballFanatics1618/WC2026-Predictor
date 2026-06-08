# Auto-Sync Deployment Guide

Everything needed to get the automated score sync and bulletproof locking live.
Do these steps in order — each one depends on the previous.

---

## Step 1 — Run the DB migration

Open Supabase Dashboard → SQL Editor → paste and run:
`supabase/migrations/001_kickoff_utc_and_lock.sql`

This does four things:
- Adds `kickoff_utc` column to matches and populates it from the existing ET times
- Adds `sync_log` table to track every sync run
- Drops the old prediction RLS policies and replaces them with time-locked versions
- Creates the `score_match_predictions()` batch function

Verify it worked:
```sql
SELECT id, team_a, team_b, match_time, kickoff_utc FROM matches LIMIT 5;
-- kickoff_utc should be 4 hours ahead of the ET time
```

---

## Step 2 — Enable Supabase extensions

Dashboard → Database → Extensions. Enable both:
- **pg_cron** (for scheduled jobs)
- **pg_net** (for HTTP calls from cron jobs)

---

## Step 3 — Deploy the Edge Function

From your project root:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy sync-scores --no-verify-jwt
```

The `--no-verify-jwt` flag lets pg_cron call the function with just the service role key
without needing a JWT. The function still uses the service role key internally.

Test it manually from the terminal:
```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-scores?source=test \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response when no matches are pending:
```json
{ "message": "No pending matches to sync", "source": "test" }
```

---

## Step 4 — Set up the cron schedule

Open `supabase/cron-schedule.sql`.
Replace both placeholders throughout the file:
- `YOUR_PROJECT_REF` → your Supabase project ref (e.g. `abcdefghijklmnop`)
- `YOUR_SERVICE_ROLE_KEY` → from Dashboard → Settings → API → service_role key

Then run the entire file in SQL Editor.

Verify jobs were created:
```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

You should see 9 jobs: `sync-scores-window-A-1`, `sync-scores-window-A-2`, etc.

---

## Step 5 — Set Vercel environment variables

In Vercel → your project → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon/public key |
| `NEXT_PUBLIC_ADMIN_EMAILS` | comma-separated admin emails, e.g. `you@gmail.com,other@gmail.com` |

The admin panel's "Sync Now" button needs `NEXT_PUBLIC_SUPABASE_URL` to
call the edge function directly from the browser.

---

## Step 6 — Verify the lock is working

In SQL Editor, test that a past match can't be predicted:
```sql
-- This should FAIL with a policy violation if the match's kickoff_utc has passed
INSERT INTO predictions (user_id, match_id, predicted_result, predicted_score_a, predicted_score_b)
VALUES (auth.uid(), 1, 'teamA', 2, 0);
-- Expected: "new row violates row-level security policy"
```

---

## How it all works end to end

```
pg_cron fires at scheduled UTC time
  → calls sync-scores edge function via HTTP
    → queries DB: matches with result=NULL and kickoff_utc < now()-2h
    → calls worldcup26.ir API for those match IDs
    → if API says finished: writes result+scores to matches table
    → calls score_match_predictions(match_id) — one SQL batch, not a loop
    → resolves knockout team names for next round
    → writes to sync_log
      → admin panel Sync tab shows the log in real time
```

```
User tries to submit prediction
  → Supabase RLS checks: now() < kickoff_utc - 1hr ?
    → YES: insert/update allowed
    → NO:  rejected at DB level, never reaches the app
      → predict.js UI also hides the form (reads kickoff_utc from DB)
```

---

## If the API is down or returns wrong data

The admin "Override" button in the Results tab lets you manually enter any score.
It writes `sync_source = 'admin'` so you can see which results were hand-entered
vs auto-synced in the completed matches list.

The sync function will skip matches that already have a result, so a manual
override won't get overwritten by a later cron run.
