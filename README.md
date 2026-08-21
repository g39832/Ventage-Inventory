# Regroove

> **Naming note:** this product was previously branded **Ventage** and has been renamed **Regroove**. A few legacy infrastructure identifiers (the GitHub repo `Ventage-Inventory`, the Render service `ventage`, and the Supabase project) still carry the old name — these are hosting references, not the product name.

**Inventory, accounting, and listing management for vintage resellers — with real eBay integration and an AI assistant.**

Regroove is a multi-user web app that gives a reselling shop one source of truth: every piece of inventory, every sale, every expense, and every marketplace connection in one place. It runs on Supabase (database, auth, photo storage) with a small Express server that powers the AI assistant and the eBay integration.

---

## What it does

| Area | What you get |
|---|---|
| **Inventory** | Add pieces with brand, category, size, era, condition, cost, and asking price. Soft-delete (archive), SKUs, tags, notes, and a per-item timeline. |
| **Photos** | Drag-and-drop uploads, auto-optimized, stored in Supabase Storage and reorderable per item. |
| **Sales & expenses** | Log sales with fees and shipping to get real payout and profit. Categorized expenses, item-level expenses. |
| **Analytics & reports** | Dashboard KPIs, revenue/profit charts, category and marketplace breakdowns, plus 6 downloadable reports (CSV and print-to-PDF): Monthly P&L, quarterly, yearly, tax summary, inventory valuation, top sellers. |
| **Marketplaces** | **eBay is a real integration** — connect your eBay account and publish items, end listings, and sync live status + recent orders through eBay's official API. Depop, Poshmark, Vinted, Mercari, and Facebook Marketplace don't offer third-party selling APIs, so they're honest manual tracking. |
| **Research** | Research an item **before you buy it** — search eBay's official Browse API for live active listings and recent sold comps, then get resale metrics (sell-through rate, average/median sold price, estimated market price) with a clearly-labeled estimate. Optional save-to-history and a purchase-price profit/ROI calculator. No user eBay connection needed — it uses the app's keys. |
| **Ask Regroove (AI)** | A chat assistant that answers questions from your own data and drafts listing copy. Bring-your-own OpenAI key per user, or set one server-wide key. Rate-limited by default. |
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
                  ├─ /api/ai/ask            → Ask Regroove (OpenAI, server-side key only)
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
  ai/                   Ask Regroove provider + context builders + rate limiting
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
   - `supabase/schema.sql` (tables + RLS; includes the eBay tokens + research history tables)
   - `supabase/storage.sql` (photo/avatar buckets)
   - *(optional, dev only)* `supabase/seed.sql` for owner-less demo data
   - *Upgrading an existing database?* run `supabase/ebay.sql` and `supabase/research.sql` on top of your current schema instead.
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

eBay is the one marketplace with a real API, and Regroove makes it a two-part setup:

**Owner side — one time, ~15 minutes** (see `EBAY_SETUP.md` for the full click-by-click):
1. Create a free eBay developer account → create a **production** application → copy its **Client ID** and **Client Secret**.
2. Register your redirect URI (`https://your-app.com/ebay/callback`).
3. Request **production access** (usually approved quickly).
4. Add three server env vars: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI`.

**User side — one click:** open **Marketplace connections → eBay → Connect with eBay**, approve on eBay's page, and you're connected. From any item's **Marketplace status** tab, click **Publish to eBay** (the item needs at least one photo). **Sync now** pulls your live listings and recent orders. Items publish into your chosen eBay category (set it under eBay → Manage; default `15687` = Men's T-Shirts).

> eBay tokens are stored per-user, server-side, behind Row Level Security. The browser never touches eBay directly.

## Researching an item (sold comps)

The **Research** page (sidebar → Selling → Research) helps you decide whether a piece is worth picking up before you buy it. It uses the **same eBay developer keys** — no per-user eBay connection is required, because the Buy Browse API search accepts an *application* access token that the server obtains from your keys.

- **Active listings** come from a plain keyword search; **sold comps** come from the official `itemEndState:EndedWithSales` filter, which returns ended-with-sales items with their final prices (the retired Finding API's `findCompletedItems` is what it replaces).
- Metrics (sell-through rate, average/median sold price, estimated market price) are computed in application code, never by AI. Ask prices are kept strictly separate from sale prices.
- **Honest by design:** if eBay returns no sold comps, the page says so and shows only what's computable. eBay's ended-item index only covers a recent window of ended listings.
- **Caching & cost control:** identical searches are cached server-side for 30 minutes, and research is throttled per user (60/hour) and app-wide (1,500/day — tune with `EBAY_RESEARCH_LIMIT_PER_HOUR` / `EBAY_RESEARCH_LIMIT_GLOBAL_PER_DAY`) to protect the app key's daily Buy API quota.
- Saved research lives in the `research_history` table behind the same RLS model — each user only ever sees their own.

## Costs (who pays what)

| Service | Plan | Cost |
|---|---|---|
| Supabase | Free for dev; **Pro $25/mo** for production (no pausing + daily backups) | — |
| Render | Free (cold starts) or **~$7/mo** Starter (stays warm) | — |
| OpenAI | Pay-per-use (`gpt-4o-mini` by default) or each user brings their own key | $0–few $/mo |
| eBay developer app | Free | $0 |

## Security & cost controls

Regroove is multi-tenant by design, with defense-in-depth so one user can never
reach another user's data or run up the owner's bill:

- **Data isolation** — every table is Row-Level-Security scoped to `auth.uid()`;
  the shared `marketplaces` reference table is read-only for users.
- **No secrets in the browser** — the anon key is the only key on the client.
  The OpenAI key and eBay tokens live server-side; eBay tokens are stored
  per-user behind RLS.
- **Server auth** — every `/api` route verifies the Supabase session; the
  server never trusts a client-supplied user id.
- **AI spend caps** — per-user hourly limit (default 30) plus a server-wide
  hourly limit (default 500, set `AI_RATE_LIMIT_GLOBAL_PER_HOUR=0` to disable).
  For a hard backstop, set a monthly usage limit on the OpenAI account dashboard
  and a spend cap in Supabase.
- **eBay throttling** — publish/unlist/sync are rate-limited per user (60/hour)
  so a misbehaving client can't get the developer app flagged; item research
  is capped per user (60/hour) and app-wide (1,500/day) so a busy day can't
  burn the app key's shared Buy API quota.
- **Upload limits** — photos are resized client-side, capped at 15 MB per file
  and 12 per item.
- **CSV export safety** — exported spreadsheets guard against formula injection.
- **CORS locked** — the API only answers cross-origin requests from the app's
  own origins (`CORS_ORIGIN`).

Recommended one-time dashboard settings for production: keep **email
confirmation on** in Supabase (blocks bot signups), set a **storage limit**
under Supabase → Storage, and set an **OpenAI hard limit** so Ask Regroove can
never exceed a monthly budget.

## Support

Questions, issues, or help connecting eBay? Email the app owner — the in-app footer and Settings → *Need help?* link point to the address configured in `src/lib/brand.ts` (`SUPPORT_EMAIL`). Change that one constant to update it everywhere.

## License

See `LICENSE` for terms. (Add one before sale — a commercial single-buyer license is the default recommendation.)
