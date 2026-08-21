/**
 * Item research — sold comps via eBay's official Buy Browse API.
 *
 * Everything here runs server-side and uses eBay's OFFICIAL developer
 * API only (no scraping, no browser automation, no unofficial services):
 *
 *   GET /buy/browse/v1/item_summary/search
 *
 *  • Active listings  → plain keyword search (filter=priceCurrency:USD)
 *  • Sold/completed   → the same endpoint with the documented
 *    `itemEndState:EndedWithSales` filter, which returns items that
 *    ended with a sale along with their final price and itemEndDate.
 *    (The old Finding API's findCompletedItems was deprecated and
 *    retired by eBay; itemEndState is the official replacement.)
 *
 * AUTH: Browse API search supports an *application access token*
 * (client-credentials grant), so research works for every signed-in
 * app user WITHOUT requiring them to connect their own eBay account.
 * The app's client_id/client_secret never leave the server.
 *
 * CACHING: identical searches are served from an in-memory cache for
 * 30 minutes to avoid burning the app key's daily quota (Buy APIs are
 * quota'd per app key, shared by every user). No indefinite caching.
 *
 * RATE LIMITS: eBay returns HTTP 429 when the app key quota is
 * exhausted; that surfaces as ResearchRateLimitedError (friendly
 * message, no retry loop). The router adds its own per-user + per-app
 * guard rails.
 *
 * METRICS METHODOLOGY (computed here in plain TS — never by AI):
 *  • Sell-through rate = sold / (sold + active) × 100, the industry
 *    standard proxy for how often a listing like this turns over.
 *    Only reported when sold data exists (a 0% with no comps would
 *    be meaningless). Based on the first 50 active + first 50 sold
 *    results eBay returns for the query.
 *  • Averages/medians over those same samples. Asking prices are
 *    NEVER treated as sale prices — active and sold stats are kept
 *    strictly separate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractEbayError } from "./api.js";
import {
  EBAY_API_URL,
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_CURRENCY,
  EBAY_MARKETPLACE_ID,
  EBAY_TOKEN_URL,
} from "./config.js";
import { EbayError } from "./oauth.js";

/** Thrown when eBay's quota (or our guard rails) say "slow down". */
export class ResearchRateLimitedError extends Error {}

/** Fetch with a hard timeout so a hung eBay never hangs the user. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ── Application access token (client credentials, cached) ────── */

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let appToken: CachedToken | null = null;

/** App-level token for the Buy Browse API. Refreshed before expiry. */
export async function getApplicationAccessToken(): Promise<string> {
  if (appToken && appToken.expiresAt > Date.now() + 60_000) {
    return appToken.accessToken;
  }
  const basic = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString("base64");
  let res: Response;
  try {
    res = await fetchWithTimeout(
      EBAY_TOKEN_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "https://api.ebay.com/oauth/api_scope",
        }),
      },
      10_000
    );
  } catch {
    throw new EbayError("Couldn't reach eBay. Please try again in a moment.");
  }
  const text = await res.text();
  let data: { access_token?: string; expires_in?: number } = {};
  try {
    data = JSON.parse(text) as { access_token?: string; expires_in?: number };
  } catch {
    // Non-JSON body — handled below with a friendly message.
  }
  if (!res.ok || !data.access_token) {
    throw new EbayError(
      "eBay rejected the research request. Check the app's eBay developer keys (see EBAY_SETUP.md) and try again."
    );
  }
  appToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  return appToken.accessToken;
}

/* ── Browse API search ────────────────────────────────────────── */

export type ResearchItemKind = "active" | "sold";

interface BrowseItemSummary {
  itemId?: string;
  title?: string;
  price?: { value?: string; currency?: string };
  condition?: string;
  thumbnailImages?: { imageUrl?: string }[];
  itemWebUrl?: string;
  itemHref?: string;
  itemEndDate?: string;
  seller?: { username?: string };
  buyingOptions?: string[];
}

interface BrowseSearchResponse {
  itemSummaries?: BrowseItemSummary[] | null;
  total?: number;
}

