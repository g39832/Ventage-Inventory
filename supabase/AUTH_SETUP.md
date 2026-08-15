# Ventage — Phase 2: Authentication & Multi-User Security

This file covers the manual configuration you need to complete in Supabase (and Google)
for authentication to work. The code side is already done.

---

## 1. Database upgrade (required)

`supabase/schema.sql` is now the Phase 2 schema. It is idempotent — run it whether or not
you ran the Phase 1 version:

1. Open the **Supabase Dashboard → SQL Editor** for your project.
2. Paste the entire contents of `supabase/schema.sql` and run it.
3. (Optional, development only) Run `supabase/seed.sql` to load the owner-less dev dataset.

What it does on top of Phase 1:

- `users` becomes the app profile table, keyed 1:1 to `auth.users(id)`, with a trigger that
  creates/syncs a profile on every signup (email, Google, or otherwise).
- A `set_owner_id()` trigger stamps `owner_id = auth.uid()` on every insert, so the client
  can never assign a record to another user.
- All Phase 1 open `anon` policies are dropped. Every user-owned table is now scoped to
  `owner_id = auth.uid()`; photos/listings/events are scoped through their parent item.
- `app_settings` is keyed by `owner_id` (was a single shared row).
- `marketplace_connections` is keyed by `(owner_id, marketplace_id)`.

## 2. Supabase Auth settings

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: your app URL (e.g. `http://localhost:5173` in dev, your production URL later).
- **Redirect URLs**: add your app URL. For local dev with Vite this is
  `http://localhost:5173` (and `http://127.0.0.1:5173` if you use it).

Email provider (default) works out of the box:

- Dashboard → **Authentication → Providers** → Email is enabled by default.
- **Confirm email**: enabled by default. That's fine — new users get a confirmation link,
  and the signup page explains it. You can disable it for instant signups.

## 3. Google OAuth (optional but supported)

Two places need configuration: Google Cloud Console, then Supabase.

### Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create/select a project.
2. **APIs & Services → OAuth consent screen** → set up an *External* consent screen
   (app name, support email, scopes: `email`, `profile`, `openid`). Add yourself as a test user.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: your app origin (e.g. `http://localhost:5173`)
   - Authorized redirect URIs: **`https://<your-project-ref>.supabase.co/auth/v1/callback`**
     (find the exact URL under Supabase → Authentication → Providers → Google — it's shown there)
4. Copy the **Client ID** and **Client secret**.

### Supabase

1. Dashboard → **Authentication → Providers → Google** → enable it.
2. Paste the Client ID and Client secret from Google.
3. Save. The "Authorized redirect URI" shown by Supabase must exactly match the one you
   entered in Google Cloud Console.

No secret keys ever touch the frontend — the browser only uses the public anon key and
`signInWithOAuth` redirects to Supabase's hosted flow.

## 4. Running the security tests

`supabase/security-tests.sql` simulates two signed-in users (Alice and Bob) by setting the
JWT claim and switching PostgREST to the `authenticated` role, then verifies:

- each user can only see their own items/sales/expenses/tasks/connections/settings;
- direct reads/updates/deletes of another user's records fail;
- child records (events, listings, sales) can't be attached to another user's item;
- the owner-stamping trigger overrides any client-supplied `owner_id`.

To run: open the SQL Editor, paste `supabase/security-tests.sql`, run it. It runs in a
transaction that rolls back, so it leaves nothing behind. Any line that prints
`FAIL: ...` or raises an exception means RLS is misconfigured.

For a live browser check (recommended before shipping):

1. Sign up as **User A** (incognito window), choose demo data, add an item.
2. Sign out, sign up as **User B**, choose empty inventory.
3. Confirm User B's dashboard/inventory/sales/expenses are all empty.
4. As User B, manually visit `/inventory/<User A's item id>` (grab the id from the URL
   while signed in as A). It must show "not found", not User A's item.
5. Sign back in as User A: everything is still there.

## 5. Notes & security posture

- Only the **anon/publishable** key is in the frontend (`.env.local`). The `service_role`
  key must never be used client-side.
- RLS is the security boundary; the app never filters by user in the browser.
- `seed.sql` rows are owner-less and therefore invisible to signed-in users — that's
  intentional. Real users get their own demo data through onboarding.
- Password resets use Supabase's recovery-link flow (PKCE); the reset page exchanges the
  `?code=` and only then accepts a new password.
