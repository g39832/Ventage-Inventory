/**
 * eBay routes.
 *
 *  GET  /api/marketplaces/ebay/auth/start  → { url } to send the browser to eBay
 *  POST /api/marketplaces/ebay/complete    → exchange ?code= (from the frontend
 *                                            callback route) for tokens
 *  GET  /api/marketplaces/ebay/status      → { configured, connected, username }
 *  POST /api/marketplaces/ebay/disconnect  → remove tokens + connection
 *  POST /api/marketplaces/ebay/list        → publish an app item to eBay
 *  POST /api/marketplaces/ebay/unlist      → end an eBay listing for an app item
 *  POST /api/marketplaces/ebay/sync        → pull live listings + recent orders
 *
 * OAuth round trip:
 *   1. The app opens the eBay authorize URL (state = signed user binding).
 *   2. The user approves → eBay redirects to /ebay/callback?code=…&state=…
 *      (a frontend route; the SPA fallback serves it).
 *   3. The frontend (which holds the Supabase session) POSTs code+state to
 *      /complete. The server verifies the state belongs to that same user,
 *      exchanges the code, and stores the tokens under the user's id via the
 *      user-scoped client — RLS intact, no service-role key anywhere.
 *
 * Every route requires a Supabase session (Bearer token). eBay tokens stay
 * server-side; the browser only ever sees the app's own connection state.
 */

import { Router, type NextFunction, type Request, type Response } from "express";
import { AuthError, userScopedClient, verifyAccessToken } from "../../auth.js";
import {
  buildAuthorizeUrl,
  EbayError,
  exchangeCode,
  requireEbayConfigured,
  signState,
  verifyState,
} from "./oauth.js";
import { ebayConfigured, DEFAULT_EBAY_CATEGORY_ID } from "./config.js";
import {
  EBAY_RESEARCH_LIMIT_GLOBAL_PER_DAY,
  EBAY_RESEARCH_LIMIT_PER_HOUR,
} from "../../env.js";
import {
  createInventoryItem,
  createOffer,
  ensurePolicies,
  getEbayUsername,
  getInventoryItems,
  getOffer,
  getOffersBySku,
  getRecentOrders,
  mapCondition,
  publishOffer,
  withdrawOffer,
} from "./api.js";
import {
  deleteResearch,
  listResearchHistory,
  ResearchRateLimitedError,
  runResearch,
  saveResearch,
} from "./research.js";
import {
  deleteTokenRecord,
  getTokenRecord,
  patchTokenRecord,
  saveTokenRecord,
  withValidAccessToken,
} from "./tokens.js";

export const ebayRouter = Router();

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

function handle(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

/** Verify the bearer token; returns the user id (throws AuthError). */
async function requireUser(req: Request): Promise<string> {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new AuthError("Sign in to manage marketplace connections.");
  const user = await verifyAccessToken(token);
  return user.id;
}

/** Thrown when a user exceeds the hourly cap on eBay actions. */
class EbayRateLimitedError extends Error {}

// In-memory per-user sliding window for the eBay mutating endpoints. eBay's
// own API rate-limits too, but this keeps one misbehaving client from
// hammering the owner's eBay developer app and getting it flagged.
const ebayBuckets = new Map<string, { count: number; resetAt: number }>();
const EBAY_OP_LIMIT_PER_HOUR = 60;

function throttleEbay(userId: string): void {
  const now = Date.now();
  const bucket = ebayBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    ebayBuckets.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > EBAY_OP_LIMIT_PER_HOUR) {
    throw new EbayRateLimitedError(
      "You've hit the hourly limit for eBay actions. Try again in a little while."
    );
  }
}

/* ── Connect: start + complete ─────────────────────────────────────── */

ebayRouter.get(
  "/auth/start",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    requireEbayConfigured();
    res.json({ url: buildAuthorizeUrl(signState(userId)) });
  })
);

