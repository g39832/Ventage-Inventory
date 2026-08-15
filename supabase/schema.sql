-- ============================================================
-- Ventage — Phase 2 schema (auth + multi-user RLS)
-- Run this in the Supabase SQL editor. It is idempotent: safe to
-- run on a fresh database OR on top of the Phase 1 schema.
--
-- Phase 2 changes:
--  * `users` is now the app profile table, keyed 1:1 to
--    auth.users(id) and populated by an auth trigger.
--  * A `set_owner_id()` trigger stamps owner_id = auth.uid() on
--    every insert, so the client can never assign a record to
--    another user (RLS with-check is the backstop).
--  * RLS policies now scope EVERY user-owned table to
--    owner_id = auth.uid(). The Phase 1 open anon policies are
--    dropped. Child tables (photos/listings/events) are scoped
--    through their parent inventory item.
--  * app_settings is keyed by owner_id; marketplace_connections
--    by (owner_id, marketplace_id).
--
-- Design notes carried from Phase 1:
--  * Money is NUMERIC(12,2) everywhere — never FLOAT/DOUBLE.
--  * Inventory items use SOFT DELETE via deleted_at.
-- ============================================================

-- ------------------------------------------------------------
-- Updated-at trigger (shared)
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- users — app profile, 1:1 with auth.users
-- ------------------------------------------------------------
create table if not exists users (
  id uuid primary key,
  email text,
  display_name text,
  avatar_url text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Phase 1 → Phase 2: profile ids must reference auth.users.
-- (Idempotent: on a fresh table the FK is created inline above.)
alter table users alter column id drop default;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_id_fkey' and conrelid = 'users'::regclass
  ) then
    alter table users
      add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;
alter table users add column if not exists avatar_url text;
alter table users add column if not exists onboarded boolean not null default false;

-- Create/sync the profile whenever an auth user is created/updated.
-- SECURITY DEFINER so the auth-admin role can write the profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
    set email        = excluded.email,
        display_name = coalesce(excluded.display_name, users.display_name),
        avatar_url   = coalesce(excluded.avatar_url, users.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
    set email        = new.email,
        display_name = coalesce(
          new.raw_user_meta_data ->> 'display_name',
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          users.display_name
        ),
        avatar_url   = coalesce(
          new.raw_user_meta_data ->> 'avatar_url',
          new.raw_user_meta_data ->> 'picture',
          users.avatar_url
        )
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.sync_auth_user();

-- ------------------------------------------------------------
-- set_owner_id — stamp ownership from the JWT on every insert.
-- Runs BEFORE the RLS with-check, so a client-supplied owner_id
-- is always overridden with the authenticated user's id.
-- ------------------------------------------------------------
create or replace function public.set_owner_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.owner_id = auth.uid();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- marketplaces — static reference data (ids match the app)
-- ------------------------------------------------------------
create table if not exists marketplaces (
  id text primary key, -- 'ebay' | 'depop' | 'poshmark' | 'vinted' | 'mercari' | 'facebook'
  name text not null,
  tagline text not null default '',
  integration text not null default 'manual' check (integration in ('official', 'manual')),
  sort_order integer not null default 0
);

-- Canonical reference rows (shared, read-only for users). Seeded here so the
-- app never needs write access to this table. Idempotent: safe to re-run.
insert into marketplaces (id, name, tagline, integration, sort_order) values
  ('ebay',     'eBay',                'Your biggest channel — synced automatically.', 'official', 1),
  ('depop',    'Depop',               'Core reseller channel, tracked manually for now.', 'manual', 2),
  ('poshmark', 'Poshmark',            'Great for bundles and higher-priced pieces.', 'manual', 3),
  ('vinted',   'Vinted',              'Fast turnaround on basics and tees.', 'manual', 4),
  ('mercari',  'Mercari',             'Not connected yet — add when you start selling there.', 'manual', 5),
  ('facebook', 'Facebook Marketplace', 'Great for local pickup on larger items.', 'manual', 6)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- marketplace_connections — per-user connection state
-- ------------------------------------------------------------
create table if not exists marketplace_connections (
  owner_id uuid references users(id) on delete cascade,
  marketplace_id text not null references marketplaces(id) on delete cascade,
  status text not null default 'not-connected'
    check (status in ('connected', 'manual', 'not-connected')),
  account text,
  sync_type text not null default 'manual' check (sync_type in ('auto', 'manual')),
  note text not null default '',
  last_sync timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, marketplace_id)
);

