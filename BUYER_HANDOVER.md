# Threadly — Buyer Handover & Managed Hosting Agreement

> This document accompanies the sale of Threadly under the terms of `LICENSE`.
> Fill in the bracketed values before handing it over, and have both parties
> review the LICENSE together with counsel.

## 1. What this deal includes

| Item | You (Buyer) receive |
|---|---|
| **Source code** | The complete Threadly codebase (frontend, server, SQL) plus all docs, delivered as `release/threadly-delivery.tar.gz` or a git repository. |
| **License** | A perpetual, non-transferable license to use and modify Threadly for your own business (see `LICENSE`). You may not resell or redistribute the source. |
| **A running app** | A hosted instance operated by the Seller — your team just signs in. |
| **Support** | Help from the Seller as described in Section 6. |

You own your **data**. You own the **code** under the license. The Seller
**operates** the infrastructure that keeps the hosted instance running.

## 2. What the Seller operates (and you don't have to)

| Service | What it does | Operated by |
|---|---|---|
| **Render** | Hosts the web app + API; deploys new code | Seller |
| **Supabase** | Database, user accounts, photo storage, backups | Seller |
| **eBay developer app** | The API keys that power the eBay integration | Seller |
| **OpenAI key** *(optional)* | Powers Ask Threadly if no user brings their own key | Seller |

The browser never holds any of these secrets. You do not need to create or
manage any of these accounts to use the app.

## 3. Day one: getting your team in

1. Open the app URL provided by the Seller.
2. Click **Create an account** and sign up with your email.
3. On onboarding, choose **Start with demo data** to explore, or **Start empty**.
4. Invite your team: each person creates their own account — every user's data
   is isolated automatically, so teammates only see their own inventory.
5. **Connect eBay** (optional but recommended): Marketplace connections → eBay →
   **Connect with eBay** → approve on eBay's page. One click, done. From any
   item, use **Marketplace status → Publish to eBay** (the item needs at least
   one photo), then **Sync now** to pull live status and recent orders.

## 4. AI (Ask Threadly)

Two options, per user:

- **Bring your own OpenAI key** — Settings → Ask Threadly. You pay OpenAI
  directly, per use; nothing is billed through the Seller.
- **Use the Seller's key** — if the Seller has configured one, it's used as a
  fallback. Usage is rate-limited per user and per instance to keep costs
  predictable.

## 5. Costs & billing

The Seller bundles the underlying services plus support into one monthly price.
Underlying third-party costs (what the Seller pays to run it):

| Service | Plan | Cost |
|---|---|---|
| Supabase | Pro (no pausing + daily backups) | $25/mo |
| Render | Starter (stays warm, no cold starts) | ~$7/mo |
| OpenAI | pay-per-use (`gpt-4o-mini` by default) | $0–few $/mo |
| eBay developer app | Free | $0 |

Your monthly price to the Seller: **[ $____ / month ]**
- Includes: hosting, backups, and the support in Section 6.
- Excludes: OpenAI usage on your own keys (billed by OpenAI directly) and any
  custom feature development (see Section 6).

## 6. Support model

- **Contact:** the in-app footer and Settings → *Need help?* link to
  `src/lib/brand.ts` → `SUPPORT_EMAIL`. Replace that one constant to update it.
- **Covered at no extra cost:** setup help, connecting eBay, account issues,
  bug reports, and questions about using the app.
- **Response target:** [ e.g. within 1 business day ].
- **Not covered (separate quote):** new features, design changes, or
  integrations beyond what's documented. The Seller will quote these on request.

## 7. Data ownership, exports & backups

- You own everything your team enters: inventory, sales, expenses, photos, notes.
- **Export anytime:** Settings → Data & export (CSV) and Reports (CSV/PDF).
- **Backups:** Supabase Pro takes automatic daily backups (7-day retention);
  the Seller can also produce a manual backup on request.

## 8. If we ever part ways

You are never locked in:

1. You already have the full source code and a perpetual license.
2. The Seller will, on request, export your team's data (Supabase backup +
   storage export).
3. You (or a developer you hire) can self-host using `README.md` and
   `supabase/SETUP.md` — the same ~30-minute setup the Seller uses.

The only things you'd recreate yourself to self-host: a Supabase project, a
Render service (or any Node host), and — only if you want eBay/AI — your own
eBay developer app and OpenAI key. Every step is documented.

## 9. Quick reference

| Question | Where |
|---|---|
| What is Threadly / tech stack | `README.md` |
| Set up Supabase from scratch | `supabase/SETUP.md` |
| Google sign-in + security model | `supabase/AUTH_SETUP.md` |
| Enable the eBay integration (owner side) | `EBAY_SETUP.md` |
| License terms | `LICENSE` |
| Brand name / support address | `src/lib/brand.ts` |

---

*Seller:* ____________________  *Buyer:* ____________________  *Date:* ____________
