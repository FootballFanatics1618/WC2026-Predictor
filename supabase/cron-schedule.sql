-- ============================================================
-- pg_cron Schedule — sync-scores Edge Function
-- Run in Supabase SQL Editor AFTER:
--   1. Enabling pg_cron extension (Dashboard → Database → Extensions)
--   2. Deploying the sync-scores edge function
-- ============================================================

-- ── How the timing works ─────────────────────────────────────────────────────
--
-- World Cup 2026 match kick-off windows (ET → UTC):
--   Slot A: 12:00 ET  = 16:00 UTC   → matches end ~18:00 UTC
--   Slot B: 15:00 ET  = 19:00 UTC   → matches end ~21:00 UTC
--   Slot C: 18:00 ET  = 22:00 UTC   → matches end ~00:00 UTC
--   Slot D: 21:00 ET  = 01:00 UTC   → matches end ~03:00 UTC  (rare, late US games)
--
-- Strategy: run the sync function ~30 minutes after each window's expected
-- end time. Run it TWICE per window with a 20-min gap to handle extra time.
-- This means ~8 runs/day on heavy match days, 0 on off days.
-- Way cheaper than polling every 5 minutes (288 runs/day).
--
-- All times in UTC.

-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY below.
-- Get them from: Supabase Dashboard → Settings → API

-- First, enable the pg_cron + pg_net extensions if not already enabled:
-- Dashboard → Database → Extensions → search "cron" and "http"

-- ── Cron jobs ────────────────────────────────────────────────────────────────

-- Window A (kick-off 12:00 ET = 16:00 UTC, ends ~18:15):
-- First check at 18:30 UTC, second at 18:50 UTC
SELECT cron.schedule(
  'sync-scores-window-A-1',
  '30 18 * * *',
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

SELECT cron.schedule(
  'sync-scores-window-A-2',
  '50 18 * * *',
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

-- Window B (kick-off 15:00 ET = 19:00 UTC, ends ~21:15):
SELECT cron.schedule('sync-scores-window-B-1', '30 21 * * *',
  $$ SELECT net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer YOUR_SERVICE_ROLE_KEY','Content-Type','application/json'), body := '{}'::jsonb); $$
);
SELECT cron.schedule('sync-scores-window-B-2', '50 21 * * *',
  $$ SELECT net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer YOUR_SERVICE_ROLE_KEY','Content-Type','application/json'), body := '{}'::jsonb); $$
);

-- Window C (kick-off 18:00 ET = 22:00 UTC, ends ~00:15 UTC next day):
SELECT cron.schedule('sync-scores-window-C-1', '30 0 * * *',
  $$ SELECT net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer YOUR_SERVICE_ROLE_KEY','Content-Type','application/json'), body := '{}'::jsonb); $$
);
SELECT cron.schedule('sync-scores-window-C-2', '50 0 * * *',
  $$ SELECT net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer YOUR_SERVICE_ROLE_KEY','Content-Type','application/json'), body := '{}'::jsonb); $$
);

-- Window D (late games 21:00 ET = 01:00 UTC, ends ~03:15):
SELECT cron.schedule('sync-scores-window-D-1', '30 3 * * *',
  $$ SELECT net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer YOUR_SERVICE_ROLE_KEY','Content-Type','application/json'), body := '{}'::jsonb); $$
);
SELECT cron.schedule('sync-scores-window-D-2', '50 3 * * *',
  $$ SELECT net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer YOUR_SERVICE_ROLE_KEY','Content-Type','application/json'), body := '{}'::jsonb); $$
);

-- ── Safety net: catchall every 3 hours ───────────────────────────────────────
-- Handles edge cases: matches delayed, API slow, IST-midnight rollover issues.
-- Only fires the function if there are actually pending matches (cheap check).
SELECT cron.schedule('sync-scores-catchall', '0 */3 * * *',
  $$ SELECT net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-scores?source=catchall', headers := jsonb_build_object('Authorization','Bearer YOUR_SERVICE_ROLE_KEY','Content-Type','application/json'), body := '{}'::jsonb); $$
);

-- ── View scheduled jobs ───────────────────────────────────────────────────────
-- SELECT * FROM cron.job;

-- ── Remove a job if needed ────────────────────────────────────────────────────
-- SELECT cron.unschedule('sync-scores-window-A-1');

-- ── View recent run history ───────────────────────────────────────────────────
-- SELECT * FROM sync_log ORDER BY ran_at DESC LIMIT 20;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
