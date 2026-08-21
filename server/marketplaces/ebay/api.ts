/**
 * Minimal, focused eBay API client (Sell Inventory, Sell Account, Sell
 * Fulfillment, Commerce Identity).
 *
 * Every call uses the signed-in user's own access token and the production
 * (or sandbox) API base from config. The app never touches eBay directly
 * from the browser — all of this runs server-side.
 *
 * ⚠️ Verify against the eBay Sandbox before going live: set EBAY_SANDBOX=true
 * and use sandbox keys/accounts (see EBAY_SETUP.md).
 */

import { EbayError } from "./oauth.js";
import {
  EBAY_API_URL,
  EBAY_CURRENCY,
  EBAY_MARKETPLACE_ID,
} from "./config.js";
import type { EbayTokenRecord } from "./tokens.js";

type PolicyType = "payment" | "return" | "fulfillment";

async function ebayFetch(
  accessToken: string,
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE_ID,
  };
  let res: Response;
  try {
    res = await fetch(`${EBAY_API_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new EbayError("Couldn't reach eBay. Please try again in a moment.");
  }
  if (res.status === 204) return {};
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Non-JSON body (rare) — leave data empty.
  }
  if (!res.ok) {
    const msg = extractEbayError(data);
    if (res.status === 401 || res.status === 403) {
      throw new EbayError("Your eBay connection expired — reconnect it in Marketplace connections.");
    }
    throw new EbayError(msg);
  }
  return data;
}

export function extractEbayError(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as {
      errors?: { message?: string; longMessage?: string }[];
      error_description?: string;
      error?: string;
      message?: string;
    };
    const first = d.errors?.[0];
    const msg =
      first?.longMessage ?? first?.message ?? d.error_description ?? d.error ?? d.message;
    if (msg) return `eBay: ${msg}`;
  }
  return "eBay returned an error. Please try again.";
}

/* ── Identity ──────────────────────────────────────────────────────── */

/** The seller's eBay username, shown as the connected account. */
export async function getEbayUsername(accessToken: string): Promise<string> {
  const data = (await ebayFetch(
    accessToken,
    "/commerce/identity/v1/user/"
  )) as { username?: string };
  return data.username ?? "eBay user";
}

/* ── Sell Account: listing policies (created once per user) ────────── */

interface PolicySummary {
  paymentPolicyId?: string;
  returnPolicyId?: string;
  fulfillmentPolicyId?: string;
}

function policyPath(type: PolicyType): string {
  return `/sell/account/v1/${type}_policy`;
}

async function listPolicies(
  accessToken: string,
  type: PolicyType
): Promise<{ [key: string]: string }[]> {
  const data = (await ebayFetch(
    accessToken,
    `${policyPath(type)}?marketplace_id=${EBAY_MARKETPLACE_ID}`
  )) as { [key: string]: string }[];
  return Array.isArray(data) ? data : [];
}

async function createPolicy(
  accessToken: string,
  type: PolicyType,
  body: Record<string, unknown>
): Promise<string> {
  const data = (await ebayFetch(accessToken, policyPath(type), {
    method: "POST",
    body,
  })) as { [key: string]: string };
  return (data[`${type}PolicyId`] as string | undefined) ?? "";
}

const DEFAULT_POLICIES: Record<PolicyType, Record<string, unknown>> = {
  payment: {
    name: "Regroove Managed Payments",
    marketplaceId: EBAY_MARKETPLACE_ID,
    paymentMethods: [{ paymentMethodType: "ESCROW" }],
  },
  return: {
    name: "Regroove 30-Day Returns",
    marketplaceId: EBAY_MARKETPLACE_ID,
    returnPolicyInfo: {
      returnsAccepted: true,
      returnPeriod: { value: "30", unit: "DAY" },
      returnMethod: "RETURN_ITEM",
      returnShippingCostPayer: "BUYER",
      restockingFeePercentage: "0",
    },
  },
  fulfillment: {
    name: "Regroove USPS Priority",
    marketplaceId: EBAY_MARKETPLACE_ID,
    handlingTime: { value: 2, unit: "DAY" },
    shippingOptions: [
      {
        shippingServiceType: "DOMESTIC",
        shippingCarrierCode: "USPS",
        shippingServiceCode: "USPSPriorityMail",
        shippingCost: { value: "8.00", currency: EBAY_CURRENCY },
        additionalShippingCost: { value: "0.00", currency: EBAY_CURRENCY },
      },
    ],
  },
};

/**
 * Reuse an existing policy if one matches the default name, otherwise
 * create it. Returns the three policy ids (persist them per user).
 */
export async function ensurePolicies(
  accessToken: string,
  record: EbayTokenRecord
): Promise<PolicySummary> {
  const out: PolicySummary = {
    paymentPolicyId: record.paymentPolicyId ?? undefined,
    returnPolicyId: record.returnPolicyId ?? undefined,
    fulfillmentPolicyId: record.fulfillmentPolicyId ?? undefined,
  };

  const types: PolicyType[] = ["payment", "return", "fulfillment"];
  for (const type of types) {
    const idKey = `${type}PolicyId` as keyof PolicySummary;
    if (out[idKey]) continue;
    const existing = await listPolicies(accessToken, type);
    const match = existing.find((p) => p.name === DEFAULT_POLICIES[type].name);
    const id = match?.[`${type}PolicyId`] ?? (await createPolicy(accessToken, type, DEFAULT_POLICIES[type]));
    (out as Record<string, string | undefined>)[idKey] = id;
  }
  return out;
}

/* ── Sell Inventory: items, offers, publish ────────────────────────── */

export interface EbayItemPayload {
  sku: string;
  title: string;
  description: string;
  imageUrls: string[];
  brand?: string;
  condition: string;
  price: number;
  quantity: number;
  categoryId: string;
}

/** Map free-text app conditions to eBay condition enums (best effort). */
export function mapCondition(text: string): string {
  const t = text.toLowerCase();
  if (/new with tags/i.test(t) || /brand new/i.test(t)) return "NEW_WITH_TAGS";
  if (/new/i.test(t)) return "NEW";
  if (/like new/i.test(t)) return "LIKE_NEW";
  if (/excellent/i.test(t)) return "LIKE_NEW";
  if (/very good/i.test(t)) return "VERY_GOOD";
  if (/good/i.test(t)) return "GOOD";
  return "USED";
}

/** Create or replace the eBay inventory item (idempotent PUT by SKU). */
export async function createInventoryItem(
  accessToken: string,
  item: EbayItemPayload
): Promise<void> {
  const sku = encodeURIComponent(item.sku);
  const body: Record<string, unknown> = {
    sku: item.sku,
    product: {
      title: item.title.slice(0, 80),
      description: item.description.slice(0, 5000),
      imageUrls: item.imageUrls,
    },
    condition: item.condition,
    availability: {
      shipToLocationAvailability: { quantity: item.quantity },
    },
  };
  if (item.brand) body.product = { ...(body.product as object), brand: { brand: item.brand } };
  await ebayFetch(accessToken, `/sell/inventory/v1/inventory_item/${sku}`, {
    method: "PUT",
    body,
  });
}

/** Create a fixed-price offer for an inventory item. */
export async function createOffer(
  accessToken: string,
  item: EbayItemPayload,
  policies: PolicySummary
): Promise<string> {
  const data = (await ebayFetch(accessToken, "/sell/inventory/v1/offer", {
    method: "POST",
    body: {
      sku: item.sku,
      marketplaceId: EBAY_MARKETPLACE_ID,
      format: "FIXED_PRICE",
      availableQuantity: item.quantity,
      categoryId: item.categoryId,
      listingDescription: item.description.slice(0, 5000),
      listingDuration: "GTC",
      pricing: {
        currentPrice: { value: item.price.toFixed(2), currency: EBAY_CURRENCY },
      },
      listingPolicies: {
        paymentPolicyId: policies.paymentPolicyId,
        returnPolicyId: policies.returnPolicyId,
        fulfillmentPolicyId: policies.fulfillmentPolicyId,
      },
    },
  })) as { offerId?: string };
  return data.offerId ?? "";
}

/** Find an existing offer for a SKU (used to re-publish or withdraw). */
export async function getOffersBySku(
  accessToken: string,
  sku: string
): Promise<{ offerId?: string; status?: string }[]> {
  const data = (await ebayFetch(
    accessToken,
    `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&limit=50`
  )) as { offers?: { offerId?: string; status?: string }[] };
  return data.offers ?? [];
}

/** Fetch one offer (includes its listing id once published). */
export async function getOffer(
  accessToken: string,
  offerId: string
): Promise<{ offerId?: string; status?: string; listingId?: string }> {
  return (await ebayFetch(
    accessToken,
    `/sell/inventory/v1/offer/${offerId}`
  )) as { offerId?: string; status?: string; listingId?: string };
}

/** Publish an offer → returns the live eBay listing id. */
export async function publishOffer(
  accessToken: string,
  offerId: string
): Promise<string> {
  const data = (await ebayFetch(
    accessToken,
    `/sell/inventory/v1/offer/${offerId}/publish`,
    { method: "POST" }
  )) as { listingId?: string };
  if (!data.listingId) throw new EbayError("eBay published the offer but returned no listing id.");
  return data.listingId;
}

/** End an offer (unlist). */
export async function withdrawOffer(accessToken: string, offerId: string): Promise<void> {
  await ebayFetch(accessToken, `/sell/inventory/v1/offer/${offerId}/withdraw`, {
    method: "POST",
  });
}

/** All of the seller's inventory items (first page). */
export async function getInventoryItems(
  accessToken: string
): Promise<{ sku: string; quantity: number; title: string }[]> {
  const data = (await ebayFetch(
    accessToken,
    "/sell/inventory/v1/inventory_item?limit=500"
  )) as {
    inventoryItems?: {
      sku?: string;
      product?: { title?: string };
      availability?: { shipToLocationAvailability?: { quantity?: number } };
    }[];
  };
  return (data.inventoryItems ?? []).map((i) => ({
    sku: i.sku ?? "",
    quantity: i.availability?.shipToLocationAvailability?.quantity ?? 0,
    title: i.product?.title ?? "",
  }));
}

/* ── Sell Fulfillment: recent orders ───────────────────────────────── */

export interface EbayOrder {
  orderId: string;
  sku: string;
  title: string;
  quantity: number;
  price: number;
  soldDate: string;
}

/** Orders modified in the last N days, filtered to the given SKUs. */
export async function getRecentOrders(
  accessToken: string,
  skus: Set<string>,
  days = 30
): Promise<EbayOrder[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const until = new Date().toISOString();
  const data = (await ebayFetch(
    accessToken,
    `/sell/fulfillment/v1/order?limit=50&filter=lastmodifieddate:[${since}..${until}]`
  )) as {
    orders?: {
      orderId?: string;
      lastModifiedDate?: string;
      lineItems?: {
        sku?: string;
        title?: string;
        quantity?: number;
        lineItemCost?: { value?: string };
      }[];
    }[];
  };

  const out: EbayOrder[] = [];
  for (const order of data.orders ?? []) {
    for (const line of order.lineItems ?? []) {
      if (!line.sku || !skus.has(line.sku)) continue;
      out.push({
        orderId: order.orderId ?? "",
        sku: line.sku,
        title: line.title ?? "",
        quantity: line.quantity ?? 1,
        price: Number(line.lineItemCost?.value ?? 0),
        soldDate: order.lastModifiedDate ?? new Date().toISOString(),
      });
    }
  }
  return out.sort((a, b) => b.soldDate.localeCompare(a.soldDate));
}
