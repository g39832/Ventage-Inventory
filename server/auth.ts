import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env.js";

/** Thrown when the bearer token isn't a valid, live Supabase session. */
export class AuthError extends Error {}

export interface AuthedUser {
  id: string;
  email: string | null;
}

/**
 * Verifies the user's Supabase access token with the auth service.
 * Identity is derived ONLY from this verified token — a user_id sent by
 * the client is never trusted.
 */
export async function verifyAccessToken(token: string): Promise<AuthedUser> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured on the server.");
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError("Your session has expired. Please sign in again.");
  }
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * A Supabase client that acts AS the authenticated user (their access token
 * is sent with every request). Row Level Security therefore enforces that
 * each query only ever touches that user's own rows — the same guarantee
 * the frontend gets, with no service-role key anywhere.
 */
export function userScopedClient(token: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured on the server.");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