ebayRouter.post(
  "/complete",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const state = typeof req.body?.state === "string" ? req.body.state : "";
    if (!code || !state) {
      res.status(400).json({ error: "The eBay callback was missing its code. Please try again." });
      return;
    }
    // The signed state must bind to THIS signed-in user — never another one.
    if (verifyState(state) !== userId) {
      res.status(400).json({ error: "That eBay link was invalid or expired. Please try again." });
      return;
    }

    const tokens = await exchangeCode(code);
    const client = userScopedClient(reqBearerToken(req));
    const username = await getEbayUsername(tokens.access_token);
    await saveTokenRecord(client, userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      ebayUsername: username,
    });
    await client.from("marketplace_connections").upsert(
      {
        owner_id: userId,
        marketplace_id: "ebay",
        status: "connected",
        account: username,
        sync_type: "auto",
        last_sync: new Date().toISOString(),
      },
      { onConflict: "owner_id,marketplace_id" }
    );

    res.json({ ok: true, username });
  })
);

/* ── Status / disconnect ───────────────────────────────────────────── */

ebayRouter.get(
  "/status",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    const client = userScopedClient(reqBearerToken(req));
    const record = await getTokenRecord(client, userId);
    const { data: conn } = await client
      .from("marketplace_connections")
      .select("account")
      .eq("owner_id", userId)
      .eq("marketplace_id", "ebay")
      .maybeSingle();
    res.json({
      configured: ebayConfigured,
      connected: Boolean(record?.refreshToken),
      username: record?.ebayUsername ?? (conn?.account as string | null) ?? null,
    });
  })
);

ebayRouter.post(
  "/disconnect",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    const client = userScopedClient(reqBearerToken(req));
    await deleteTokenRecord(client, userId);
    await client
      .from("marketplace_connections")
      .upsert(
        {
          owner_id: userId,
          marketplace_id: "ebay",
          status: "not-connected",
          account: null,
          sync_type: "manual",
          last_sync: null,
        },
        { onConflict: "owner_id,marketplace_id" }
      );
    res.json({ ok: true });
  })
);

/* ── Settings ──────────────────────────────────────────────────────── */

ebayRouter.post(
  "/settings",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    const categoryId = typeof req.body?.categoryId === "string" ? req.body.categoryId.trim() : "";
    if (!/^\d+$/.test(categoryId)) {
      res.status(400).json({ error: "The eBay category id must be a number." });
      return;
    }
    const client = userScopedClient(reqBearerToken(req));
    await patchTokenRecord(client, userId, { categoryId });
    res.json({ ok: true });
  })
);

/* ── Publish / unlist ──────────────────────────────────────────────── */

ebayRouter.post(
  "/list",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    throttleEbay(userId);
    const itemId = typeof req.body?.itemId === "string" ? req.body.itemId : "";
    if (!itemId) {
      res.status(400).json({ error: "Missing item id." });
      return;
    }
    requireEbayConfigured();

    const client = userScopedClient(reqBearerToken(req));
    const { data: item } = await client
      .from("inventory_items")
      .select("*")
      .eq("id", itemId)
      .is("deleted_at", null)
      .single();
    if (!item) {
      res.status(404).json({ error: "Item not found." });
      return;
    }
    const { data: photos } = await client
      .from("inventory_photos")
      .select("url")
      .eq("item_id", itemId)
      .order("position", { ascending: true });
    const imageUrls = ((photos ?? []) as { url: string }[]).map((p) => p.url);
    if (imageUrls.length === 0) {
      res.status(400).json({
        error: "Add at least one photo to this item before publishing it to eBay.",
      });
      return;
    }

    const { accessToken, record } = await withValidAccessToken(client, userId);

    // 1. Make sure the user has payment/return/fulfillment policies.
    const policies = await ensurePolicies(accessToken, record);
    if (
      policies.paymentPolicyId !== record.paymentPolicyId ||
      policies.returnPolicyId !== record.returnPolicyId ||
      policies.fulfillmentPolicyId !== record.fulfillmentPolicyId
    ) {
      await patchTokenRecord(client, userId, {
        paymentPolicyId: policies.paymentPolicyId ?? null,
        returnPolicyId: policies.returnPolicyId ?? null,
        fulfillmentPolicyId: policies.fulfillmentPolicyId ?? null,
      });
    }

    // 2. The item's own SKU is the eBay SKU (idempotent create/replace).
    const sku = item.sku || `VN-${item.id.slice(0, 8).toUpperCase()}`;
    const payload = {
      sku,
      title: item.name,
      description: item.description ?? item.name,
      imageUrls,
      brand: item.brand ?? undefined,
      condition: mapCondition(item.condition ?? ""),
      price: Number(item.listing_price),
      quantity: Math.max(1, Number(item.quantity) || 1),
      categoryId: record.categoryId || DEFAULT_EBAY_CATEGORY_ID,
    };
    await createInventoryItem(accessToken, payload);

    // 3. Create an offer, or reuse an existing one for this SKU.
    let offerId = "";
    try {
      offerId = await createOffer(accessToken, payload, policies);
    } catch {
      const offers = await getOffersBySku(accessToken, sku);
      offerId = offers.find((o) => o.offerId)?.offerId ?? "";
    }

    // 4. If it's already live, reuse its listing id; otherwise publish.
    let listingId = "";
    if (offerId) {
      const offer = await getOffer(accessToken, offerId);
      if (offer.status === "PUBLISHED" && offer.listingId) {
        listingId = offer.listingId;
      } else {
        listingId = await publishOffer(accessToken, offerId);
      }
    }
    if (!listingId) {
      throw new EbayError("eBay didn't return a listing id. Check the app's eBay setup and try again.");
    }

    // 5. Record the listing + timeline event in the app.
    await client.from("marketplace_listings").upsert(
      {
        item_id: itemId,
        marketplace_id: "ebay",
        status: "live",
        price: Number(item.listing_price),
        listing_id: listingId,
      },
      { onConflict: "item_id,marketplace_id" }
    );
    await client.from("inventory_events").insert({
      item_id: itemId,
      kind: "listed",
      title: "Listed on eBay",
      description: `Published to eBay at ${Number(item.listing_price).toFixed(2)} USD (listing ${listingId}).`,
      occurred_at: new Date().toISOString(),
    });
    await client.from("marketplace_connections").upsert(
      {
        owner_id: userId,
        marketplace_id: "ebay",
        status: "connected",
        last_sync: new Date().toISOString(),
      },
      { onConflict: "owner_id,marketplace_id" }
    );

    res.json({ listingId, offerId });
  })
);

