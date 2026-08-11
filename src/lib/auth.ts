import type { Session } from "@supabase/supabase-js";
import { db, friendlyError } from "@/lib/db/client";

/** App-side profile record (mirrors the `users` table). */
export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  onboarded: boolean;
  createdAt?: string;
}

/** Turn a Supabase auth error into a message a reseller can act on. */
export function friendlyAuthError(e: unknown): string {
  if (!(e instanceof Error)) return "Something went wrong. Please try again.";
  const code = (e as { code?: string }).code ?? "";
  const msg = e.message.toLowerCase();

  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg))
    return "Incorrect email or password.";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg))
    return "Please confirm your email first — check your inbox for the confirmation link.";
  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    /already registered|already been registered/i.test(msg)
  )
    return "That email is already registered. Try signing in instead.";
  if (code === "weak_password" || /password should be at least/i.test(msg))
    return "Your password must be at least 6 characters.";
  if (code === "over_request_rate_limit" || /rate limit/i.test(msg))
    return "Too many attempts. Please wait a moment and try again.";
  if (/unable to validate email|invalid email/i.test(msg))
    return "That email address looks invalid.";
  if (/provider is not enabled/i.test(msg))
    return "Google sign-in isn't enabled on this project yet. Use email instead, or enable the Google provider in Supabase.";
  if (/network|failed to fetch|load failed/i.test(msg))
    return "Can't reach the sign-in server. Check your connection and try again.";
  if (/new password should be different/i.test(msg))
    return "Your new password must be different from the current one.";
  return "Unable to sign in right now. Please try again.";
}

/* ── Sessions ─────────────────────────────────────────────────── */

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const client = db();
  return client.auth.onAuthStateChange((_event, session) => callback(session));
}

/* ── Sign in / sign up / sign out ─────────────────────────────── */

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const client = db();
  const { error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(friendlyAuthError(error));
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<{ needsEmailConfirmation: boolean }> {
  const client = db();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
  if (error) throw new Error(friendlyAuthError(error));
  // No session returned ⇒ email confirmation is enabled for the project.
  return { needsEmailConfirmation: !data.session };
}

export async function signInWithGoogle(): Promise<void> {
  const client = db();
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(friendlyAuthError(error));
}

export async function signOut(): Promise<void> {
  const client = db();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(friendlyAuthError(error));
}

/** True when a session already exists (implicit recovery-link flow). */
export async function hasActiveSession(): Promise<boolean> {
  const client = db();
  const { data } = await client.auth.getSession();
  return Boolean(data.session);
}

/* ── Password reset ───────────────────────────────────────────── */

export async function requestPasswordReset(email: string): Promise<void> {
  const client = db();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(friendlyAuthError(error));
}

/** Exchange a recovery `?code=` (PKCE) for a session. */
export async function exchangeRecoveryCode(code: string): Promise<void> {
  const client = db();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error)
    throw new Error("This password reset link is invalid or has expired. Request a new one.");
}

export async function updatePassword(newPassword: string): Promise<void> {
  const client = db();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new Error(friendlyAuthError(error));
}

/* ── App profile (users table) ────────────────────────────────── */

export async function fetchProfile(userId: string): Promise<AppUser | null> {
  const client = db();
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(friendlyError(error));
  if (!data) return null;
  return {
    id: data.id as string,
    email: (data.email as string | null) ?? "",
    displayName: (data.display_name as string | null) ?? "",
    avatarUrl: (data.avatar_url as string | null | undefined) ?? undefined,
    onboarded: Boolean(data.onboarded),
    createdAt: data.created_at as string | undefined,
  };
}

export async function updateProfile(
  userId: string,
  patch: { displayName?: string; avatarUrl?: string }
): Promise<void> {
  const client = db();
  const update: Record<string, unknown> = {};
  if (patch.displayName !== undefined) update.display_name = patch.displayName.trim();
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;
  const { error } = await client.from("users").update(update).eq("id", userId);
  if (error) throw new Error(friendlyError(error));
}

export async function markOnboarded(userId: string): Promise<void> {
  const client = db();
  const { error } = await client.from("users").update({ onboarded: true }).eq("id", userId);
  if (error) throw new Error(friendlyError(error));
}
