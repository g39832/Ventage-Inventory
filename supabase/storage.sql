-- ============================================================
-- Ventage — Phase 3: Supabase Storage
-- Run this in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Creates two PUBLIC buckets:
--   * item-photos  → item-photos/<item_id>/<file>
--   * avatars      → avatars/<user_id>/<file>
--
-- Security model:
--   * Reads: any signed-in user can read their own files; anonymous reads are
--     allowed for these buckets because listing/avatar images are served from
--     plain <img> tags (no auth header) and are, by nature, public-facing
--     content. File paths include UUIDs, so URLs aren't guessable.
--   * Writes (upload / update / delete): strictly owner-scoped through the
--     folder path — item-photos folders must belong to an item the user owns,
--     avatar folders must be the user's own id. RLS is the boundary, not the
--     client.
-- ============================================================

-- ── Buckets ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('item-photos', 'item-photos', true),
  ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- ── Grants (defensive; default Supabase projects already grant these) ──
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;

-- ── Reads ──────────────────────────────────────────────────────
-- Owner read (authenticated): item photos whose folder belongs to an owned item.
drop policy if exists "item-photos: owner read" on storage.objects;
create policy "item-photos: owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'item-photos'
    and exists (
      select 1 from public.inventory_items i
      where i.id::text = (storage.foldername(name))[1]
        and i.owner_id = auth.uid()
    )
  );

-- Anonymous read for public <img> serving (no auth header is sent by <img>).
drop policy if exists "item-photos: public read" on storage.objects;
create policy "item-photos: public read" on storage.objects
  for select to anon
  using (bucket_id = 'item-photos');

-- Owner read (authenticated): avatars in the user's own folder.
drop policy if exists "avatars: owner read" on storage.objects;
create policy "avatars: owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects
  for select to anon
  using (bucket_id = 'avatars');

-- ── Writes: upload ─────────────────────────────────────────────
drop policy if exists "item-photos: owner insert" on storage.objects;
create policy "item-photos: owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'item-photos'
    and exists (
      select 1 from public.inventory_items i
      where i.id::text = (storage.foldername(name))[1]
        and i.owner_id = auth.uid()
    )
  );

drop policy if exists "avatars: owner insert" on storage.objects;
create policy "avatars: owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Writes: update ─────────────────────────────────────────────
drop policy if exists "item-photos: owner update" on storage.objects;
create policy "item-photos: owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'item-photos'
    and exists (
      select 1 from public.inventory_items i
      where i.id::text = (storage.foldername(name))[1]
        and i.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'item-photos'
    and exists (
      select 1 from public.inventory_items i
      where i.id::text = (storage.foldername(name))[1]
        and i.owner_id = auth.uid()
    )
  );

drop policy if exists "avatars: owner update" on storage.objects;
create policy "avatars: owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Writes: delete ─────────────────────────────────────────────
drop policy if exists "item-photos: owner delete" on storage.objects;
create policy "item-photos: owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'item-photos'
    and exists (
      select 1 from public.inventory_items i
      where i.id::text = (storage.foldername(name))[1]
        and i.owner_id = auth.uid()
    )
  );

drop policy if exists "avatars: owner delete" on storage.objects;
create policy "avatars: owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
