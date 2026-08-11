# Ventage — Supabase Setup Checklist

Click-by-click, from zero to a running app. One-time, ~10 minutes. Free tier, no credit card.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub or email).
2. Click **New project**.
3. Pick your **Organization** (or create one).
4. Enter a **Name** (e.g. `ventage`).
5. Set a strong **Database Password** — save it somewhere.
6. Pick a **Region** close to you (e.g. US East / EU West).
7. Click **Create new project** and wait 1–2 minutes for it to provision.

## 2. Get your connection values

1. In your project, open **Project Settings → API** (left sidebar → Settings → API).
2. Copy the **Project URL** (looks like `https://abcdefghijklm.supabase.co`).
3. Copy the **anon / public** API key (starts with `eyJhbGciOi...`).
   - ⚠️ Use the `anon` key, never `service_role`.

## 3. Run the database schema

1. Open **SQL Editor** (left sidebar).
2. Paste the entire contents of `supabase/schema.sql`.
3. Click **Run** — you should see "Success. No rows returned" (multiple times).
4. Optional (dev only): run `supabase/seed.sql` the same way.

## 4. Configure auth URLs

1. Go to **Authentication → URL Configuration**.
2. **Site URL**: `http://localhost:5173`
3. **Redirect URLs**: add `http://localhost:5173`
4. Save.

## 5. Connect the app

1. Copy the template env file:
   ```
   cp .env.example .env.local
   ```
2. Open `.env.local` and replace the two placeholder values:
   ```
   VITE_SUPABASE_URL=https://<your-real-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-real-anon-key>
   ```
3. Save the file.
4. **Restart the dev server** (Ctrl+C, then `npm run dev` again) — Vite only reads env vars at startup.

## 6. Test it

1. Open http://localhost:5173 — you should see the login page.
2. Sign up → check your email for the confirmation link (or disable email confirmation
   under **Authentication → Providers → Email** for instant dev signups).
3. Choose **"Start with demo data"** on onboarding.
4. Refresh the page — your data should still be there.

## 7. Google sign-in (optional)

Follow the Google section in `supabase/AUTH_SETUP.md` (Google Cloud Console OAuth client,
then enable the provider in Supabase).
