import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads the same env files Vite uses (.env.local first, then .env).
 * The server reads VITE_SUPABASE_* from there and adds its own
 * server-only variables (OPENAI_API_KEY, ...) which must NEVER be
 * prefixed with VITE_ (those get bundled into the browser).
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (existsSync(p)) dotenv.config({ path: p });
}

export const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

/** Server-only OpenAI credentials. Never expose this to the browser. */
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
export const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS ?? 700);

/** Which AI provider plugin to use (see server/ai/index.ts). */
export const AI_PROVIDER = process.env.AI_PROVIDER ?? "openai";

export const PORT = Number(process.env.PORT ?? 8787);

/** Per-user sliding-window cap (hourly) so AI usage stays controllable. */
export const AI_RATE_LIMIT_PER_HOUR = Number(
  process.env.AI_RATE_LIMIT_PER_HOUR ?? 30
);

/* ── eBay marketplace integration (server-side only) ──────────────── */

/**
 * eBay developer credentials (create at developer.ebay.com → Applications →
 * Keys). The redirect URI must be registered in the eBay app AND match this
 * value exactly, e.g. https://your-app.com/api/marketplaces/ebay/auth/callback
 * (with https://api.sandbox.ebay.com/auth/devaccount/... in sandbox mode).
 */
export const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID ?? "";
export const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET ?? "";
export const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI ?? "";

/** Set to "true" to run against the eBay sandbox instead of production. */
export const EBAY_SANDBOX =
  (process.env.EBAY_SANDBOX ?? "").toLowerCase() === "true";
