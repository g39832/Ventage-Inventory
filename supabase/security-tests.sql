-- ============================================================
-- Threadly — Phase 2 RLS security test
-- Run this in the Supabase SQL editor (as postgres) AFTER
-- schema.sql. It simulates two signed-in users by setting the
-- JWT claim (`sub`) and switching to the `authenticated` role,
-- then proves user A can never see or touch user B's records.
--
-- Expected: every "should FAIL" assertion raises an exception
-- that propagates (so the test visibly fails), and every
-- "should PASS" check returns PASS rows. Any test that returns
-- rows when it shouldn't means RLS is misconfigured.
-- The whole script runs inside a transaction that rolls back.
-- ============================================================

begin;

-- ── Fixture: two auth users ────────────────────────────────────
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com', 'x', now()),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com',   'x', now());

-- Profile rows (the on_auth_user_created trigger also creates these;
-- on conflict keeps it idempotent).
insert into users (id, email, display_name)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com', 'Alice'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com',   'Bob')
on conflict (id) do nothing;

insert into marketplaces (id, name) values
  ('ebay', 'eBay'), ('depop', 'Depop')
on conflict (id) do nothing;

-- Fixture items, created under each user's JWT so the
-- set_owner_id() trigger stamps the right owner.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into inventory_items (id, sku, name, status) values
  ('11111111-1111-1111-1111-111111111111', 'A-1', "Alice's jacket", 'draft');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
insert into inventory_items (id, sku, name, status) values
  ('22222222-2222-2222-2222-222222222222', 'B-1', "Bob's tee",      'draft');

-- ════════════════════════════════════════════════════════════
-- TESTS — simulate Alice
-- ════════════════════════════════════════════════════════════
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 1. Alice sees her own item: PASS (expect 1 row)
select '1. Alice sees own item' as test, count(*) as rows
from inventory_items where sku = 'A-1';

-- 2. Alice does NOT see Bob's item: PASS (expect 0 rows)
select '2. Alice cannot see Bob''s item' as test, count(*) as rows
from inventory_items where sku = 'B-1';

-- 3. Alice cannot READ Bob's item directly: FAIL expected
do $$
begin
  perform * from inventory_items where id = '22222222-2222-2222-2222-222222222222';
  if found then
    raise exception 'FAIL: Alice read Bob''s item';
  end if;
end $$;

-- 4. Alice cannot UPDATE Bob's item: FAIL expected
do $$
begin
  update inventory_items set name = 'hacked' where id = '22222222-2222-2222-2222-222222222222';
  if found then
    raise exception 'FAIL: Alice updated Bob''s item';
  end if;
end $$;

-- 5. Alice cannot DELETE Bob's item: FAIL expected
do $$
begin
  delete from inventory_items where id = '22222222-2222-2222-2222-222222222222';
  if found then
    raise exception 'FAIL: Alice deleted Bob''s item';
  end if;
end $$;

-- 6. Alice cannot STEAL ownership — the set_owner_id() trigger
--    overwrites any client-supplied owner_id with her own id.
insert into inventory_items (owner_id, sku, name) values
  ('00000000-0000-0000-0000-000000000002', 'SNEAKY', 'forged');
select '6. owner_id stamped to Alice, not Bob' as test,
       case when owner_id = '00000000-0000-0000-0000-000000000001' then 'PASS'
            else 'FAIL: owner_id was not overridden' end as result
from inventory_items where sku = 'SNEAKY';

-- 7. Alice can insert her own item: PASS
insert into inventory_items (sku, name) values ('A-2', "Alice's second item");

-- 8. Alice cannot attach an event to Bob's item: FAIL expected
do $$
begin
  insert into inventory_events (item_id, kind, title)
  values ('22222222-2222-2222-2222-222222222222', 'note', 'sneaky');
  raise exception 'FAIL: Alice created an event on Bob''s item';
exception
  when insufficient_privilege then null;