-- Phase 1 → Phase 2: key becomes (owner_id, marketplace_id).
-- Guard: only migrate when the old single-column PK is present.
do $$
begin
  if exists (
    select 1 from pg_constraint c
    where c.conname = 'marketplace_connections_pkey'
      and c.conrelid = 'marketplace_connections'::regclass
      and pg_get_constraintdef(c.oid) not like '%owner_id%'
  ) then
    alter table marketplace_connections drop constraint marketplace_connections_pkey;
    alter table marketplace_connections add primary key (owner_id, marketplace_id);
  end if;
end $$;

drop trigger if exists marketplace_connections_set_updated_at on marketplace_connections;
create trigger marketplace_connections_set_updated_at
  before update on marketplace_connections
  for each row execute function set_updated_at();

drop trigger if exists marketplace_connections_set_owner on marketplace_connections;
create trigger marketplace_connections_set_owner
  before insert on marketplace_connections
  for each row execute function public.set_owner_id();

-- ------------------------------------------------------------
-- inventory_items — the core catalog (soft-deleted via deleted_at)
-- ------------------------------------------------------------
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  sku text,
  name text not null,
  description text,
  brand text,
  category text,
  size text,
  era text,
  color text,
  condition text,
  purchase_price numeric(12, 2) not null default 0,
  listing_price numeric(12, 2) not null default 0,
  quantity integer not null default 1,
  status text not null default 'draft'
    check (status in ('listed', 'draft', 'sold', 'unlisted')),
  acquired_date date not null default current_date,
  listed_date date,
  notes text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists inventory_items_sku_unique
  on inventory_items (sku) where deleted_at is null;
create index if not exists inventory_items_status_idx on inventory_items (status) where deleted_at is null;
create index if not exists inventory_items_category_idx on inventory_items (category) where deleted_at is null;

drop trigger if exists inventory_items_set_updated_at on inventory_items;
create trigger inventory_items_set_updated_at
  before update on inventory_items
  for each row execute function set_updated_at();

drop trigger if exists inventory_items_set_owner on inventory_items;
create trigger inventory_items_set_owner
  before insert on inventory_items
  for each row execute function public.set_owner_id();

-- ------------------------------------------------------------
-- inventory_photos — real uploads land here in Phase 3
-- ------------------------------------------------------------
create table if not exists inventory_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists inventory_photos_item_idx on inventory_photos (item_id);

-- ------------------------------------------------------------
-- marketplace_listings — which marketplaces an item is on
-- ------------------------------------------------------------
create table if not exists marketplace_listings (
  item_id uuid not null references inventory_items(id) on delete cascade,
  marketplace_id text not null references marketplaces(id) on delete cascade,
  status text not null default 'none'
    check (status in ('live', 'sold', 'none')),
  price numeric(12, 2),
  listing_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, marketplace_id)
);

drop trigger if exists marketplace_listings_set_updated_at on marketplace_listings;
create trigger marketplace_listings_set_updated_at
  before update on marketplace_listings
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- sales — every sale across every channel
-- ------------------------------------------------------------
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  item_id uuid references inventory_items(id) on delete set null,
  item_name text not null,
  marketplace_id text not null references marketplaces(id),
  sold_date date not null default current_date,
  sold_price numeric(12, 2) not null default 0,
  fees numeric(12, 2) not null default 0,
  shipping_cost numeric(12, 2) not null default 0,
  payout numeric(12, 2) not null default 0,
  profit numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_sold_date_idx on sales (sold_date);
create index if not exists sales_item_idx on sales (item_id);

drop trigger if exists sales_set_updated_at on sales;
create trigger sales_set_updated_at
  before update on sales
  for each row execute function set_updated_at();

drop trigger if exists sales_set_owner on sales;
create trigger sales_set_owner
  before insert on sales
  for each row execute function public.set_owner_id();

-- ------------------------------------------------------------
-- expenses
-- ------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  item_id uuid references inventory_items(id) on delete set null,
  category text not null,
  description text not null default '',
  amount numeric(12, 2) not null default 0,
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on expenses (date);

drop trigger if exists expenses_set_updated_at on expenses;
create trigger expenses_set_updated_at
  before update on expenses
  for each row execute function set_updated_at();

drop trigger if exists expenses_set_owner on expenses;
create trigger expenses_set_owner
  before insert on expenses
  for each row execute function public.set_owner_id();

-- ------------------------------------------------------------
-- inventory_events — item activity/history (the timeline)
-- ------------------------------------------------------------
create table if not exists inventory_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  kind text not null default 'note'
    check (kind in ('acquired', 'listed', 'price', 'sold', 'note', 'expense')),
  title text not null,
  description text,
  occurred_at timestamptz not null default now()
);

