# Regroove — eBay Sandbox Test Script

> Run this end-to-end against **eBay's sandbox** before relying on the eBay
> integration in production (and before requesting production access, if you
> haven't already). It exercises the full flow: **connect → publish → sync →
> unlist → re-publish → error paths**. Every step names the endpoint it hits
> and what success looks like, so a failure is quick to isolate.

**Time:** ~45 minutes. **Cost:** $0.

---

## 0. What this proves (map to the code)

| # | Test | Endpoint / code | Pass means |
|---|------|-----------------|------------|
| 1 | Server sees the keys | `server/env.ts`, startup log | No "eBay keys are not set" warning; `/status` says `configured: true` |
| 2 | OAuth connect | `GET /api/marketplaces/ebay/auth/start` → eBay → `POST /complete` (`oauth.ts`, `tokens.ts`) | Tokens saved per-user; connection says Connected |
| 3 | Publish | `POST /api/marketplaces/ebay/list` (`router.ts`, `api.ts`) | Listing live in the sandbox seller hub; `marketplace_listings` row + timeline event written |
| 4 | Sync | `POST /api/marketplaces/ebay/sync` | Live count matches; order pull returns rows when you've sold something |
| 5 | Unlist | `POST /api/marketplaces/ebay/unlist` | Listing ended on eBay; local row set to `none` |
| 6 | Re-publish | `POST /api/marketplaces/ebay/list` again | Same SKU → same offer reused (idempotent), no duplicate listing |
| 7 | Error paths | various | Clean user-safe errors (no photo, no keys, expired token) |

---

## 1. Prerequisites (~20 minutes)

1. **eBay developer account** at [developer.ebay.com](https://developer.ebay.com).
2. **A sandbox app** with its own keys: *Your apps → Create an application* →
   pick the **sandbox** application. Copy the **OAuth Public Key (Client ID)**
   and **Client Secret** from its Keys tab.
3. **Register the redirect URI** in that sandbox app's settings. It must match
   `EBAY_REDIRECT_URI` **exactly** (trailing slashes matter):
   - Local dev: `http://localhost:5173/ebay/callback`
4. **Two sandbox test accounts** (optional, only needed for the order test):
   *Your apps → Sandbox → Test accounts* → create them and note their
   usernames/passwords. They are **not** normal eBay logins — you sign into the
   sandbox site with these.
5. **The app running locally** with sandbox env (see step 2).
6. **A freshly-onboarded account** with at least one item that has a photo
   (create the item with a photo before testing).

> Production keys are **not** needed for this test. `EBAY_SANDBOX=true` keeps
> every call on the sandbox API (`api.sandbox.ebay.com`).

---

## 2. Configure and start

`.env.local` (same file Vite and the server read):

```dotenv
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

EBAY_CLIENT_ID=<sandbox-app-client-id>
EBAY_CLIENT_SECRET=<sandbox-app-client-secret>
EBAY_REDIRECT_URI=http://localhost:5173/ebay/callback
EBAY_SANDBOX=true
```

Restart both processes:

```bash
npm run dev          # frontend  → http://localhost:5173
npm run dev:server   # API      → http://localhost:8787 (Vite proxies /api)
```

**Test 1 — the server sees the keys.** The `dev:server` log must **not** print
`[warn] eBay keys are not set`. In the app, open **Marketplace connections** —
the eBay card should show **Connect with eBay** enabled (not "Needs owner
setup"). Optionally confirm via the API (see step 9 for how to grab a token):

```bash
curl -s http://localhost:8787/api/marketplaces/ebay/status \
  -H "Authorization: Bearer <supabase-access-token>"
# → {"configured":true,"connected":false,"username":null}
```

---

## 3. Test 2 — Connect with eBay (the full OAuth round-trip)

1. On the **Marketplace** page, eBay card → **Connect with eBay**.
2. The browser leaves the app for eBay. **Sign in with your sandbox test
   account** (NOT your normal eBay login) and **approve** the scopes.
3. You're redirected back to `/ebay/callback` → then to
   `/marketplace?ebay=connected` with a "eBay connected" toast.

**Verify:**
- The eBay card now shows **Connected** with your sandbox username.
- `curl .../status` → `{"configured":true,"connected":true,"username":"<sandbox-username>"}`.
- In Supabase **SQL Editor**:
  ```sql
  select owner_id, ebay_username, expires_at is not null as has_expiry,
         category_id from ebay_tokens;
  ```
  One row, your user id, a username, and `has_expiry = true`. The browser
  never saw the tokens — they live in this table only (RLS-protected).

**If it fails:**
- "Invalid redirect URI" → the URI in the eBay app settings ≠ `EBAY_REDIRECT_URI` exactly.
- "That eBay link was invalid or expired" → `state` expired (10 min) or the
  signed-in user differs from the one who started the flow. Retry.
- Login loop on eBay → you're using a normal eBay account; use the sandbox
  test account.

---

## 4. Test 3 — Publish an item

1. Open an **inventory item that has at least one photo**.
2. **Marketplace status** tab → **Publish to eBay**.

**Verify (three places):**

- **The app:** a success toast with the eBay listing id; the item's eBay
  status flips to **Live**; a "Listed on eBay" entry appears in the item's
  timeline.
- **The database:**
  ```sql
  select i.sku, l.status, l.price, l.listing_id
  from marketplace_listings l
  join inventory_items i on i.id = l.item_id
  where l.marketplace_id = 'ebay';
  ```
  One row: `status = 'live'`, a `listing_id` like `v1|...|...`.
- **On eBay's side:** sign into the **sandbox site** (www.sandbox.ebay.com)
  with the same test account → **My eBay → Selling** (or the seller hub). The
  item is there with your title, price, photos, and condition.

> First publish also auto-creates the user's listing policies on eBay
> (payment: managed payments; returns: 30-day; fulfillment: USPS Priority $8).
> The policy ids are stored in `ebay_tokens`.

---

## 5. Test 4 — Sync

On the eBay card → **Sync now**.

**Verify:**
- Toast shows a live-listing count.
- `POST /sync` response (step 9 for the curl) returns:
  ```json
  { "listings": 1, "listed": 1, "soldCount": 0, "recentSales": [], "lastSync": "..." }
  ```
- The card's **Live on eBay** count and **Last sync** update.

**Optional — exercise the order path (needs the 2nd sandbox account):**
1. Sign into the sandbox site as the **other** test account and **buy** your
   listing (the sandbox allows self-purchase for testing).
2. Back in Regroove → **Sync now**. `soldCount` reflects the sold quantity and
   `recentSales` includes the order (SKU, title, quantity, price, date).
3. Sales are **not** auto-created in Regroove by design (fees are only known
   after payout) — the sync reports the sale; you log the final numbers
   manually on the item.

---

## 6. Test 5 — Unlist

On the item's **Marketplace status** tab → **End eBay listing** (or the
unlist action).

**Verify:**
- App: toast confirms removal; item's eBay status flips to not-live.
- DB: the `marketplace_listings` row for that item → `status = 'none'`,
  `listing_id = null`.
- eBay sandbox: the listing is gone from **My eBay → Selling**.

---

## 7. Test 6 — Re-publish (idempotency)

Publish the **same item again** (or after an edit that changes the price).

**Verify:** it succeeds, reuses the existing offer for the item's SKU, and you
**do not** end up with two listings in the sandbox seller hub. The SKU rule:
the item's `sku` (or auto `VN-XXXXXXXX`) is the eBay SKU — publishing the same
SKU updates in place.

---

## 8. Test 7 — Error paths (each should give a clean message)

| Action | Expected error |
|---|---|
| Publish an item with **no photos** | "Add at least one photo to this item before publishing it to eBay." |
| Remove `EBAY_CLIENT_ID`/`SECRET`, restart, try to connect | eBay card shows **Needs owner setup**; API returns the "eBay isn't configured" message |
| Delete the `ebay_tokens` row for the user (SQL), then publish | "Connect your eBay account first (Marketplace connections)." |
| Reconnect with a **wrong-category** id (e.g. `abc`) in eBay → Manage | "The eBay category id must be a number." |
| Hammer **Sync now** >60× in an hour | 429 "You've hit the hourly limit for eBay actions…" |

Also sanity-check auth: `curl /api/marketplaces/ebay/status` **without** a
token → `401` "Sign in to manage marketplace connections."

---

## 9. Optional — drive the API directly (for debugging)

Grab your Supabase session token: in the app, DevTools → **Application →
Local Storage → `sb-<project-ref>-auth-token`** → copy the `access_token`.

```bash
TOKEN="<paste>"
BASE=http://localhost:8787/api/marketplaces/ebay

curl -s $BASE/status -H "Authorization: Bearer $TOKEN"
curl -s -X POST $BASE/sync -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"
curl -s -X POST $BASE/list  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"itemId":"<item-uuid>"}'
curl -s -X POST $BASE/unlist -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"itemId":"<item-uuid>"}'
```

---

## 10. Pass criteria checklist

- [ ] Startup log has no eBay key warning; status says `configured: true`
- [ ] OAuth connect completes with the **sandbox** user and saves tokens per-user
- [ ] Publish creates a live listing visible in the sandbox seller hub
- [ ] Item shows **Live** in Regroove with a listing id + timeline event
- [ ] Sync returns matching `listings`/`listed` counts (and `recentSales` after a test purchase)
- [ ] Unlist ends the listing on eBay and clears the local row
- [ ] Re-publish is idempotent (one listing, not two)
- [ ] All error paths return the friendly messages above
- [ ] Endpoints return 401 without a token

**All 9 checked = the integration is sandbox-verified.** Now either switch
`EBAY_SANDBOX` off with your **production** keys (after eBay approves
production access), or ship with eBay documented as "owner completes the
one-time key setup" — the app is fully functional without it.

---

## 11. Cleaning up

- End any test listings (unlist via the app, or from the sandbox seller hub).
- Remove the test `ebay_tokens` row if you want a clean slate:
  ```sql
  delete from ebay_tokens where owner_id = '<your-user-id>';
  ```
- Remove `EBAY_SANDBOX=true` from `.env.local` when you switch to production.
