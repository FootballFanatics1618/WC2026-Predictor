# Project Brief

`WC2026-Predictor` is a World Cup 2026 prediction league web app built with Next.js and Supabase.

## What It Does

- Lets users sign up, log in, and make match predictions
- Tracks results, points, and leaderboard rankings
- Supports a Golden Boot pick for bonus points
- Gives admins a panel to enter results and award bonuses
- Includes an auto-sync flow through Supabase migrations, cron, and an edge function

## Main Pages

- `/` landing page
- `/signup` create an account
- `/login` sign in
- `/predict` make and review predictions
- `/golden-boot` edit the Golden Boot pick
- `/leaderboard` view rankings
- `/others` view other users' picks
- `/admin` admin controls for results and sync

## Main Tech

- Next.js pages router
- React components in `components/`
- Supabase auth, database, edge functions, and cron
- Shared match/player data in `lib/data.js`
- Global styles in `styles/globals.css`

## Important Notes

- Admin access is controlled by `NEXT_PUBLIC_ADMIN_EMAILS`
- Local app settings live in `.env.local`
- The project has a custom `404` and `_error` page
- `supabase/` contains the migration, cron SQL, and sync function used for automated score updates

## Working Tips

- Keep UI changes consistent with the existing dark/gold football theme
- Prefer shared components when the same UI appears in multiple places
- Run `npm run build` after meaningful changes
- Avoid touching generated folders like `.next/`