ebayRouter.post(
  "/unlist",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    throttleEbay(userId);
    const itemId = typeof req.body?.itemId === "string" ? req.body.itemId : "";
    if (!itemId) {
      res.status(400).json({ error: "Missing item id." });
      return;
    }
    requireEbayConfigured();

    const client = userScopedClient(reqBearerToken(req));
    const { data: item } = await client
      .from("inventory_items")
      .select("sku")
      .eq("id", itemId)
      .single();
    if (item?.sku) {
      const { accessToken } = await withValidAccessToken(client, userId);
      const offers = await getOffersBySku(accessToken, item.sku);
      const offer = offers.find((o) => o.offerId);
      if (offer?.offerId) {
        try {
          await withdrawOffer(accessToken, offer.offerId);
        } catch {
          // Offer already ended — proceed to mark it down locally.
        }
      }
    }

    await client.from("marketplace_listings").upsert(
      {
        item_id: itemId,
        marketplace_id: "ebay",
        status: "none",
        price: null,
        listing_id: null,
      },
      { onConflict: "item_id,marketplace_id" }
    );
    await client.from("inventory_events").insert({
      item_id: itemId,
      kind: "note",
      title: "Removed from eBay",
      description: "Listing ended on eBay.",
      occurred_at: new Date().toISOString(),
    });

    res.json({ ok: true });
  })
);

/* ── Sync ──────────────────────────────────────────────────────────── */

ebayRouter.post(
  "/sync",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    throttleEbay(userId);
    requireEbayConfigured();
    const client = userScopedClient(reqBearerToken(req));
    const { accessToken } = await withValidAccessToken(client, userId);

    const [{ data: items }, { data: ebayListings }] = await Promise.all([
      client.from("inventory_items").select("id, sku").is("deleted_at", null),
      client
        .from("marketplace_listings")
        .select("item_id")
        .eq("marketplace_id", "ebay")
        .eq("status", "live"),
    ]);
    const appSkus = new Set(
      ((items ?? []) as { sku: string | null }[]).map((i) => i.sku).filter(Boolean) as string[]
    );

    const inventory = await getInventoryItems(accessToken);
    const live = inventory.filter((i) => appSkus.has(i.sku) && i.quantity > 0).length;
    const recentSales = await getRecentOrders(accessToken, appSkus, 30);
    const soldCount = recentSales.reduce((n, o) => n + o.quantity, 0);
    const lastSync = new Date().toISOString();

    await client.from("marketplace_connections").upsert(
      {
        owner_id: userId,
        marketplace_id: "ebay",
        status: "connected",
        last_sync: lastSync,
      },
      { onConflict: "owner_id,marketplace_id" }
    );

    res.json({
      listings: live,
      listed: (ebayListings ?? []).length,
      soldCount,
      recentSales,
      lastSync,
    });
  })
);

