# Threadly — Pre-Sale QA Checklist

> Run this by hand before handing Threadly to a buyer. It's the one-page proof
> that every screen works and every security guarantee holds. Automated checks
> (`npm run typecheck`, `npm run build`, `npm run test:smoke`,
> `supabase/security-tests.sql`) cover the parts they can; this covers the rest.

**Environment:** a production-like Supabase project with `schema.sql`,
`storage.sql`, and (for eBay) `supabase/ebay.sql` applied, plus the app deployed
(or running locally against it).

---

## 1. Setup & deploy

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes (the 500 kB chunk warning is cosmetic, not a failure)
- [ ] `npm run test:smoke` passes (`/health` 200, AI + eBay routes 401 without a token)
- [ ] `supabase/security-tests.sql` runs with no `FAIL` and no exception
- [ ] `/health` returns `{"ok":true}` on the deployed instance
- [ ] Secret scan: no `sk-…`, `service_role`, or private keys anywhere in the repo
- [ ] `.env.local` is gitignored and never in the delivery archive

## 2. Auth

- [ ] Sign up with email + password → confirmation flow works (or auto-confirm as configured)
- [ ] Sign in with the same account
- [ ] Google sign-in (if enabled) completes
- [ ] Forgot password → reset link → new password works
- [ ] Sign out returns to the login screen
- [ ] Terms of Service and Privacy Policy links open from login/signup

## 3. Onboarding

- [ ] New account → onboarding → **Start with demo data** → dashboard is populated
- [ ] New account → **Start empty** → dashboard shows empty state
- [ ] Onboarding can't be skipped (reloading lands back on onboarding until complete)

## 4. Inventory

- [ ] Add an item → appears in the list with correct status/category
- [ ] Edit an item → changes persist after reload
- [ ] Archive an item → it disappears from active lists (soft delete)
- [ ] Add a note and a timeline note → both appear in the item timeline
- [ ] SKU is unique (a duplicate SKU is rejected)
- [ ] Filters/search/status tabs on the Inventory page narrow correctly

## 5. Photos

- [ ] Upload a photo to an item → thumbnail shows; uploads resize (not full-size)
- [ ] Reorder photos → order persists
- [ ] Delete a photo → gone from storage and the item
- [ ] Uploading a >15 MB file is rejected with a friendly message
- [ ] The 12-photos-per-item cap is enforced

## 6. Sales & expenses

- [ ] Log a sale with fees + shipping → payout and profit compute correctly
- [ ] Log a standalone (item-less) sale
- [ ] Log an expense (global and item-linked) → shows in the right places
- [ ] Edit and delete an expense

## 7. Reports & exports

- [ ] All 6 report types generate a CSV that opens in Excel/Sheets
- [ ] All 6 print to PDF (print dialog opens with a clean table)
- [ ] Settings → Data & export: inventory, sales, and expenses CSVs download
- [ ] An item named `=HYPERLINK("...")` exports as text, not a live formula

## 8. Ask Threadly (AI)

- [ ] With a server key set: questions answer from the user's own data
- [ ] Without any key: a friendly "not set up" message (no crash)
- [ ] Bring-your-own key (Settings → AI) is saved, used, and removable
- [ ] Hitting the hourly limit returns the rate-limit message
- [ ] AI never returns another user's data

## 9. Marketplace

- [ ] Manual channels (Depop, Poshmark, etc.) connect/disconnect as manual tracking
- [ ] eBay shows **Connect with eBay** when keys are set, **Needs owner setup** when not
- [ ] eBay full flow (if testing): connect → publish → sync → unlist (see `EBAY_TESTING.md`)
- [ ] Publishing an item with no photo is blocked with a clear message

## 10. Security (the buyer-visible guarantees)

- [ ] Two different accounts see only their own data (verify with an incognito window)
- [ ] Visiting another user's item URL by id shows "not found", not their item
- [ ] The shared Marketplace list renders correctly for every account (reference data intact)
- [ ] A user cannot rename/delete marketplaces (covered by `security-tests.sql`)
- [ ] No console errors exposing keys/tokens; the anon key is the only key in the browser
- [ ] eBay tokens are not present in browser storage (they live in `ebay_tokens` only)

## 11. Cost / abuse safety

- [ ] AI per-user + server-wide rate limits are configured (`.env` or Render)
- [ ] eBay actions are rate-limited (60/hour per user)
- [ ] CORS only allows the app's own origins
- [ ] OpenAI account has a hard monthly budget set (dashboard)
- [ ] Supabase has a storage limit and email confirmation ON (dashboard)

## 12. Performance & polish

- [ ] Dashboard/Inventory/Analytics load without noticeable jank on a normal dataset
- [ ] No obvious broken images, dead links, or console errors while clicking through
- [ ] Mobile (or a narrow window) doesn't break the sidebar/top bar
- [ ] The app name is **Threadly** everywhere (no leftover "Ventage")

## 13. Final sign-off

- [ ] README, LICENSE, BUYER_HANDOVER.md, and the delivery archive all exist and are current
- [ ] Support email is set in `src/lib/brand.ts` (not `support@example.com`)
- [ ] Buyer name/date fields in LICENSE are filled in
- [ ] The `release/threadly-delivery.tar.gz` archive was regenerated from the latest commit

**All boxes checked = ready to hand over.** Anything unchecked is either a bug
to fix or a decision (pricing, support email, eBay keys) still needed from you.