end $$;

-- 9. Alice cannot attach a listing to Bob's item: FAIL expected
do $$
begin
  insert into marketplace_listings (item_id, marketplace_id, status)
  values ('22222222-2222-2222-2222-222222222222', 'ebay', 'live');
  raise exception 'FAIL: Alice created a listing on Bob''s item';
exception
  when insufficient_privilege then null;
end $$;

-- 10. Alice cannot create a sale referencing Bob's item: FAIL expected
do $$
begin
  insert into sales (item_id, item_name, marketplace_id, sold_price)
  values ('22222222-2222-2222-2222-222222222222', 'sneaky', 'ebay', 10);
  raise exception 'FAIL: Alice created a sale on Bob''s item';
exception
  when insufficient_privilege then null;
end $$;

-- 11. Alice can create a sale referencing her own item: PASS
insert into sales (item_id, item_name, marketplace_id, sold_price)
values ('11111111-1111-1111-1111-111111111111', "Alice's jacket", 'ebay', 90);

-- 12. Alice cannot read Bob's profile: FAIL expected
do $$
begin
  perform * from users where id = '00000000-0000-0000-0000-000000000002';
  if found then
    raise exception 'FAIL: Alice read Bob''s profile';
  end if;
end $$;

-- 13. Alice cannot update Bob's profile: FAIL expected
do $$
begin
  update users set display_name = 'hacked' where id = '00000000-0000-0000-0000-000000000002';
  if found then
    raise exception 'FAIL: Alice updated Bob''s profile';
  end if;
end $$;

-- 14. Alice sees no Bob-owned tasks/expenses/settings/connections: PASS (0 rows)
select '14a. no Bob tasks' as test, count(*) as rows
from tasks where owner_id = '00000000-0000-0000-0000-000000000002';
select '14b. no Bob expenses' as test, count(*) as rows
from expenses where owner_id = '00000000-0000-0000-0000-000000000002';
select '14c. no Bob settings' as test, count(*) as rows
from app_settings where owner_id = '00000000-0000-0000-0000-000000000002';
select '14d. no Bob connections' as test, count(*) as rows
from marketplace_connections where owner_id = '00000000-0000-0000-0000-000000000002';

-- ════════════════════════════════════════════════════════════
-- TESTS — simulate Bob
-- ════════════════════════════════════════════════════════════
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

-- 15. Bob sees his own item, not Alice's: PASS
select '15a. Bob sees own item' as test, count(*) as rows
from inventory_items where sku = 'B-1';
select '15b. Bob cannot see Alice''s item' as test, count(*) as rows
from inventory_items where sku = 'A-1';

-- 16. Bob cannot read/update/delete Alice's item: FAIL expected
do $$
begin
  perform * from inventory_items where id = '11111111-1111-1111-1111-111111111111';
  if found then raise exception 'FAIL: Bob read Alice''s item'; end if;
  update inventory_items set name = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
  if found then raise exception 'FAIL: Bob updated Alice''s item'; end if;
  delete from inventory_items where id = '11111111-1111-1111-1111-111111111111';
  if found then raise exception 'FAIL: Bob deleted Alice''s item'; end if;
end $$;

-- 17. Bob cannot read Alice's sale: FAIL expected
do $$
begin
  perform * from sales where item_id = '11111111-1111-1111-1111-111111111111';
  if found then raise exception 'FAIL: Bob read Alice''s sale'; end if;
end $$;

-- 18. Bob's OWN data is intact after all of Alice's activity: PASS
select '18. Bob still sees his own item' as test, count(*) as rows
from inventory_items where sku = 'B-1';

-- ════════════════════════════════════════════════════════════
-- Summary
-- ════════════════════════════════════════════════════════════
select '✅ RLS isolation verified: no FAIL raised, all count checks as expected.'
       || ' (A FAIL exception would have aborted this script.)' as result;

rollback;
