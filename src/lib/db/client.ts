import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True once VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * The signed-in user's access token, read straight from the persisted session.
 * Storage uploads must carry this token (not the anon key) so the storage RLS
 * policies see an authenticated user — without it every upload is denied as
 * anonymous with "new row violates row-level security policy". The client
 * normally attaches this automatically, but a custom fetch guarantees it on
 * every storage request even if the client's header injection misses.
 */
function sessionAccessToken(): string | null {
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    return (JSON.parse(raw) as { access_token?: string }).access_token ?? null;
  } catch {
    return null;
  }
}

let client: SupabaseClient | null = null;

function buildClient(): SupabaseClient {
  return createClient(url!, anonKey!, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        const reqUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;
        // Storage requests must go out as the signed-in user, never anon.
        if (reqUrl.includes("/storage/v1/")) {
          const token = sessionAccessToken();
          if (token) headers.set("Authorization", `Bearer ${token}`);
        }
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Returns the Supabase client or throws a friendly, actionable error. */
export function db(): SupabaseClient {
  if (!client) client = isSupabaseConfigured ? buildClient() : null;
  if (!client) {
    throw new Error("Regroove isn't connected to a Supabase project yet.");
  }
  return client;
}

/** The signed-in user's id, or null when there's no session. */
export async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await db().auth.getUser();
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
