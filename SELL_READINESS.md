# Threadly — Sell-Readiness & Hands-Off Operations Plan

> Prepared for the seller. Goal: make the app (1) complete enough to sell with a clear
> conscience, and (2) run for years with **zero code updates** from the seller after handover.

---

## ⚡ The Ship Checklist (one page)

**P0 — must do before listing it for sale:**
- [x] Reports page: real CSV export + print-to-PDF for all 6 report types (no more "Phase 7" toasts)
- [x] Marketplace page: honest manual tracking for channels without APIs; fake "Sync now"/dead switches removed
- [x] **eBay integration built** (the one channel with a real API): OAuth connect, publish items to eBay, real sync, per-user category setting — activates once the owner adds keys (see `EBAY_SETUP.md`; sandbox-test before relying on it)
- [x] Settings → Data & export: working CSV exports (inventory / sales / expenses)
- [ ] README.md (doesn't exist yet)
- [ ] LICENSE (doesn't exist yet)
- [ ] Terms of Service + Privacy Policy pages (accounts + emails = legally required)
- [ ] Remove "ask the developer" strings; add a neutral support contact
- [ ] Clean repo copy for delivery (no `.env.local`, `node_modules`, `dist`, git history)
- [ ] `BUYER_SETUP.md` — from-zero walkthrough + cost sheet (Supabase Pro $25, Render paid $7–25)

**P1 — strongly recommended before a serious sale:**
- [ ] CI: GitHub Actions running `typecheck` + `build` on push
- [ ] At least a server smoke test (`/health`, AI auth rejection) + a manual QA checklist
- [ ] Error monitoring (Sentry) or a free uptime check on `/health`
- [ ] Custom SMTP for auth emails (Resend) so confirmations don't land in spam
- [ ] Document the backup procedure (Supabase Pro daily backups + manual export)
- [ ] Secret scan of the repo before handover

**Decisions I still need from you:** brand name (sell as "Threadly" or make it renamable), sell code+docs vs turnkey, support email/website. (Marketplace integrations are settled: eBay is real, the other five stay manual because those platforms have no third-party APIs.)

---

## 0. Current state in one paragraph

Threadly is a genuinely solid, multi-user inventory app for vintage resellers: React + Vite
frontend, Supabase (Postgres, auth, RLS-scoped data, photo storage), and a small Express
server that powers "Ask Threadly" AI (bring-your-own-OpenAI-key or a server key, with
rate limiting). Auth, RLS, storage, and onboarding are done and security-tested.

**The catch:** several pages are explicitly unfinished. The Reports page shows "Coming in
Phase 7" toasts instead of generating PDF/CSV. The Marketplace page says eBay sync "will
work once the integration ships" — every connection is manual tracking that just saves a
timestamp. A buyer clicking these buttons will immediately discover the app is 80% done.
That's the first thing to fix before a sale.

---

## Part 1 — P0: Finish the visible, incomplete features

| # | Item | What exists today | What "done" looks like |
|---|------|-------------------|------------------------|
| 1 | **Reports** | Buttons only toast "Coming in Phase 7" | Real PDF/CSV export for at least Monthly P&L, Inventory valuation, Top sellers, Tax summary. Client-side CSV is easy (data is already computed); PDF can be print-to-PDF via a styled print view. |
| 2 | **Marketplace integrations** | All 6 channels are manual tracking; UI promises "when the eBay integration ships" | Two options: **(a)** remove the false promise — relabel as "manual tracking" honestly, or **(b)** build one real integration (eBay Browse/Trading API or Discogs) as a flagship feature. (b) is a big lift; (a) is honest and cheap. |
| 3 | **Marketplace "Manage" sheet** | "Sale notifications" and "Include in reports" switches do nothing (no persistence) | Wire them to real per-connection settings or remove them. Fake switches are worse than none. |
| 4 | **Yearly / Tax report cards** | Marked "Preview" / "Draft" | Mark as coming-soon **or** ship them. Decide, don't leave ambiguous. |
| 5 | **eBay "Sync now"** | Updates a timestamp only | Either drop the button or make it do something real. |

**Effort:** #1 ~1–2 days (CSV now, PDF later). #2(a) 2 hours. #3 ~half a day. #5 2 hours.

---

## Part 2 — P0: Sell-ready packaging

| # | Item | Why it matters |
|---|------|----------------|
| 6 | **README.md** (doesn't exist) | Buyers judge from the README. Needs: what it is, screenshot section, feature list, tech stack, 10-minute setup, architecture diagram (text), file map, FAQ. |
| 7 | **LICENSE** (doesn't exist) | A sale needs explicit terms. At minimum a "Commercial License — single buyer, no resale of source" text file. Consult a lawyer for real money sales; for marketplace sales, follow the platform's license template. |
| 8 | **Branding / white-label decision** | "Threadly" is hardcoded in ~100 places (title, sidebar, logo, auth pages, error strings, even "ask the developer" copy). Decide: sell as "Threadly" (fine for a marketplace listing) **or** make name/logo/support-email configurable via env vars (~1 day). At minimum, remove "ask the developer" strings and point support at a neutral email/URL. |
| 9 | **Terms of Service + Privacy Policy pages** | The app collects emails, passwords, and user data → legally required in most markets. Add static routes + links on the login/signup pages. |
| 10 | **Buyer handover docs** | A `BUYER_SETUP.md` that takes a buyer from zero to production in ~30 minutes, including every account they must create and every bill they'll pay (see Part 3). |

---

## Part 3 — P0/P1: "Runs without you" — the services problem

This is the heart of your question. The app depends on three services. All three have
**free tiers that quietly stop working** — that's the #1 way a "sold" app dies and makes
you look bad.

### 3a. Supabase (database, auth, storage, photos)

- **Free tier pauses the whole project after 7 days of no activity.** A buyer's app can
  literally go offline. It also has **no backups** and a 2-project limit.
- **Fix:** the buyer should run **Supabase Pro ($25/mo)** — no pausing, daily backups
  with 7-day retention, bigger limits. Bake this into the docs and the cost sheet.
- **Backup procedure:** document the one-click manual backup (Dashboard → Database →
  Backups) and storage export so the buyer has an escape hatch.
- **Email delivery:** auth emails (confirmations, password reset) currently go through
  Supabase's shared sender, which is rate-limited and can land in spam. Configure
  **custom SMTP (e.g., Resend — free tier exists)** in Supabase → Authentication → SMTP
  so signups actually arrive. One-time setup, zero maintenance.

### 3b. Render (the web server + frontend hosting)

- **Free tier spins down after 15 minutes of inactivity** → 30–60s cold starts for the
  buyer's first visitor each time. Free tier also has bandwidth caps.
- **Fix:** a paid **Starter instance (~$7/mo)** stays warm. That's it — no code changes.
  (Alternative: a free keep-alive cron pings `/health` every 5 min — works but is a
  hack; the endpoint already exists at `server/index.ts`.)
- The render.yaml already pins Node 22 and uses `npm ci` — good, deterministic builds.

### 3c. OpenAI ("Ask Threadly")

- Pay-per-use; the buyer already has two options: bring their own key per user, or set
  one server key. Rate limit (30 req/user/hour default) caps the bill. **Document the
  cost model** ("roughly $0.00x per question on gpt-4o-mini") so there are no surprises.

### Why no code updates are needed (say this to the buyer)

- All dependency versions are pinned by `package-lock.json`; production uses `npm ci`,
  so installs are identical forever.
- The frontend is a static build + one tiny Express server. Nothing in it depends on the
  seller.
- Ask Threadly is a provider *plugin* (`server/ai/`) — if OpenAI ever breaks, it's one
  file, and the buyer can also just disable AI entirely; the app works fine without it.
- **The only things that can ever force a change:** a security vulnerability in a pinned
  dependency, a platform deprecation (Render/Supabase changing terms), or a new feature.
  None are *required* for the app to keep working.

### Monthly cost sheet for the buyer (include in docs)

| Service | Plan | Cost |
|---------|------|------|
| Supabase | Pro | $25/mo |
| Render | Starter (paid) | ~$7/mo |
| OpenAI | pay-per-use or user key | $0–few $/mo |
| Custom domain (optional) | — | ~$10–15/yr |
| Resend (optional, for emails) | Free tier | $0 |

---

## Part 4 — P1: Hardening (recommended before a serious sale)

| # | Item | Notes |
|---|------|-------|
| 11 | **CI** (GitHub Actions) | Run `npm run typecheck` + `npm run build` on every push. Protects the buyer and any future devs. ~1 hour. |
| 12 | **Tests** | None exist today. Add: server smoke test (`/health`, `/api/ai/ask` auth rejection), one RLS-style unit test, and a manual QA checklist doc. Doesn't need to be exhaustive — some is infinitely better than none. |
| 13 | **Error tracking** | No Sentry/monitoring. Add optional `Sentry` (free tier) or at least an uptime check (UptimeRobot free) on `/health`. |
| 14 | **CORS hardening** | Server has wide-open `app.use(cors())`. Fine for now (JWT-authed), but lock it to the app origin for cleanliness. |
| 15 | **Admin visibility** | The seller/buyer has no in-app view of signups/usage. Cheapest fix: a documented Supabase Dashboard query (SQL for user count, items, etc.). A real admin page is nice-to-have. |
| 16 | **Data export for users** | Users have no way to take their data out (GDPR / good practice). CSV export of inventory/sales/expenses. Overlaps with #1. |
| 17 | **Secret scan before sale** | Grep the repo for keys/tokens; confirm `.env.local` never ships (it's gitignored already). |

---

## Part 5 — Suggested execution order

1. **Week 1 — Finish visible features** (#1–5). Nothing else matters if a buyer clicks
   "Generate report" and gets a "later" toast.
2. **Week 2 — Packaging** (#6–9): README, LICENSE, legal pages, branding cleanup.
3. **Week 2–3 — Hands-off ops** (#10 + Part 3): buyer setup doc, cost sheet, paid-tier
   guidance, SMTP instructions, backup procedure.
4. **Week 3 — Hardening** (#11–17): CI, tests, monitoring, secret scan.
5. **Final — Handover dry run:** follow BUYER_SETUP.md from a clean machine, on a fresh
   Supabase project, fresh Render service. If a non-technical person can go from nothing
   to a working app in ~30 minutes, you're done.

---

## What I can start on right now (no decisions needed from you)

- **#1 Reports CSV export** — the data is already computed; wiring real CSV downloads is
  self-contained.
- **#3 Marketplace fake switches** — wire or remove them.
- **#2/#5 honesty pass** — relabel manual tracking so nothing promises a fake integration.
- **#6 README** — write it from the codebase.
- **#11 CI workflow** — typecheck + build on push.
- **#17 secret scan** — quick grep.

Bigger items (#8 white-label, #9 legal pages, #12 tests, #13 monitoring) I can also do,
but they involve choices (brand name, support email, your legal preference) — tell me
your answers and I'll proceed.

---

*Decisions I need from you before the sale-readiness "done" checklist is locked:*

1. Selling as **"Threadly"** or do you want the buyer able to **rename** it (env-config)?
2. Do you want me to build a **real marketplace integration** (eBay/Discogs) or market
   the app honestly as manual-tracking?
3. Do you plan to sell **your existing running instance** (hand over the Supabase + Render
   accounts) or sell **the code + setup docs** (buyer creates their own)? This changes
   what "handover" means.
4. Any support **email/website** you want shown in-app?
