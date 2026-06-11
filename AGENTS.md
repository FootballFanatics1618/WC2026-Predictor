# Project Brief

`WC2026-Predictor` is a World Cup 2026 prediction league web app built with Next.js and Supabase.

## What It Does

- Lets users sign up, log in, and make match predictions
- Tracks results, points, and leaderboard rankings
- Supports a Golden Boot pick for bonus points
- Gives admins a panel to enter results and award bonuses
- Includes an auto-sync flow through Supabase migrations, cron, and an edge function
- Works as a Progressive Web App (PWA) with offline support

## Main Pages

- `/` landing page
- `/signup` create an account
- `/login` sign in
- `/predict` make and review predictions
- `/golden-boot` edit the Golden Boot pick
- `/leaderboard` view rankings
- `/others` view other users' picks
- `/admin` admin controls for results and sync
- `_app.js` custom App wrapper
- `404.js` and `_error.js` custom error pages

## Main Tech

- Next.js 15 (pages router)
- React 19
- Supabase auth, database, edge functions, and cron
- Playwright for testing (logic, API, and E2E)
- PWA with service worker (`public/sw.js`) and manifest (`public/site.webmanifest`)

## Key Directories

### `components/`
- `Navbar.js` — navigation bar
- `GoldenBootPicker.js` — Golden Boot player picker UI
- `FlagImg.js` — flag image rendering

### `lib/`
- `data.js` — shared match/player/team data
- `supabase.js` — Supabase client initialization
- `flags.js` — flag data/URLs
- `locktime.js` — prediction lock-time logic
- `standings.js` — standings/leaderboard calculation

### `hooks/`
- `useDragScroll.js` — custom React hook for drag-to-scroll behavior

### `supabase/`
- `functions/sync-scores/index.ts` — edge function for auto-syncing scores
- `migrations/` — 3 SQL migrations (kickoff UTC, golden boot functions, RLS fix)
- `cron-schedule.sql` — cron schedule for automated sync

### `tests/`
- `tests/logic/` — qualification logic tests
- `tests/api/` — prediction lock, scoring, admin override tests
- `tests/e2e/` — UI features, mobile responsive, others page tests
- Configured via `playwright.config.js` with 4 projects (logic, api, desktop, mobile)
- Run with `npm test`, `npm run test:api`, or `npm run test:e2e`

### `public/`
- PWA icons (`icon-192.png`, `icon-512.png`), `site.webmanifest`, `sw.js`
- `favicon.ico`, `ff-logo.jpg`

## Root-Level Files

- `supabase-schema.sql` — full DB schema for manual setup
- `admin-rls-fix.sql` — RLS fix script for admin access
- `db-reset-results.sql` — script to reset match results
- `vercel.json` — Vercel deployment config
- `.env.local` — local app settings (gitignored)
- `.env.local.example` — template for environment variables
- `next.config.js` — Next.js config (strict mode, unoptimized images)

## Root-Level Docs

- `README.md` — setup guide
- `TESTING_RUNBOOK.md` — testing instructions and runbook
- `AUTO_SYNC_SETUP.md` — auto-sync setup documentation
- `Scroll behaviour.md` — documentation on scroll behavior

## Important Notes

- Admin access is controlled by `NEXT_PUBLIC_ADMIN_EMAILS`
- Local app settings live in `.env.local`
- Tests run on port 3001 (`npm run dev` uses `-p 3001`)
- Tests use Playwright with sequential execution (workers: 1)

## Working Tips

- Keep UI changes consistent with the existing dark/gold football theme
- Prefer shared components when the same UI appears in multiple places
- Run `npm run build` after meaningful changes
- Run `npm test` to verify changes don't break existing logic
- Avoid touching generated folders like `.next/`
