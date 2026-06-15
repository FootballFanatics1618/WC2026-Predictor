-- ============================================================
-- pg_cron Schedule — sync-scores Edge Function
-- Run in Supabase SQL Editor AFTER:
--   1. Enabling pg_cron + pg_net extensions (Dashboard → Database → Extensions)
--   2. Deploying the sync-scores edge function
-- ============================================================

-- ── CRITICAL: Run this FIRST to drop all broken jobs ─────────────────────────
SELECT cron.unschedule('sync-scores-window-A-1');
SELECT cron.unschedule('sync-scores-window-A-2');
SELECT cron.unschedule('sync-scores-window-B-1');
SELECT cron.unschedule('sync-scores-window-B-2');
SELECT cron.unschedule('sync-scores-window-C-1');
SELECT cron.unschedule('sync-scores-window-C-2');
SELECT cron.unschedule('sync-scores-window-D-1');
SELECT cron.unschedule('sync-scores-window-D-2');
SELECT cron.unschedule('sync-scores-catchall');

-- ── Cron jobs ────────────────────────────────────────────────────────────────

-- Window A (kick-off 12:00 ET = 16:00 UTC, ends ~18:15):
SELECT cron.schedule(
  'sync-scores-window-A-1',
  '30 18 * * *',
  $$ SELECT net.http_post(url := 'https://pqmjkggmcodjwyiceczi.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w','Content-Type','application/json'), body := '{}'::jsonb); $$
);
SELECT cron.schedule(
  'sync-scores-window-A-2',
  '50 18 * * *',
  $$ SELECT net.http_post(url := 'https://pqmjkggmcodjwyiceczi.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w','Content-Type','application/json'), body := '{}'::jsonb); $$
);

-- Window B (kick-off 15:00 ET = 19:00 UTC, ends ~21:15):
SELECT cron.schedule(
  'sync-scores-window-B-1',
  '30 21 * * *',
  $$ SELECT net.http_post(url := 'https://pqmjkggmcodjwyiceczi.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w','Content-Type','application/json'), body := '{}'::jsonb); $$
);
SELECT cron.schedule(
  'sync-scores-window-B-2',
  '50 21 * * *',
  $$ SELECT net.http_post(url := 'https://pqmjkggmcodjwyiceczi.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w','Content-Type','application/json'), body := '{}'::jsonb); $$
);

-- Window C (kick-off 18:00 ET = 22:00 UTC, ends ~00:15 UTC next day):
SELECT cron.schedule(
  'sync-scores-window-C-1',
  '30 0 * * *',
  $$ SELECT net.http_post(url := 'https://pqmjkggmcodjwyiceczi.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w','Content-Type','application/json'), body := '{}'::jsonb); $$
);
SELECT cron.schedule(
  'sync-scores-window-C-2',
  '50 0 * * *',
  $$ SELECT net.http_post(url := 'https://pqmjkggmcodjwyiceczi.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w','Content-Type','application/json'), body := '{}'::jsonb); $$
);

-- Window D (late games 21:00 ET = 01:00 UTC, ends ~03:15):
SELECT cron.schedule(
  'sync-scores-window-D-1',
  '30 3 * * *',
  $$ SELECT net.http_post(url := 'https://pqmjkggmcodjwyiceczi.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w','Content-Type','application/json'), body := '{}'::jsonb); $$
);
SELECT cron.schedule(
  'sync-scores-window-D-2',
  '50 3 * * *',
  $$ SELECT net.http_post(url := 'https://pqmjkggmcodjwyiceczi.supabase.co/functions/v1/sync-scores?source=cron', headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w','Content-Type','application/json'), body := '{}'::jsonb); $$
);

-- Safety net: catchall every 3 hours
SELECT cron.schedule(
  'sync-scores-catchall',
  '0 */3 * * *',
  $$ SELECT net.http_post(url := 'https://pqmjkggmcodjwyiceczi.supabase.co/functions/v1/sync-scores?source=catchall', headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w','Content-Type','application/json'), body := '{}'::jsonb); $$
);
