-- ============================================================
-- Ventage — eBay integration schema
-- Run this in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Adds the `ebay_tokens` table, which stores each user's eBay
-- OAuth tokens (server-side only, never exposed to the browser)
-- plus the integration's per-user defaults.
--
-- Security model:
--   * Tokens are scoped by owner_id and protected by RLS the same
--     way every other user table is — only the owner (or a server
--     call acting as that user) can read them.
--   * The frontend never sees these tokens; the Ventage server
--     reads the user's own row with their session token.
--   * The server refuses to start the eBay flow until the app
--     owner sets EBAY_CLIENT_ID / EBAY_CLIENT_SECRET on the server.
--
-- If you're starting from a fresh database, you can skip this file —
-- schema.sql already includes this table. Run it only to upgrade an
-- existing database that predates the eBay integration.
-- ============================================================

create table if not exists ebay_tokens (
  owner_id uuid primary key references users(id) on delete cascade,
  -- OAuth 2.0 credentials for this user's eBay connection.
  access_token text not null default '',
  refresh_token text not null default '',
  expires_at timestamptz,
  ebay_username text,
  -- Sell Account policy ids (created once per user, reused for listings).
  payment_policy_id text,
  return_policy_id text,
  fulfillment_policy_id text,
  -- Default eBay category id used when publishing items.
  -- Find yours: eBay → Seller Hub → choose a category, or use eBay's
  -- category picker. "15687" = Men's T-Shirts (US).
  category_id text not null default '15687',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ebay_tokens_set_updated_at on ebay_tokens;
create trigger ebay_tokens_set_updated_at
  before update on ebay_tokens
  for each row execute function set_updated_at();

-- ── RLS: owner-only, exactly like every other user table ──
alter table ebay_tokens enable row level security;

drop policy if exists "ebay_tokens_select_own" on ebay_tokens;
create policy "ebay_tokens_select_own" on ebay_tokens
  for select using (owner_id = auth.uid());

drop policy if exists "ebay_tokens_insert_own" on ebay_tokens;
create policy "ebay_tokens_insert_own" on ebay_tokens
  for insert with check (owner_id = auth.uid());

drop policy if exists "ebay_tokens_update_own" on ebay_tokens;
create policy "ebay_tokens_update_own" on ebay_tokens
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "ebay_tokens_delete_own" on ebay_tokens;
create policy "ebay_tokens_delete_own" on ebay_tokens
  for delete using (owner_id = auth.uid());

-- The same grants schema.sql applies to every table.
grant all on table ebay_tokens to anon, authenticated;
