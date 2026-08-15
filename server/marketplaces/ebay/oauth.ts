/**
 * eBay OAuth 2.0 (authorization code grant).
 *
 * Flow:
 *   1. GET /api/marketplaces/ebay/auth/start   → returns the eBay authorize URL.
 *   2. The user approves on eBay → eBay redirects to our callback with ?code=.
 *   3. GET /api/marketplaces/ebay/auth/callback → exchanges the code for
 *      access + refresh tokens, stores them per-user, redirects back into
 *      the app.
 *
 * The `state` parameter is an HMAC-signed token binding the redirect to the
 * signed-in user (CSRF protection). It survives server restarts because it's
 * stateless — verified with the secret client key.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  APP_ORIGIN,
  ebayConfigured,
  EBAY_AUTH_URL,
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REDIRECT_URI,
  EBAY_SCOPES,
  EBAY_TOKEN_URL,
} from "./config.js";

/** Thrown when an eBay OAuth/API step fails; message is user-safe. */
export class EbayError extends Error {}

export interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

/** The authorize URL the browser should be sent to. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: EBAY_CLIENT_ID,
    response_type: "code",
    redirect_uri: EBAY_REDIRECT_URI,
    scope: EBAY_SCOPES,
    state,
  });
  return `${EBAY_AUTH_URL}?${params.toString()}`;
}

/* ── Stateless signed state (binds the callback to the user) ───────── */

function hmac(payload: string): Buffer {
  return createHmac("sha256", EBAY_CLIENT_SECRET).update(payload).digest();
}

/** Sign a state token that encodes the user id and a 10-minute expiry. */
export function signState(userId: string): string {
  const payload = `${userId}.${Date.now() + 10 * 60 * 1000}`;
  return `${payload}.${hmac(payload).toString("hex")}`;
}

/** Verify a state token; returns the user id or null when invalid/expired. */
export function verifyState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiry, sig] = parts;
  const expected = hmac(`${userId}.${expiry}`);
  const provided = Buffer.from(sig, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }
  if (Number.isNaN(Number(expiry)) || Date.now() > Number(expiry)) return null;
  return userId;
}

/* ── Token exchange & refresh ──────────────────────────────────────── */

async function tokenRequest(body: URLSearchParams): Promise<EbayTokenResponse> {
  const basic = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(EBAY_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch {
    throw new EbayError("Couldn't reach eBay to finish the connection. Please try again.");
  }
  const bodyText = await res.text();
  if (!res.ok) {
    throw new EbayError(
      `eBay rejected the connection (${res.status}). Please try again — if it keeps failing, check the app's eBay setup.`
    );
  }
  const data = JSON.parse(bodyText) as EbayTokenResponse;
  if (!data.access_token) throw new EbayError("eBay returned an empty token. Please try again.");
  return data;
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCode(code: string): Promise<EbayTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: EBAY_REDIRECT_URI,
  });
  return tokenRequest(params);
}

/** Refresh an expired access token using the stored refresh token. */
export async function refreshTokens(refreshToken: string): Promise<EbayTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return tokenRequest(params);
}

/** Where the browser goes after the callback finishes (success or error). */
export function callbackRedirect(ok: boolean, message?: string): string {
  const base = APP_ORIGIN ? `${APP_ORIGIN}/marketplace` : "/marketplace";
  const params = new URLSearchParams({ ebay: ok ? "connected" : "error" });
  if (message) params.set("message", message);
  return `${base}?${params.toString()}`;
}

/** Throw when the server hasn't been given eBay developer credentials. */
export function requireEbayConfigured(): void {
  if (!ebayConfigured) {
    throw new EbayError(
      "eBay isn't configured on this app yet. The owner needs to add eBay developer keys (see EBAY_SETUP.md)."
    );
  }
}
