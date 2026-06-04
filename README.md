# ⚽ FIFA World Cup 2026 Predictor

A full-stack prediction league app for you and your friends. Built with Next.js + Supabase, deployed on Vercel.

---

## 📋 Features

- 🔐 User signup with username, password, and Golden Boot pick
- 📅 Predictions locked after match day passes
- 🎯 Predict Result (Team A Win / Draw / Team B Win) + Scoreline
- 🏆 Live leaderboard: Points > CS > CR (Final day: Points > GB > CS > CR)
- 🥇 +10 pt Golden Boot super bonus
- ⚡ Admin panel to enter real results (auto-scores everyone instantly)

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Create a Supabase Account & Project

1. Go to **https://supabase.com** and click **Start for Free**
2. Sign up with GitHub or email
3. Click **New Project**, give it a name like `wc2026-predictor`
4. Choose a region close to you (e.g. `ap-south-1` for India)
5. Set a database password (save it somewhere safe)
6. Wait ~2 minutes for the project to spin up

### Step 2 — Set Up Your Database

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open the file `supabase-schema.sql` from this project
4. Copy the entire contents and paste into the SQL editor
5. Click **Run** (green button)
6. You should see "Success" — your tables are created!

### Step 3 — Get Your Supabase Keys

1. In Supabase, click **Settings** (gear icon, bottom left) → **API**
2. Copy the **Project URL** (looks like `https://abcdef.supabase.co`)
3. Copy the **anon / public** key (long string starting with `eyJ...`)

### Step 4 — Push Code to GitHub

1. Create a **GitHub account** at https://github.com if you don't have one
2. Create a **New Repository** (click the + icon) — name it `wc2026-predictor`
3. On your computer, open a terminal/command prompt
4. Run these commands:
   ```bash
   cd path/to/wc2026   # navigate to this project folder
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/wc2026-predictor.git
   git push -u origin main
   ```

### Step 5 — Deploy to Vercel

1. Go to **https://vercel.com** and sign up (use GitHub to sign in — easiest)
2. Click **Add New → Project**
3. Import your `wc2026-predictor` GitHub repository
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` → paste your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → paste your Supabase anon key
5. Click **Deploy**
6. Wait ~60 seconds — your app is live! 🎉

Vercel gives you a URL like `https://wc2026-predictor.vercel.app` — share this with your friends!

---

## 🔧 Admin Setup

To enter match results after games finish:

1. Open `pages/admin.js`
2. Find the line: `const ADMIN_EMAILS = ['your-email@gmail.com']`
3. Replace `your-email@gmail.com` with the email you used to sign up
4. Commit and push the change (Vercel auto-redeploys)
5. Go to `/admin` on your site — you'll see the admin panel
6. After each game, select the result and enter the score → click **Save Result**
7. Points are calculated and the leaderboard updates instantly for everyone

---

## 📊 Points System

| Event | Points |
|-------|--------|
| Correct result (win/draw) | +3 |
| Correct result + correct scoreline | +5 (total) |
| Golden Boot correct (end of tournament) | +10 bonus |

**Leaderboard ranking:** Points → Correct Scorelines → Correct Results

**Final day ranking:** Points → Golden Boot → Correct Scorelines → Correct Results

---

## 🏗 Project Structure

```
wc2026/
├── pages/
│   ├── index.js        ← Homepage
│   ├── signup.js       ← User registration + Golden Boot pick
│   ├── login.js        ← Login page
│   ├── predict.js      ← Match prediction UI (Today / Upcoming / Completed)
│   ├── leaderboard.js  ← Live rankings table
│   └── admin.js        ← Admin panel (enter results, award Golden Boot)
├── components/
│   └── Navbar.js       ← Navigation bar
├── lib/
│   ├── supabase.js     ← Supabase client
│   └── data.js         ← All teams, players, and match schedule
├── styles/
│   └── globals.css     ← Global styles
└── supabase-schema.sql ← Run this in Supabase SQL Editor
```

---

## 🗓 Adding More Matches

Edit `lib/data.js` — the `MATCHES` array has all 24 seeded. Add more following the same format:

```js
{ id: 25, date: "2026-06-20", time: "18:00", teamA: "France", teamB: "Nigeria", 
  stage: "Group D", venue: "MetLife Stadium", result: null, scoreA: null, scoreB: null }
```

Also add the matching SQL insert to `supabase-schema.sql` and run it in the SQL editor.

---

## 🔒 Prediction Locking Logic

- **Today's matches** → predictions open until the tab switches to "Completed" the next day
- **Past days** → predictions locked (can still view what was picked)
- **Future days** → predictions CAN be made early (no lock on upcoming matches)

To tighten locking to kick-off time (instead of next day), change the `isMatchLocked` function in `predict.js`.

---

## 🆘 Common Issues

**"Invalid email or password"** → Make sure you signed up with that email, check for typos

**Leaderboard shows 0 for everyone** → Match results haven't been entered yet in Admin

**Admin page says "no admin access"** → Update `ADMIN_EMAILS` in `pages/admin.js` with your email

**Environment variables not working** → In Vercel, go to your project → Settings → Environment Variables, check they're set correctly, then redeploy