create index if not exists inventory_events_item_idx on inventory_events (item_id);

-- ------------------------------------------------------------
-- tasks — dashboard to-dos
-- ------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  title text not null,
  due date,
  kind text not null default 'general'
    check (kind in ('listing', 'shipping', 'photo', 'sourcing', 'general')),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

drop trigger if exists tasks_set_owner on tasks;
create trigger tasks_set_owner
  before insert on tasks
  for each row execute function public.set_owner_id();

-- ------------------------------------------------------------
-- app_settings — per-user JSON settings bag
-- ------------------------------------------------------------
create table if not exists app_settings (
  owner_id uuid primary key references users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  shop jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  -- Bring-your-own-key for Ask Ventage: { openaiKey } stored per user.
  ai jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Upgrade for existing databases: adds the per-user AI settings column.
alter table app_settings add column if not exists ai jsonb not null default '{}'::jsonb;

-- Phase 1 → Phase 2: key becomes owner_id (was a single-row `id = 1`).
do $$
begin
  if exists (
    select 1 from pg_constraint c
    where c.conname = 'app_settings_pkey'
      and c.conrelid = 'app_settings'::regclass
      and pg_get_constraintdef(c.oid) like '%(id)%'
  ) then
    alter table app_settings drop constraint app_settings_pkey;
    alter table app_settings drop constraint if exists app_settings_id_check;
    alter table app_settings drop column if exists id;
    alter table app_settings add column if not exists owner_id uuid references users(id) on delete cascade;
    alter table app_settings add primary key (owner_id);
  end if;
end $$;

drop trigger if exists app_settings_set_updated_at on app_settings;
create trigger app_settings_set_updated_at
  before update on app_settings
  for each row execute function set_updated_at();

drop trigger if exists app_settings_set_owner on app_settings;
create trigger app_settings_set_owner
  before insert on app_settings
  for each row execute function public.set_owner_id();

-- ------------------------------------------------------------
-- ebay_tokens — per-user eBay OAuth tokens (server-side only)
-- ------------------------------------------------------------
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
  -- Default eBay category id used when publishing items (15687 = Men's T-Shirts, US).
  category_id text not null default '15687',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ebay_tokens_set_updated_at on ebay_tokens;
create trigger ebay_tokens_set_updated_at
  before update on ebay_tokens
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- ------------------------------------------------------------
-- Phase 2: every user-owned table is scoped to auth.uid().
-- The Phase 1 open anon policy is dropped. Child tables without
-- an owner_id (photos, listings, events) are scoped through
-- their parent inventory item, so a user can only touch rows
-- that belong to items they own.
-- ============================================================

-- Drop the Phase 1 open policy everywhere it exists.
do $$
declare
  t text;
begin
  foreach t in array array[
    'marketplace_connections',
    'inventory_items',
    'inventory_photos',
    'marketplace_listings',
    'sales',
    'expenses',
    'inventory_events',
    'tasks',
    'app_settings'
  ]
  loop
    execute format('drop policy if exists "phase1 anon access" on %I;', t);
  end loop;
end $$;

-- ── users: a user can read/update only their own profile row ──
alter table users enable row level security;
drop policy if exists "users_select_own" on users;
create policy "users_select_own" on users
  for select using (id = auth.uid());

drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── marketplaces: static reference data (read-only for users) ──
-- Seeded by the INSERT above (and supabase/seed.sql for dev). Users can only
-- read: no insert/update/delete policies exist, so a signed-in user can never
-- add, rename, or remove marketplace rows for everyone else.
alter table marketplaces enable row level security;
drop policy if exists "marketplaces_read" on marketplaces;
create policy "marketplaces_read" on marketplaces
  for select to authenticated using (true);

drop policy if exists "marketplaces_insert" on marketplaces;
drop policy if exists "marketplaces_update" on marketplaces;
drop policy if exists "marketplaces_delete" on marketplaces;

-- ── marketplace_connections ──
alter table marketplace_connections enable row level security;
drop policy if exists "connections_select_own" on marketplace_connections;
create policy "connections_select_own" on marketplace_connections
  for select using (owner_id = auth.uid());

drop policy if exists "connections_insert_own" on marketplace_connections;
create policy "connections_insert_own" on marketplace_connections
  for insert with check (owner_id = auth.uid());

drop policy if exists "connections_update_own" on marketplace_connections;
create policy "connections_update_own" on marketplace_connections
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "connections_delete_own" on marketplace_connections;
create policy "connections_delete_own" on marketplace_connections
  for delete using (owner_id = auth.uid());

-- ── inventory_items ──
alter table inventory_items enable row level security;
drop policy if exists "items_select_own" on inventory_items;
create policy "items_select_own" on inventory_items
  for select using (owner_id = auth.uid());

drop policy if exists "items_insert_own" on inventory_items;
create policy "items_insert_own" on inventory_items
  for insert with check (owner_id = auth.uid());

drop policy if exists "items_update_own" on inventory_items;
create policy "items_update_own" on inventory_items
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "items_delete_own" on inventory_items;
create policy "items_delete_own" on inventory_items
  for delete using (owner_id = auth.uid());

-- ── inventory_photos: scoped through the owning item ──
alter table inventory_photos enable row level security;
drop policy if exists "photos_via_item" on inventory_photos;
create policy "photos_via_item" on inventory_photos
  for all
  using (
    exists (
      select 1 from inventory_items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from inventory_items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  );

-- ── marketplace_listings: scoped through the owning item ──
alter table marketplace_listings enable row level security;
drop policy if exists "listings_via_item" on marketplace_listings;
create policy "listings_via_item" on marketplace_listings
  for all
  using (
    exists (
      select 1 from inventory_items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from inventory_items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  );

-- ── inventory_events: scoped through the owning item ──
alter table inventory_events enable row level security;
drop policy if exists "events_via_item" on inventory_events;
create policy "events_via_item" on inventory_events
  for all
  using (
    exists (
      select 1 from inventory_items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from inventory_items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  );

-- ── sales: owned + can't point at another user's item ──
alter table sales enable row level security;
drop policy if exists "sales_select_own" on sales;
create policy "sales_select_own" on sales
  for select using (owner_id = auth.uid());

drop policy if exists "sales_insert_own" on sales;
create policy "sales_insert_own" on sales
  for insert with check (
    owner_id = auth.uid()
    and (
      item_id is null
      or exists (
        select 1 from inventory_items i
        where i.id = item_id and i.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "sales_update_own" on sales;
create policy "sales_update_own" on sales
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      item_id is null
      or exists (
        select 1 from inventory_items i
        where i.id = item_id and i.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "sales_delete_own" on sales;
create policy "sales_delete_own" on sales
  for delete using (owner_id = auth.uid());

-- ── expenses: owned + can't point at another user's item ──
alter table expenses enable row level security;
drop policy if exists "expenses_select_own" on expenses;
create policy "expenses_select_own" on expenses
  for select using (owner_id = auth.uid());

drop policy if exists "expenses_insert_own" on expenses;
create policy "expenses_insert_own" on expenses
  for insert with check (
    owner_id = auth.uid()
    and (
      item_id is null
      or exists (
        select 1 from inventory_items i
        where i.id = item_id and i.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "expenses_update_own" on expenses;
create policy "expenses_update_own" on expenses
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      item_id is null
      or exists (
        select 1 from inventory_items i
        where i.id = item_id and i.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "expenses_delete_own" on expenses;
create policy "expenses_delete_own" on expenses
  for delete using (owner_id = auth.uid());

-- ── tasks ──
alter table tasks enable row level security;
drop policy if exists "tasks_select_own" on tasks;
create policy "tasks_select_own" on tasks
  for select using (owner_id = auth.uid());

drop policy if exists "tasks_insert_own" on tasks;
create policy "tasks_insert_own" on tasks
  for insert with check (owner_id = auth.uid());

drop policy if exists "tasks_update_own" on tasks;
create policy "tasks_update_own" on tasks
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "tasks_delete_own" on tasks;
create policy "tasks_delete_own" on tasks
  for delete using (owner_id = auth.uid());

-- ── app_settings ──
alter table app_settings enable row level security;
drop policy if exists "settings_select_own" on app_settings;
create policy "settings_select_own" on app_settings
  for select using (owner_id = auth.uid());

drop policy if exists "settings_insert_own" on app_settings;
create policy "settings_insert_own" on app_settings
  for insert with check (owner_id = auth.uid());

drop policy if exists "settings_update_own" on app_settings;
create policy "settings_update_own" on app_settings
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "settings_delete_own" on app_settings;
create policy "settings_delete_own" on app_settings
  for delete using (owner_id = auth.uid());

-- ── ebay_tokens ──
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

-- ============================================================
-- Grants
-- ------------------------------------------------------------
-- Only the public anon/publishable key is used in the browser;
-- PostgREST runs queries as `anon` (no session) or
-- `authenticated` (valid JWT). RLS does the real filtering.
-- ============================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