/* ── Error handling for this router ────────────────────────────────── */

/* ── Research (item research / sold comps) ───────────────────── */

// Research is read-only and cheap per call, but eBay's Buy API quota is
// per APP KEY and shared by every user — so we add two guard rails: a
// per-user hourly cap and a server-wide daily cap. eBay's own 429s are
// surfaced as ResearchRateLimitedError with a friendly message.
const researchBuckets = new Map<string, { count: number; resetAt: number }>();
const globalResearch = { day: "", count: 0 };

function throttleResearch(userId: string): void {
  const now = Date.now();
  const bucket = researchBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    researchBuckets.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    bucket.count += 1;
    if (bucket.count > EBAY_RESEARCH_LIMIT_PER_HOUR) {
      throw new ResearchRateLimitedError(
        "You've hit the hourly limit for item research. Try again in a little while."
      );
    }
  }
  const day = new Date().toISOString().slice(0, 10);
  if (globalResearch.day !== day) {
    globalResearch.day = day;
    globalResearch.count = 0;
  }
  globalResearch.count += 1;
  if (globalResearch.count > EBAY_RESEARCH_LIMIT_GLOBAL_PER_DAY) {
    throw new ResearchRateLimitedError(
      "Research is temporarily busy across the app. Try again later today."
    );
  }
}

/**
 * POST /api/marketplaces/ebay/research
 * Body: { query: string, save?: boolean }
 * Runs a live eBay research search (active + sold comps) and computes
 * the resale metrics. Set save:true to persist it to the user's
 * research history. Identical queries are cached for 30 minutes.
 */
ebayRouter.post(
  "/research",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    requireEbayConfigured();
    throttleResearch(userId);

    const rawQuery = typeof req.body?.query === "string" ? req.body.query : "";
    const query = rawQuery.trim();
    if (!query) {
      res.status(400).json({ error: "Enter something to search for." });
      return;
    }
    if (query.length > 200) {
      res.status(400).json({ error: "That search is too long — keep it under 200 characters." });
      return;
    }

    const client = userScopedClient(reqBearerToken(req));
    const result = await runResearch(query);
    let saved: { id: string; searchedAt: string } | null = null;
    if (req.body?.save === true) {
      saved = await saveResearch(client, userId, result);
    }
    res.json({ result, saved });
  })
);

/** GET /api/marketplaces/ebay/research/history — the user's saved research. */
ebayRouter.get(
  "/research/history",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    const client = userScopedClient(reqBearerToken(req));
    const history = await listResearchHistory(client, userId);
    res.json({ history });
  })
);

/** DELETE /api/marketplaces/ebay/research/history/:id — remove one save. */
ebayRouter.delete(
  "/research/history/:id",
  handle(async (req, res) => {
    const userId = await requireUser(req);
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!id) {
      res.status(400).json({ error: "Missing research id." });
      return;
    }
    const client = userScopedClient(reqBearerToken(req));
    await deleteResearch(client, userId, id);
    res.json({ ok: true });
  })
);

/* ── Error handling for this router ───────────────────────────── */

ebayRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AuthError) {
    res.status(401).json({ error: err.message });
    return;
  }
  if (err instanceof ResearchRateLimitedError || err instanceof EbayRateLimitedError) {
    res.status(429).json({ error: err.message });
    return;
  }
  if (err instanceof EbayError) {
    res.status(502).json({ error: err.message });
    return;
  }
  console.error("[ebay]", err instanceof Error ? err.message : "unknown error");
  res.status(500).json({ error: "Something went wrong with the eBay connection. Please try again." });
});

/* ── Helpers ───────────────────────────────────────────────────────── */

function reqBearerToken(req: Request): string {
  const auth = req.headers.authorization ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}
