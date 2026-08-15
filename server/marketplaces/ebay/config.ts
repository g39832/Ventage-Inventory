/**
 * eBay integration configuration.
 *
 * All credentials live in server-side env vars (never the browser). The
 * OAuth endpoints, token exchange, and every eBay API call happen here on
 * the server using each user's stored tokens.
 */

import {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REDIRECT_URI,
  EBAY_SANDBOX,
} from "../../env.js";

/** True when the app owner has registered eBay developer keys on the server. */
export const ebayConfigured = Boolean(
  EBAY_CLIENT_ID && EBAY_CLIENT_SECRET && EBAY_REDIRECT_URI
);

/** Scopes needed to publish listings, manage policies, and read orders. */
export const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
].join(" ");

export const EBAY_AUTH_URL = EBAY_SANDBOX
  ? "https://auth.sandbox.ebay.com/oauth2/authorize"
  : "https://auth.ebay.com/oauth2/authorize";

export const EBAY_TOKEN_URL = EBAY_SANDBOX
  ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
  : "https://api.ebay.com/identity/v1/oauth2/token";

export const EBAY_API_URL = EBAY_SANDBOX
  ? "https://api.sandbox.ebay.com"
  : "https://api.ebay.com";

export const EBAY_MARKETPLACE_ID = "EBAY_US";
export const EBAY_CURRENCY = "USD";

/** Where the browser lands after the eBay OAuth round-trip completes. */
export const APP_ORIGIN = (() => {
  try {
    return new URL(EBAY_REDIRECT_URI).origin;
  } catch {
    return "";
  }
})();

/** Per-user default eBay category (Men's T-Shirts, US) used for offers. */
export const DEFAULT_EBAY_CATEGORY_ID = "15687";

// Re-export the raw credentials so OAuth helpers can use them directly.
export { EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_REDIRECT_URI };
