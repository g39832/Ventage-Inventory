# Threadly

**Inventory, accounting, and listing management for vintage resellers — with real eBay integration and an AI assistant.**

Threadly is a multi-user web app that gives a reselling shop one source of truth: every piece of inventory, every sale, every expense, and every marketplace connection in one place. It runs on Supabase (database, auth, photo storage) with a small Express server that powers the AI assistant and the eBay integration.

---

## What it does

| Area | What you get |
|---|---|
| **Inventory** | Add pieces with brand, category, size, era, condition, cost, and asking price. Soft-delete (archive), SKUs, tags, notes, and a per-item timeline. |
| **Photos** | Drag-and-drop uploads, auto-optimized, stored in Supabase Storage and reorderable per item. |
| **Sales & expenses** | Log sales with fees and shipping to get real payout and profit. Categorized expenses, item-level expenses. |
| **Analytics & reports** | Dashboard KPIs, revenue/profit charts, category and marketplace breakdowns, plus 6 downloadable reports (CSV and print-to-PDF): Monthly P&L, quarterly, yearly, tax summary, inventory valuation, top sellers. |
| **Marketplaces** | **eBay is a real integration** — connect your eBay account and publish items, end listings, and sync live status + recent orders through eBay's official API. Depop, Poshmark, Vinted, Mercari, and Facebook Marketplace don't offer third-party selling APIs, so they're honest manual tracking. |
| **Ask Threadly (AI)** | A chat assistant that answers questions from your own data and drafts listing copy. Bring-your-own OpenAI key per user, or set one server-wide key. Rate-limited by default. |
| **Multi-user & secure** | Every user has isolated data enforced by Supabase Row Level Security. No service-role key is used anywhere; the server derives identity from the verified Supabase session. |

## Tech stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS 4, Radix UI primitives, Recharts, React Router 7, Supabase JS
- **Server:** Node 20+ / Express 5 (`server/`) — serves the built frontend and the `/api` routes
- **Database/auth/storage:** Supabase (Postgres + Auth + RLS + Storage)
- **AI:** OpenAI via a pluggable provider (`server/ai/providers/`), so it can be swapped or disabled

## Architecture at a glance

```
Browser (React SPA)
   │  Supabase JS (anon key) ──────────────► Supabase (Postgres + RLS + Auth + Storage)
   │
   └── /api ──► Express server (server/)
                  ├─ /api/ai/ask            → Ask Threadly (OpenAI, server-side key only)
                  └─ /api/marketplaces/ebay → eBay OAuth + Sell API (tokens stored per-user, server-side)
```

- The browser never holds a secret: no OpenAI key, no eBay key, no service-role key.
- The server verifies the Supabase access token on every API call and acts as that user, so RLS keeps every query scoped to the signed-in user's own data.
- eBay OAuth tokens live in a `ebay_tokens` table behind the same RLS model; the browser only ever sees connection state.

## Repo layout

```
src/                    React app
  components/           UI primitives + layout (sidebar, top bar, charts)
  lib/                  domain logic, Supabase data layer, store, AI/eBay clients
  pages/                one file per route (dashboard, inventory, sales, ...)
server/                 Express server
  ai/                   Ask Threadly provider + context builders + rate limiting
  marketplaces/ebay/    eBay OAuth, tokens, Sell API calls, routes
supabase/               SQL: schema, RLS, storage, eBay tokens, seed, security tests
  SETUP.md              Supabase setup walkthrough
  AUTH_SETUP.md         Google sign-in + security model
EBAY_SETUP.md           eBay developer app setup (~15 min, one-time)
render.yaml             Render blueprint (builds frontend + runs server)
```

## Setup in ~10 minutes

1. **Create a Supabase project** (free tier is fine to start) at supabase.com.
2. **Run the schema** in the SQL Editor:
   - `supabase/schema.sql` (tables + RLS; includes the eBay tokens table)
   - `supabase/storage.sql` (photo/avatar buckets)
   - *(optional, dev only)* `supabase/seed.sql` for owner-less demo data
3. **Configure auth URLs** — Supabase → Authentication → URL Configuration → Site URL + Redirect URLs to your app URL (`http://localhost:5173` in dev).
4. **Create `.env.local`** from `.env.example`:
   ```
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```
5. **Install and run:**
   ```bash
   npm install
   npm run dev          # frontend at http://localhost:5173
   npm run dev:server   # API server (proxied at /api)
   ```
6. Sign up, choose "Start with demo data" during onboarding, and you're in.

Production: `npm run build` then `npm run start` — the Express server serves both the built frontend and the API. `render.yaml` does exactly this on Render.

## Connecting eBay (the easy path)

eBay is the one marketplace with a real API, and Threadly makes it a two-part setup:

**Owner side — one time, ~15 minutes** (see `EBAY_SETUP.md` for the full click-by-click):
1. Create a free eBay developer account → create a **production** application → copy its **Client ID** and **Client Secret**.
2. Register your redirect URI (`https://your-app.com/ebay/callback`).
3. Request **production access** (usually approved quickly).
4. Add three server env vars: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI`.

**User side — one click:** open **Marketplace connections → eBay → Connect with eBay**, approve on eBay's page, and you're connected. From any item's **Marketplace status** tab, click **Publish to eBay** (the item needs at least one photo). **Sync now** pulls your live listings and recent orders. Items publish into your chosen eBay category (set it under eBay → Manage; default `15687` = Men's T-Shirts).

> eBay tokens are stored per-user, server-side, behind Row Level Security. The browser never touches eBay directly.

## Costs (who pays what)

| Service | Plan | Cost |
|---|---|---|
| Supabase | Free for dev; **Pro $25/mo** for production (no pausing + daily backups) | — |
| Render | Free (cold starts) or **~$7/mo** Starter (stays warm) | — |
| OpenAI | Pay-per-use (`gpt-4o-mini` by default) or each user brings their own key | $0–few $/mo |
| eBay developer app | Free | $0 |

## Support

Questions, issues, or help connecting eBay? Email the app owner — the in-app footer and Settings → *Need help?* link point to the address configured in `src/lib/brand.ts` (`SUPPORT_EMAIL`). Change that one constant to update it everywhere.

## License

See `LICENSE` for terms. (Add one before sale — a commercial single-buyer license is the default recommendation.)
