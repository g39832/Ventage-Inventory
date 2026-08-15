/**
 * eBay integration — frontend client.
 *
 * The browser never talks to eBay directly (no keys, no tokens). It calls
 * the Regroove server (/api/marketplaces/ebay/*) with the user's Supabase
 * session token; the server holds the eBay OAuth tokens and does the work.
 */

import { db } from "@/lib/db/client";

async function sessionToken(): Promise<string> {
  const client = db();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = await sessionToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error(
      "Can't reach the server. Make sure the app's server is running (npm run dev:server)."
    );
  }

  if (res.ok) {
    return (await res.json().catch(() => ({}))) as T;
  }

  let message = "Something went wrong with the eBay connection. Please try again.";
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) message = body.error;
  } catch {
    // Non-JSON body — keep the default message.
  }
  throw new Error(message);
}

export interface EbayStatus {
  configured: boolean;
  connected: boolean;
  username: string | null;
}

export interface EbaySyncResult {
  listings: number;
  listed: number;
  soldCount: number;
  recentSales: {
    orderId: string;
    sku: string;
    title: string;
    quantity: number;
    price: number;
    soldDate: string;
  }[];
  lastSync: string;
}

/** Open eBay's OAuth page. The browser leaves the app and returns to /ebay/callback. */
export async function startEbayOAuth(): Promise<void> {
  const { url } = await request<{ url: string }>("/api/marketplaces/ebay/auth/start");
  if (!url) throw new Error("eBay didn't return a connection link.");
  window.location.href = url;
}

/** Complete the OAuth handshake after eBay redirects back to /ebay/callback. */
export async function completeEbayOAuth(code: string, state: string): Promise<{ username?: string }> {
  return request<{ username?: string }>("/api/marketplaces/ebay/complete", {
    method: "POST",
    body: { code, state },
  });
}

export async function ebayStatus(): Promise<EbayStatus> {
  return request<EbayStatus>("/api/marketplaces/ebay/status");
}

export async function disconnectEbay(): Promise<void> {
  await request<{ ok: boolean }>("/api/marketplaces/ebay/disconnect", { method: "POST" });
}

/** Update the user's default eBay category id (used when publishing). */
export async function updateEbayCategory(categoryId: string): Promise<void> {
  await request<{ ok: boolean }>("/api/marketplaces/ebay/settings", {
    method: "POST",
    body: { categoryId },
  });
}

/** Publish an app item to eBay; returns the real eBay listing id. */
export async function publishToEbay(itemId: string): Promise<{ listingId: string }> {
  return request<{ listingId: string }>("/api/marketplaces/ebay/list", {
    method: "POST",
    body: { itemId },
  });
}

/** End the eBay listing for an app item. */
export async function unlistFromEbay(itemId: string): Promise<void> {
  await request<{ ok: boolean }>("/api/marketplaces/ebay/unlist", {
    method: "POST",
    body: { itemId },
  });
}

export async function syncEbay(): Promise<EbaySyncResult> {
  return request<EbaySyncResult>("/api/marketplaces/ebay/sync", { method: "POST" });
}
