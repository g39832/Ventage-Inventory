# Ventage — eBay Integration Setup

This turns on the **real eBay integration**: users connect their eBay account, publish
items straight from inventory, and pull their live listings and recent orders.

**How it works**

- The browser never touches eBay. A user clicks "Connect with eBay" → approves on eBay →
  the app stores their OAuth tokens (server-side, per-user) → "Publish to eBay" sends the
  item's details + photos to eBay's Sell API.
- It's the only marketplace in Ventage with a real API. Depop, Poshmark, Vinted, Mercari,
  and Facebook Marketplace don't offer third-party listing APIs, so they stay manual
  tracking by design.

**What you need (one-time, ~15 minutes, free)**

1. An eBay developer account → [developer.ebay.com](https://developer.ebay.com)
2. A **production** application (sandbox keys are only for testing)
3. Three environment variables on your server: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`,
   `EBAY_REDIRECT_URI`

---

## 1. Create the eBay developer app

1. Go to [developer.ebay.com](https://developer.ebay.com) and sign in with an eBay account.
2. **Your apps → Create an application**.
   - *Application name:* anything (e.g. "Ventage Inventory").
   - *Application description:* anything.
   - *API to use:* **Sell APIs** (this grants the listing/policy/order scopes).
3. After creation, open the app → **Keys** tab:
   - **OAuth Public Key** → the **Client ID** (`EBAY_CLIENT_ID`).
   - **Client Secret** → the **Client Secret** (`EBAY_CLIENT_SECRET`). Keep it secret.
4. Open the **App Settings / Redirect URI** section and add your redirect URI:
   - Production: `https://<your-app-domain>/ebay/callback`
   - Local dev: `http://localhost:5173/ebay/callback`
   - This must match `EBAY_REDIRECT_URI` **exactly** (trailing slashes matter).
5. **Request production access** (User Tokens → Production): fill in your app's usage
   description and submit. Approval is usually quick; until approved, only sandbox works.

> The app needs **User Token** (OAuth authorization code grant) access — not Client
> Credentials. The connect button in Ventage handles the whole flow.

## 2. Set the environment variables

In your `.env.local` (dev) or Render dashboard (production):

```
EBAY_CLIENT_ID=<your-client-id>
EBAY_CLIENT_SECRET=<your-client-secret>
EBAY_REDIRECT_URI=https://your-app.com/ebay/callback
# EBAY_SANDBOX=true   ← only while testing with sandbox keys
```

Restart the server. On startup it logs a warning if the keys are missing.

## 3. Run the database migration

The integration stores per-user tokens in a new `ebay_tokens` table:

1. Supabase → **SQL Editor**.
2. Paste `supabase/ebay.sql` and run it.
   (If you're on a fresh database that already ran `supabase/schema.sql`, you can skip this
   — schema.sql already includes the table.)

## 4. Test (recommended: sandbox first)

> For the complete step-by-step sandbox test — connect, publish, sync, unlist,
> re-publish, and every error path with pass/fail checks — see `EBAY_TESTING.md`.
> The abbreviated walkthrough below is the quick version.

1. In `developer.ebay.com → Your apps`, create a **sandbox** test app and use its keys +
   `EBAY_SANDBOX=true` in your env.
2. Create a sandbox test user (Sandbox → Test accounts) and sign in as them on eBay.
3. Sign into Ventage → **Marketplace connections** → eBay → **Connect with eBay**.
4. Publish an item from its **Marketplace status** tab (the item needs at least one photo).
5. Confirm the listing appears in the eBay sandbox seller hub, then run **Sync now** and
   check the live count updates.
6. When it all works, switch to your production keys and set `EBAY_SANDBOX` to `false`
   (or remove it).

## 5. How publishing works (defaults you should know)

When a user publishes an item, Ventage:

- Uses the item's **SKU** as the eBay SKU (auto-generated `VN-XXXXXX` if empty).
- Maps the app's condition text to an eBay condition (new → `NEW`, excellent → `LIKE_NEW`,
  etc.).
- Creates one-time **listing policies** per user on first publish (payment: managed
  payments; returns: 30-day buyer pays return shipping; fulfillment: USPS Priority, $8).
  These are the app's sensible defaults — users manage them on eBay's side later.
- Publishes into the **category ID** in Marketplace → eBay → **Manage** (default `15687`,
  Men's T-Shirts). Users can change it; find the right numeric ID via eBay's own listing
  flow.

**Notes / limits**

- Re-publishing an item updates the same eBay SKU (idempotent) and reuses the live offer
  if one exists.
- "Sync now" reads eBay's live inventory for your SKUs and pulls orders from the last 30
  days. It reports sold quantities — it does **not** auto-create sales rows (fee amounts
  are only known after payout, so sales stay a manual, accurate step).
- Photos are required before publishing (eBay listings need images).
- OAuth tokens are stored in the `ebay_tokens` table, protected by row-level security —
  only the owner (or a server call acting as them) can read them.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "eBay isn't configured on this app yet" | Set `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` / `EBAY_REDIRECT_URI` and restart the server. |
| "Your eBay connection expired" | The refresh token needs a fresh OAuth — disconnect and reconnect eBay in Marketplace connections. |
| "Invalid redirect URI" | The value in `EBAY_REDIRECT_URI` must match the redirect URI registered in the eBay developer app exactly. |
| "Add at least one photo" | Publish requires real photos — upload them on the item's Photos tab first. |
| Publish works in sandbox but not production | Your production eBay app needs approved **production access** in the developer portal. |
