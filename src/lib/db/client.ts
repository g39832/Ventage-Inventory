import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True once VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set. */
export const isSupabaseConfigured = Boolean(url && anonKey);

const client: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;

/** Returns the Supabase client or throws a friendly, actionable error. */
export function db(): SupabaseClient {
  if (!client) {
    throw new Error("Ventage isn't connected to a Supabase project yet.");
  }
  return client;
}

/** The signed-in user's id, or null when there's no session. */
export async function currentUserId(): Promise<string | null> {
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

/** The signed-in user's id, or a friendly error when signed out. */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error("You need to sign in to do that.");
  return id;
}

/** Map raw errors to messages a reseller can act on (never raw SQL). */
export function friendlyError(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message;
    if (/Invalid API key/i.test(msg)) {
      return "The Supabase API key looks wrong. Check VITE_SUPABASE_ANON_KEY in your .env.local.";
    }
    if (/Failed to fetch|NetworkError|load failed/i.test(msg)) {
      return "Can't reach the Supabase server. Check your connection and the project URL.";
    }
    if (/does not exist|relation/i.test(msg)) {
      return "The database tables haven't been created yet. Run supabase/schema.sql in the Supabase SQL editor.";
    }
  }
  return "Something went wrong with the database. Please try again.";
}
