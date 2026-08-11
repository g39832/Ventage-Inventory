import { db, requireUserId } from "@/lib/db/client";
import { optimizeAvatar, optimizeImage } from "@/lib/image";
import type { ItemPhoto } from "@/lib/types";

const ITEM_PHOTOS_BUCKET = "item-photos";
const AVATARS_BUCKET = "avatars";

/** The public URL prefix for objects in this project's storage. */
function publicBase(): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/`;
}

/** Strip the public base off a URL to recover the object path (bucket/path). */
function storagePathFromUrl(url: string): { bucket: string; path: string } | null {
  const rest = url.split("/object/public/")[1];
  if (!rest) return null;
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

/* ── Item photos ─────────────────────────────────────────────── */

export async function listPhotos(): Promise<ItemPhoto[]> {
  const client = db();
  const { data, error } = await client
    .from("inventory_photos")
    .select("id, item_id, url, position")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    itemId: r.item_id as string,
    url: r.url as string,
    position: Number(r.position),
  }));
}

/** Optimize, upload to storage, and record an item photo row. */
export async function uploadItemPhoto(
  itemId: string,
  file: File,
  position: number
): Promise<ItemPhoto> {
  const client = db();
  const userId = await requireUserId();
  const blob = await optimizeImage(file);
  // Path is relative to the bucket (supabase-js prefixes the bucket id). The
  // FIRST folder must be the user id: storage RLS policies compare it directly
  // to auth.uid() — subqueries inside storage policies are unreliable, so the
  // item id lives in the second folder and item ownership is enforced when the
  // inventory_photos row is inserted (table RLS).
  const path = `${userId}/${itemId}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await client.storage
    .from(ITEM_PHOTOS_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const url = client.storage.from(ITEM_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;

  const { data, error } = await client
    .from("inventory_photos")
    .insert({ item_id: itemId, url, position })
    .select("id, item_id, url, position")
    .single();
  if (error) {
    // Keep storage tidy: the row failed, so the orphan object shouldn't stay.
    await removeStorageObject(url).catch(() => undefined);
    throw new Error(error.message);
  }
  return {
    id: data.id as string,
    itemId: data.item_id as string,
    url: data.url as string,
    position: Number(data.position),
  };
}

/** Remove a photo row and its storage object. */
export async function deleteItemPhoto(photoId: string, url: string): Promise<void> {
  const client = db();
  await removeStorageObject(url).catch(() => undefined);
  const { error } = await client.from("inventory_photos").delete().eq("id", photoId);
  if (error) throw new Error(error.message);
}

/** Update a photo's gallery position. */
export async function setPhotoPosition(photoId: string, position: number): Promise<void> {
  const client = db();
  const { error } = await client
    .from("inventory_photos")
    .update({ position })
    .eq("id", photoId);
  if (error) throw new Error(error.message);
}

/* ── Avatars ─────────────────────────────────────────────────── */

/** Optimize + upload an avatar for the signed-in user; returns its public URL. */
export async function uploadAvatar(file: File): Promise<string> {
  const client = db();
  const userId = await requireUserId();
  const blob = await optimizeAvatar(file);
  // Path relative to the bucket; first folder must be the user id (see above).
  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error } = await client.storage
    .from(AVATARS_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);

  return client.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ── Shared helpers ──────────────────────────────────────────── */

/** Delete a storage object by its public URL. Best-effort (never fatal). */
export async function removeStorageObject(url: string): Promise<void> {
  const info = storagePathFromUrl(url);
  if (!info) return;
  const client = db();
  await client.storage.from(info.bucket).remove([info.path]);
}

/** True when a URL points at this project's storage (vs a placeholder). */
export function isStoredPhoto(url: string): boolean {
  return url.startsWith(publicBase());
}
