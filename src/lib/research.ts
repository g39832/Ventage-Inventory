/**
 * Research — frontend client for the item research / sold comps feature.
 *
 * The browser never talks to eBay directly. It calls the Regroove server
 * (/api/marketplaces/ebay/research) with the user's Supabase session
 * token; the server holds the app's eBay developer credentials and does
 * the Browse API work server-side.
 */

import { request } from "@/lib/ebay";

export type ResearchVerdict = "strong" | "moderate" | "low" | "insufficient";

export interface ResearchListing {
  itemId: string;
  title: string;
  price: number | null;
  currency: string;
  condition: string | null;
  thumbnail: string | null;
  url: string | null;
  endedAt: string | null;
  seller: string | null;
  buyingOptions: string[];
}

export interface ResearchMetrics {
  activeCount: number;
  soldCount: number;
  /** sold / (sold + active) × 100 — null when no sold data exists. */
  sellThroughRate: number | null;
  avgSold: number | null;
  medianSold: number | null;
  minSold: number | null;
  maxSold: number | null;
  avgActive: number | null;
  medianActive: number | null;
  estimatedMarketPrice: number | null;
  estimatedMarketPriceSource: "sold" | "active" | null;
}

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

export interface SavedResearch {
  id: string;
  query: string;
  searchedAt: string;
  result: ResearchResult;
}

/** Run a research search. Pass save:true to persist to research history. */
export async function searchResearch(
  query: string,
  save = false
): Promise<{ result: ResearchResult; saved?: { id: string; searchedAt: string } | null }> {
  return request<{ result: ResearchResult; saved?: { id: string; searchedAt: string } | null }>(
    "/api/marketplaces/ebay/research",
    { method: "POST", body: { query, save } }
  );
}

/** The signed-in user's saved research history (never another user's). */
export async function researchHistory(): Promise<SavedResearch[]> {
  const data = await request<{ history: SavedResearch[] }>(
    "/api/marketplaces/ebay/research/history"
  );
  return data.history;
}

/** Remove one saved research entry. */
export async function deleteResearch(id: string): Promise<void> {
  await request<{ ok: boolean }>(
    `/api/marketplaces/ebay/research/history/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}
