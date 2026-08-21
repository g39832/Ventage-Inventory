-- ============================================================
-- Ventage — Item research (sold comps) schema
-- ------------------------------------------------------------
-- Adds the `research_history` table for the Research page
-- (item research / sold comps). Fresh installs already get this
-- from supabase/schema.sql — this file is only for databases
-- that predate the research feature. Idempotent: safe to re-run.
--
-- * Rows are inserted by the SERVER only, under the verified
--   user id (never from the browser).
-- * RLS scopes every row to its owner, so user A can never see
--   user B's research history.
-- ============================================================

create table if not exists research_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  query text not null,
  result jsonb not null default '{}'::jsonb,
  searched_at timestamptz not null default now()
);

create index if not exists research_history_owner_idx
  on research_history (owner_id, searched_at desc);

-- Stamp ownership from the JWT on insert (defense in depth).
drop trigger if exists research_history_set_owner on research_history;
create trigger research_history_set_owner
  before insert on research_history
  for each row execute function public.set_owner_id();

-- Row Level Security — owner-scoped, like every other user table.
alter table research_history enable row level security;

drop policy if exists "research_history_select_own" on research_history;
create policy "research_history_select_own" on research_history
  for select using (owner_id = auth.uid());

drop policy if exists "research_history_insert_own" on research_history;
create policy "research_history_insert_own" on research_history
  for insert with check (owner_id = auth.uid());

drop policy if exists "research_history_delete_own" on research_history;
create policy "research_history_delete_own" on research_history
  for delete using (owner_id = auth.uid());

grant all on table research_history to anon, authenticated;