async function browseSearch(
  accessToken: string,
  query: string,
  kind: ResearchItemKind,
  limit = 50
): Promise<BrowseItemSummary[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    filter:
      kind === "sold"
        ? `itemEndState:EndedWithSales,priceCurrency:${EBAY_CURRENCY}`
        : `priceCurrency:${EBAY_CURRENCY}`,
  });
  const path = `/buy/browse/v1/item_summary/search?${params.toString()}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${EBAY_API_URL}${path}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE_ID,
        },
      },
      12_000
    );
  } catch {
    throw new EbayError("Couldn't reach eBay. Please try again in a moment.");
  }

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Malformed body — fall through to the friendly error path.
  }

  if (!res.ok) {
    if (res.status === 429) {
      throw new ResearchRateLimitedError(
        "eBay's research quota is temporarily exhausted. Please try again in a little while."
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new EbayError(
        "eBay research access needs attention — the app's eBay developer keys may have expired. See EBAY_SETUP.md."
      );
    }
    throw new EbayError(extractEbayError(data));
  }

  const body = data as BrowseSearchResponse;
  return Array.isArray(body.itemSummaries) ? body.itemSummaries : [];
}

/* ── Normalization ────────────────────────────────────────────── */

export interface ResearchListing {
  itemId: string;
  title: string;
  price: number | null;
  currency: string;
  condition: string | null;
  thumbnail: string | null;
  /** The listing's eBay page (itemHref, falling back to itemWebUrl). */
  url: string | null;
  /** Listing end timestamp — the sold date for ended items. */
  endedAt: string | null;
  seller: string | null;
  buyingOptions: string[];
}

function mapListing(s: BrowseItemSummary): ResearchListing {
  const price = s.price?.value !== undefined ? Number(s.price.value) : NaN;
  return {
    itemId: s.itemId ?? "",
    title: s.title ?? "",
    price: Number.isFinite(price) ? price : null,
    currency: s.price?.currency ?? EBAY_CURRENCY,
    condition: s.condition ?? null,
    thumbnail: s.thumbnailImages?.[0]?.imageUrl ?? null,
    url: s.itemHref ?? s.itemWebUrl ?? null,
    endedAt: s.itemEndDate ?? null,
    seller: s.seller?.username ?? null,
    buyingOptions: s.buyingOptions ?? [],
  };
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/* ── Metrics (plain TS math, documented methodology) ──────────── */

export interface ResearchMetrics {
  activeCount: number;
  soldCount: number;
  /** sold / (sold + active) × 100 — null unless sold data exists. */
  sellThroughRate: number | null;
  avgSold: number | null;
  medianSold: number | null;
  minSold: number | null;
  maxSold: number | null;
  avgActive: number | null;
  medianActive: number | null;
  /** Best single-number estimate: median sold, else median active. */
  estimatedMarketPrice: number | null;
  estimatedMarketPriceSource: "sold" | "active" | null;
}

export type ResearchVerdict = "strong" | "moderate" | "low" | "insufficient";

export interface ResearchResult {
  query: string;
  searchedAt: string;
  active: ResearchListing[];
  sold: ResearchListing[];
  metrics: ResearchMetrics;
  verdict: ResearchVerdict;
  verdictLabel: string;
  verdictSentence: string;
  notes: string[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function priceStats(prices: number[]): { avg: number | null; median: number | null; min: number | null; max: number | null } {
  if (prices.length === 0) return { avg: null, median: null, min: null, max: null };
  return {
    avg: round2(prices.reduce((a, b) => a + b, 0) / prices.length),
    median: round2(median(prices) ?? 0),
    min: round2(Math.min(...prices)),
    max: round2(Math.max(...prices)),
  };
}

function classifyVerdict(metrics: ResearchMetrics): { verdict: ResearchVerdict; label: string; sentence: string } {
  const { soldCount, sellThroughRate } = metrics;
  if (soldCount === 0) {
    return {
      verdict: "insufficient",
      label: "Not enough sold data",
      sentence:
        "eBay didn't return enough sold comps to judge this item. The active listings below still show what sellers are asking right now.",
    };
  }
  // Transparent, documented thresholds. A single comp or a tiny sample
  // is never called "strong".
  if (soldCount >= 5 && sellThroughRate !== null && sellThroughRate >= 50) {
    return {
      verdict: "strong",
      label: "Strong resale potential",
      sentence: "Lots of comparable items are selling, and they turn over faster than they pile up as active listings.",
    };
  }
  if (soldCount >= 2 && sellThroughRate !== null && sellThroughRate >= 20) {
    return {
      verdict: "moderate",
      label: "Moderate resale potential",
      sentence: "Comparable items are selling, but the market is slower or the sample is small — price carefully.",
    };
  }
  return {
    verdict: "low",
    label: "Low resale potential",
    sentence: "Too few sales relative to what's listed, or too few comps to go on — expect a slow flip or a discount.",
  };
}

/** Compute all metrics + the verdict from the returned listings. */
export function computeResearchMetrics(
  query: string,
  active: ResearchListing[],
  sold: ResearchListing[]
): ResearchResult {
  const soldPrices = sold.map((l) => l.price).filter((p): p is number => p !== null);
  const activePrices = active.map((l) => l.price).filter((p): p is number => p !== null);

  const soldStats = priceStats(soldPrices);
  const activeStats = priceStats(activePrices);

  const activeCount = active.length;
  const soldCount = sold.length;
  const sellThroughRate =
    soldCount > 0 && activeCount + soldCount > 0
      ? round2((soldCount / (soldCount + activeCount)) * 100)
      : null;

  const metrics: ResearchMetrics = {
    activeCount,
    soldCount,
    sellThroughRate,
    avgSold: soldStats.avg,
    medianSold: soldStats.median,
    minSold: soldStats.min,
    maxSold: soldStats.max,
    avgActive: activeStats.avg,
    medianActive: activeStats.median,
    estimatedMarketPrice: soldStats.median ?? activeStats.median,
    estimatedMarketPriceSource: soldStats.median !== null ? "sold" : activeStats.median !== null ? "active" : null,
  };

  const { verdict, label, sentence } = classifyVerdict(metrics);

  const notes: string[] = [];
  if (soldCount > 0) {
    notes.push(
      "Sold prices are final prices from ended eBay listings (official Buy Browse API). eBay's ended-item index only covers a recent window of ended listings, so older sales won't appear."
    );
  } else {
    notes.push("eBay returned no sold comps for this search, so no sell-through rate or sold-price stats are shown.");
  }
  notes.push(
    "Active prices are asking prices — what sellers want, not what buyers pay. They are reported separately and never mixed into sold stats."
  );
  notes.push(
    `Metrics are calculated from the first 50 active and first 50 sold results eBay returned for “${query}”.`
  );

  return {
    query,
    searchedAt: new Date().toISOString(),
    active,
    sold,
    metrics,
    verdict,
    verdictLabel: label,
    verdictSentence: sentence,
    notes,
  };
}

/* ── Orchestration + caching ──────────────────────────────────── */

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes, documented
const CACHE_MAX_ENTRIES = 100;
const cache = new Map<string, { result: ResearchResult; expiresAt: number }>();

/** Drop expired entries and keep the cache bounded (no indefinite caching). */
function pruneCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size > CACHE_MAX_ENTRIES) {
    // Remove oldest entries (Map iterates in insertion order).
    for (const key of cache.keys()) {
      if (cache.size <= CACHE_MAX_ENTRIES) break;
      cache.delete(key);
    }
  }
}

/**
 * Search eBay (active + sold in parallel) and compute the result.
 * Repeated identical searches within 30 minutes are served from the
 * in-memory cache — no duplicate API spend.
 */
export async function runResearch(rawQuery: string): Promise<ResearchResult> {
  const query = rawQuery.trim();
  if (!query) throw new Error("Enter something to search for.");
  if (query.length > 200) throw new Error("That search is too long — keep it under 200 characters.");

  const key = normalizeQuery(query);
  pruneCache();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.result;

  const accessToken = await getApplicationAccessToken();
  const [active, sold] = await Promise.all([
    browseSearch(accessToken, query, "active"),
    browseSearch(accessToken, query, "sold"),
  ]);

  // Guard against malformed entries (e.g. null elements) so a weird eBay
  // response can never crash the request — it's simply skipped.
  const safe = (items: BrowseItemSummary[]): ResearchListing[] =>
    items.filter((s): s is BrowseItemSummary => !!s && typeof s === "object").map(mapListing);

  const result = computeResearchMetrics(query, safe(active).slice(0, 50), safe(sold).slice(0, 50));
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

/* ── Saved history (server writes only; RLS scopes rows) ──────── */

export interface SavedResearchRow {
  id: string;
  query: string;
  searchedAt: string;
  result: ResearchResult;
}

interface HistoryRow {
  id: string;
  query: string;
  searched_at: string;
  result: unknown;
}

export async function saveResearch(
  client: SupabaseClient,
  userId: string,
  result: ResearchResult
): Promise<{ id: string; searchedAt: string }> {
  // Keep the stored snapshot light: full metrics + top 10 of each list.
  const snapshot = { ...result, active: result.active.slice(0, 10), sold: result.sold.slice(0, 10) };
  const { data, error } = await client
    .from("research_history")
    .insert({ owner_id: userId, query: result.query, result: snapshot as unknown as object })
    .select("id, searched_at")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id, searchedAt: (data as { searched_at: string }).searched_at };
}

export async function listResearchHistory(
  client: SupabaseClient,
  userId: string
): Promise<SavedResearchRow[]> {
  const { data, error } = await client
    .from("research_history")
    .select("id, query, searched_at, result")
    .eq("owner_id", userId)
    .order("searched_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return ((data ?? []) as HistoryRow[]).map((r) => ({
    id: r.id,
    query: r.query,
    searchedAt: r.searched_at,
    result: r.result as ResearchResult,
  }));
}

export async function deleteResearch(
  client: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  // owner_id in the filter is defense-in-depth on top of RLS.
  const { error } = await client
    .from("research_history")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) throw new Error(error.message);
}
