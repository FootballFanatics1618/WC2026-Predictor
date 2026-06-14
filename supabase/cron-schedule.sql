-- ============================================================
-- pg_cron Schedule — sync-scores Edge Function
-- Run in Supabase SQL Editor AFTER:
--   1. Enabling pg_cron extension (Dashboard → Database → Extensions)
--   2. Enabling pg_net extension (Dashboard → Database → Extensions)
--   3. Deploying the sync-scores edge function:
--        npx supabase login --token YOUR_ACCESS_TOKEN
--        npx supabase link --project-ref YOUR_PROJECT_REF
--        npx supabase functions deploy sync-scores --no-verify-jwt
-- ============================================================

-- ── How it works ─────────────────────────────────────────────────────────────
--
-- A single cron job fires every 5 minutes during all possible match hours.
-- On each fire it calls the sync-scores edge function which:
--   1. Finds all matches that have ended (kickoff_utc + 2h < now) but have no result
--   2. Calls the worldcup26.ir API and matches by TEAM NAME (not match ID)
--   3. Writes the result + scores to the DB
--   4. Calls score_match_predictions() to batch-score all user predictions
--   5. Logs the run to sync_log
--
-- Schedule: */5 16-23,0-7 * * *
--   Fires every 5 minutes between 16:00 UTC and 07:00 UTC
--   Covers all ET kick-off slots (12:00 ET through midnight ET) + buffer
--   Maximum delay from final whistle to result in app: ~5 minutes
--
-- ── Values to replace ────────────────────────────────────────────────────────
--
--   YOUR_PROJECT_REF     → Supabase Dashboard → Settings → API → Reference ID
--                          e.g. wanhtjuxmivmztmtzpzs
--
--   YOUR_SERVICE_ROLE_KEY → Supabase Dashboard → Settings → API → service_role
--                           Long eyJ... string (keep this secret)
--
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Remove any old sync jobs (safe to run even if none exist)
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'sync-scores%';

-- Step 2: Create the new polling job
SELECT cron.schedule(
  'sync-scores-poll',
  '*/5 16-23,0-7 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-scores?source=cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Step 3: Verify the job was created
SELECT jobname, schedule, active FROM cron.job;

-- Expected output:
-- jobname           | schedule             | active
-- ------------------+----------------------+-------
-- sync-scores-poll  | */5 16-23,0-7 * * * | true


-- ── Useful queries ────────────────────────────────────────────────────────────

-- View recent sync history (what the edge function did on each run):
-- SELECT * FROM sync_log ORDER BY ran_at DESC LIMIT 20;

-- View cron run details (whether the job itself fired successfully):
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Remove the job if needed:
-- SELECT cron.unschedule('sync-scores-poll');
