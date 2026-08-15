import { db } from "@/lib/db/client";
import { daysAgoISO } from "@/lib/format";
import { dec, toNum } from "@/lib/money";
import type { MarketplaceId } from "@/lib/types";
import { DEFAULT_SETTINGS, saveSettings } from "@/lib/db/settings";

/* ── Static reference data (must exist for the app to render) ── */

const MARKETPLACES: {
  id: MarketplaceId;
  name: string;
  tagline: string;
  integration: "official" | "manual";
  sort_order: number;
}[] = [
  { id: "ebay", name: "eBay", tagline: "Your biggest channel — synced automatically.", integration: "official", sort_order: 1 },
  { id: "depop", name: "Depop", tagline: "Core reseller channel, tracked manually for now.", integration: "manual", sort_order: 2 },
  { id: "poshmark", name: "Poshmark", tagline: "Great for bundles and higher-priced pieces.", integration: "manual", sort_order: 3 },
  { id: "vinted", name: "Vinted", tagline: "Fast turnaround on basics and tees.", integration: "manual", sort_order: 4 },
  { id: "mercari", name: "Mercari", tagline: "Not connected yet — add when you start selling there.", integration: "manual", sort_order: 5 },
  { id: "facebook", name: "Facebook Marketplace", tagline: "Great for local pickup on larger items.", integration: "manual", sort_order: 6 },
];

/** Reference rows are required for every account (demo or empty). */
export async function ensureMarketplaces(): Promise<void> {
  const client = db();
  const { error } = await client.from("marketplaces").upsert(MARKETPLACES);
  if (error) throw new Error(error.message);
}

/* ── Demo dataset (relative dates so it always looks current) ── */

interface DemoItem {
  sku: string;
  name: string;
  brand: string;
  category: string;
  size: string;
  era: string;
  condition: string;
  purchasePrice: number;
  listingPrice: number;
  status: "listed" | "draft" | "sold";
  acquiredDaysAgo: number;
  listedDaysAgo?: number;
  marketplaces?: MarketplaceId[];
  soldPrice?: number;
  soldDaysAgo?: number;
  soldOn?: MarketplaceId;
  notes?: string[];
  tags?: string[];
}

const DEMO_ITEMS: DemoItem[] = [
  {
    sku: "VN-1000", name: "Vintage Levi's Trucker Jacket", brand: "Levi's", category: "Jackets & Coats",
    size: "M", era: "90s", condition: "Very good — one small mark", purchasePrice: 28, listingPrice: 95,
    status: "listed", acquiredDaysAgo: 46, listedDaysAgo: 31,
    marketplaces: ["ebay", "depop"],
    notes: ["Classic '90s trucker in the washed-black fade. Tags intact.", "Small mark on left cuff — disclosed in listing."],
    tags: ["90s", "vintage", "workwear"],
  },
  {
    sku: "VN-1001", name: "Carhartt Detroit Work Jacket", brand: "Carhartt", category: "Jackets & Coats",
    size: "L", era: "90s", condition: "Excellent", purchasePrice: 45, listingPrice: 160,
    status: "listed", acquiredDaysAgo: 21, listedDaysAgo: 9,
    marketplaces: ["ebay"],
    notes: ["Duck shell with blanket lining — the grail cut.", "Stored in garment bag; hardware all original."],
    tags: ["90s", "vintage", "grail"],
  },
  {
    sku: "VN-1002", name: "'90s Nike Club Fleece Hoodie", brand: "Nike", category: "Hoodies & Sweats",
    size: "M", era: "90s", condition: "Good — faded wash", purchasePrice: 18, listingPrice: 75,
    status: "listed", acquiredDaysAgo: 38, listedDaysAgo: 25,
    marketplaces: ["depop", "vinted"],
    notes: ["Heavyweight fleece, perfect faded '90s wash."],
    tags: ["90s", "vintage", "streetwear"],
  },
  {
    sku: "VN-1003", name: "Harley-Davidson Motor Tee", brand: "Harley-Davidson", category: "Tops & Tees",
    size: "L", era: "80s", condition: "Excellent — crisp print", purchasePrice: 12, listingPrice: 48,
    status: "listed", acquiredDaysAgo: 52, listedDaysAgo: 40,
    marketplaces: ["ebay", "facebook"],
    notes: ["Single-stitch 80s tee, bold chest print, no cracking."],
    tags: ["80s", "vintage", "streetwear"],
  },
  {
    sku: "VN-1004", name: "Pendleton Wool Flannel", brand: "Pendleton", category: "Flannels & Shirts",
    size: "M", era: "70s", condition: "Very good", purchasePrice: 22, listingPrice: 85,
    status: "listed", acquiredDaysAgo: 60, listedDaysAgo: 48,
    marketplaces: ["ebay", "depop"],
    notes: ["Authentic vintage Pendleton in the board shirt plaid.", "Dry-cleaned and pressed."],
    tags: ["70s", "vintage"],
  },
  {
    sku: "VN-1005", name: "Y2K Columbia Titanium Windbreaker", brand: "Columbia", category: "Outerwear",
    size: "M", era: "2000s", condition: "Excellent", purchasePrice: 15, listingPrice: 65,
    status: "listed", acquiredDaysAgo: 18, listedDaysAgo: 6,
    marketplaces: ["depop", "vinted", "facebook"],
    notes: ["Y2K titanium shell — iridescent olive finish.", "Drawstrings and zips all working."],
    tags: ["y2k", "vintage"],
  },
  {
    sku: "VN-1006", name: "Champion Reverse Weave Crewneck", brand: "Champion", category: "Hoodies & Sweats",
    size: "XL", era: "90s", condition: "Very good", purchasePrice: 25, listingPrice: 90,
    status: "sold", acquiredDaysAgo: 95, soldPrice: 110, soldDaysAgo: 12, soldOn: "depop",
    notes: ["Oversized 90s Reverse Weave, lettering intact."],
    tags: ["90s", "vintage"],
  },
  {
    sku: "VN-1007", name: "Levi's 501 Button-Fly Jeans", brand: "Levi's", category: "Denim & Pants",
    size: "34×32", era: "80s", condition: "Good — natural fade", purchasePrice: 30, listingPrice: 120,
    status: "listed", acquiredDaysAgo: 34, listedDaysAgo: 20,
    marketplaces: ["ebay", "poshmark"],
    notes: ["Great honeycomb fade, all buttons original.", "Wash: original (no soak)."],
    tags: ["80s", "vintage", "denim"],
  },
  {
    sku: "VN-1008", name: "Ralph Lauren Rugby Stripe Polo", brand: "Ralph Lauren", category: "Tops & Tees",
    size: "M", era: "90s", condition: "Excellent", purchasePrice: 14, listingPrice: 60,
    status: "listed", acquiredDaysAgo: 27, listedDaysAgo: 15,
    marketplaces: ["ebay", "poshmark", "facebook"],
    notes: ["Rugby stripes in great condition, embroidered pony."],
    tags: ["90s", "vintage", "preppy"],
  },
  {
    sku: "VN-1009", name: "Patagonia Retro-X Fleece", brand: "Patagonia", category: "Outerwear",
    size: "M", era: "90s", condition: "Excellent", purchasePrice: 40, listingPrice: 140,
    status: "draft", acquiredDaysAgo: 8,
    notes: ["Next lot to photograph — heavyweight fleece, full zip."],
    tags: ["90s", "vintage"],
  },
  {
    sku: "VN-1010", name: "Wrangler Corduroy Jacket", brand: "Wrangler", category: "Jackets & Coats",
    size: "L", era: "70s", condition: "Very good", purchasePrice: 26, listingPrice: 88,
    status: "draft", acquiredDaysAgo: 11,
    notes: ["Earth-tone wale corduroy, western cut."],
    tags: ["70s", "vintage", "workwear"],
  },
  {
    sku: "VN-1011", name: "Tommy Hilfiger Flag Sweater", brand: "Tommy Hilfiger", category: "Knitwear & Sweaters",
    size: "M", era: "90s", condition: "Good — slight pilling", purchasePrice: 20, listingPrice: 78,
    status: "listed", acquiredDaysAgo: 29, listedDaysAgo: 17,
    marketplaces: ["depop", "vinted"],
    notes: ["De-pilled and steamed. Flag knit is clean."],
    tags: ["90s", "vintage", "preppy"],
  },
  {
    sku: "VN-1012", name: "Dickies Eisenhower Jacket", brand: "Dickies", category: "Jackets & Coats",
    size: "M", era: "90s", condition: "Very good", purchasePrice: 24, listingPrice: 82,
    status: "listed", acquiredDaysAgo: 47, listedDaysAgo: 33,
    marketplaces: ["ebay", "depop"],
    tags: ["90s", "workwear"],
  },
  {
    sku: "VN-1013", name: "The North Face Denali Fleece", brand: "The North Face", category: "Outerwear",
    size: "L", era: "90s", condition: "Very good", purchasePrice: 35, listingPrice: 130,
    status: "sold", acquiredDaysAgo: 72, soldPrice: 145, soldDaysAgo: 26, soldOn: "ebay",
    notes: ["Classic Denali with the embroidered logo."],
    tags: ["90s", "vintage", "streetwear"],
  },
];

const STANDALONE_SALES: {
  name: string;
  marketplace: MarketplaceId;
  daysAgo: number;
  price: number;
  fees: number;
  shipping: number;
  cost: number;
}[] = [
  { name: "'90s Starter Pullover", marketplace: "ebay", daysAgo: 61, price: 84, fees: 11.43, shipping: 6.5, cost: 30 },
  { name: "Vintage Levi's Western Shirt", marketplace: "depop", daysAgo: 68, price: 58, fees: 6.1, shipping: 7.2, cost: 19 },
  { name: "Carhartt Beanies (Bundle of 3)", marketplace: "poshmark", daysAgo: 74, price: 74, fees: 14.8, shipping: 9.1, cost: 21 },
  { name: "Nike ACG Fleece", marketplace: "ebay", daysAgo: 81, price: 96, fees: 13.02, shipping: 8.4, cost: 33 },
  { name: "Wrangler Denim Shirt", marketplace: "vinted", daysAgo: 88, price: 44, fees: 2.2, shipping: 5.6, cost: 13 },
  { name: "Columbia Interchange Jacket", marketplace: "ebay", daysAgo: 95, price: 88, fees: 11.96, shipping: 9.8, cost: 35 },
  { name: "Gap Relaxed Fit Tee", marketplace: "depop", daysAgo: 2, price: 115, fees: 11.8, shipping: 7.5, cost: 46 },
  { name: "'80s Champion Sweatshirt", marketplace: "vinted", daysAgo: 5, price: 51, fees: 2.55, shipping: 6.0, cost: 18 },
  { name: "Wrangler Pearl Snap", marketplace: "ebay", daysAgo: 8, price: 68, fees: 9.31, shipping: 7.1, cost: 22 },
  { name: "Levi's Sherpa Trucker", marketplace: "ebay", daysAgo: 6, price: 96, fees: 13.02, shipping: 9.2, cost: 36 },
];

const DEMO_EXPENSES: { category: string; description: string; amount: number; daysAgo: number }[] = [
  { category: "Shipping", description: "USPS Priority Mail — 4 packages", amount: 32.2, daysAgo: 1 },
  { category: "Fees", description: "eBay final value fees (batch)", amount: 41.85, daysAgo: 2 },
  { category: "Packaging & Supplies", description: "Poly mailers ×50", amount: 11.5, daysAgo: 3 },
  { category: "Cleaning & Repair", description: "Dry cleaning — 2 jackets", amount: 28, daysAgo: 4 },
  { category: "Sourcing", description: "Rose Bowl flea market — entry + haul", amount: 85, daysAgo: 6 },
  { category: "Shipping", description: "USPS Ground Advantage — 3 packages", amount: 18.6, daysAgo: 8 },
  { category: "Photography", description: "Garment steamer", amount: 34.99, daysAgo: 10 },
  { category: "Fees", description: "Depop payment + listing fees", amount: 22.4, daysAgo: 11 },
  { category: "Packaging & Supplies", description: "Kraft shipping boxes ×25", amount: 21.75, daysAgo: 13 },
  { category: "Storage", description: "Garment rack + hanger pack", amount: 46, daysAgo: 15 },
  { category: "Software & Tools", description: "Listing & inventory tool (monthly)", amount: 19, daysAgo: 17 },
  { category: "Sourcing", description: "Estate sale purchases", amount: 112, daysAgo: 24 },
];

const DEMO_TASKS: { title: string; dueDaysFromNow: number; kind: string; done: boolean }[] = [
  { title: "Ship 4 orders before the 5 PM cutoff", dueDaysFromNow: 0, kind: "shipping", done: false },
  { title: "Photograph the new Carhartt lot (3 pcs)", dueDaysFromNow: 1, kind: "photo", done: false },
  { title: "Draft listing for Levi's 501 — add measurements", dueDaysFromNow: 1, kind: "listing", done: false },
  { title: "Repost 5 stale Depop listings", dueDaysFromNow: 2, kind: "listing", done: false },
  { title: "Source run: Saturday flea market", dueDaysFromNow: 4, kind: "sourcing", done: false },
  { title: "Respond to 2 offers on the Harley tee", dueDaysFromNow: 0, kind: "general", done: true },
];

/* ── Seeding ──────────────────────────────────────────────────── */

/** Populate the current user's account with a realistic demo shop. */
export async function seedDemoData(): Promise<void> {
  const client = db();
  await ensureMarketplaces();

  // Items (owner stamped by trigger)
  const { data: itemRows, error: itemErr } = await client
    .from("inventory_items")
    .insert(
      DEMO_ITEMS.map((it) => ({
        sku: it.sku,
        name: it.name,
        brand: it.brand,
        category: it.category,
        size: it.size,
        era: it.era,
        condition: it.condition,
        purchase_price: it.purchasePrice,
        listing_price: it.listingPrice,
        status: it.status,
        acquired_date: daysAgoISO(it.acquiredDaysAgo),
        listed_date: it.listedDaysAgo !== undefined ? daysAgoISO(it.listedDaysAgo) : null,
        notes: it.notes ?? [],
        tags: it.tags ?? [],
      }))
    )
    .select("id, sku, status");
  if (itemErr) throw new Error(itemErr.message);

  const bySku = new Map((itemRows ?? []).map((r) => [r.sku as string, r as { id: string; sku: string; status: string }]));

  // Listings + timeline events per item
  const listings: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  for (const it of DEMO_ITEMS) {
    const row = bySku.get(it.sku);
    if (!row) continue;
    if (it.status === "sold" && it.soldOn) {
      listings.push({
        item_id: row.id,
        marketplace_id: it.soldOn,
        status: "sold",
        price: it.soldPrice ?? it.listingPrice,
      });
    } else if (it.status === "listed") {
      for (const m of it.marketplaces ?? []) {
        listings.push({
          item_id: row.id,
          marketplace_id: m,
          status: "live",
          price: it.listingPrice,
          listing_id: `DEMO-${it.sku}-${m}`,
        });
      }
    }

    events.push({
      item_id: row.id,
      kind: "acquired",
      title: "Item acquired",
      description: `Purchased for ${it.purchasePrice.toFixed(2)} USD.`,
      occurred_at: daysAgoISO(it.acquiredDaysAgo) + "T12:00:00Z",
    });
    if (it.status === "listed" && it.listedDaysAgo !== undefined) {
      events.push({
        item_id: row.id,
        kind: "listed",
        title: "Listed for sale",
        description: `Listed at ${it.listingPrice.toFixed(2)} USD.`,
        occurred_at: daysAgoISO(it.listedDaysAgo) + "T12:00:00Z",
      });
    }
    if (it.status === "sold" && it.soldDaysAgo !== undefined) {
      events.push({
        item_id: row.id,
        kind: "sold",
        title: "Sold",
        description: `Sold for ${(it.soldPrice ?? it.listingPrice).toFixed(2)} USD.`,
        occurred_at: daysAgoISO(it.soldDaysAgo) + "T12:00:00Z",
      });
    }
  }
  if (listings.length > 0) {
    const { error } = await client.from("marketplace_listings").insert(listings);
    if (error) throw new Error(error.message);
  }
  if (events.length > 0) {
    const { error } = await client.from("inventory_events").insert(events);
    if (error) throw new Error(error.message);
  }

  // Sales: linked (sold demo items) + standalone
  const sales: Record<string, unknown>[] = [];
  for (const it of DEMO_ITEMS) {
    if (it.status !== "sold" || !it.soldOn || !it.soldDaysAgo) continue;
    const row = bySku.get(it.sku);
    const soldPrice = it.soldPrice ?? it.listingPrice;
    const fees = toNum(dec(soldPrice).times(0.1)); // demo: flat 10% marketplace fee
    const shipping = 7.5;
    const payout = toNum(dec(soldPrice).minus(fees).minus(shipping));
    const profit = toNum(dec(payout).minus(it.purchasePrice));
    sales.push({
      item_id: row?.id ?? null,
      item_name: it.name,
      marketplace_id: it.soldOn,
      sold_date: daysAgoISO(it.soldDaysAgo),
      sold_price: soldPrice,
      fees,
      shipping_cost: shipping,
      payout,
      profit,
    });
  }
  for (const s of STANDALONE_SALES) {
    const payout = toNum(dec(s.price).minus(s.fees).minus(s.shipping));
    const profit = toNum(dec(payout).minus(s.cost));
    sales.push({
      item_id: null,
      item_name: s.name,
      marketplace_id: s.marketplace,
      sold_date: daysAgoISO(s.daysAgo),
      sold_price: s.price,
      fees: s.fees,
      shipping_cost: s.shipping,
      payout,
      profit,
    });
  }
  if (sales.length > 0) {
    const { error } = await client.from("sales").insert(sales);
    if (error) throw new Error(error.message);
  }

  // Expenses
  const { error: expErr } = await client.from("expenses").insert(
    DEMO_EXPENSES.map((e) => ({
      category: e.category,
      description: e.description,
      amount: e.amount,
      date: daysAgoISO(e.daysAgo),
    }))
  );
  if (expErr) throw new Error(expErr.message);

  // Tasks
  const { error: taskErr } = await client.from("tasks").insert(
    DEMO_TASKS.map((t) => ({
      title: t.title,
      due: t.dueDaysFromNow === 0 ? daysAgoISO(0) : new Date(Date.now() + t.dueDaysFromNow * 86400000).toISOString().slice(0, 10),
      kind: t.kind,
      done: t.done,
    }))
  );
  if (taskErr) throw new Error(taskErr.message);

  // Marketplace connections
  const connections: { marketplace_id: MarketplaceId; status: string; account: string | null; sync_type: string; note: string }[] = [
    { marketplace_id: "ebay", status: "connected", account: "my.resale.shop", sync_type: "auto", note: "Listings, sales, and fees pull in automatically once integration is live." },
    { marketplace_id: "depop", status: "connected", account: "@my.resale.shop", sync_type: "manual", note: "Depop has no third-party API — listings are tracked manually." },
    { marketplace_id: "poshmark", status: "connected", account: "@my.resale.shop", sync_type: "manual", note: "Offers and bundles are noted in item history manually." },
    { marketplace_id: "vinted", status: "manual", account: "@my.resale.shop", sync_type: "manual", note: "Connected for tracking — prices and listings stay in sync by hand." },
    { marketplace_id: "mercari", status: "not-connected", account: null, sync_type: "manual", note: "No Mercari account connected." },
    { marketplace_id: "facebook", status: "manual", account: "My Resale Shop", sync_type: "manual", note: "Local listings tracked manually." },
  ];
  const { error: connErr } = await client.from("marketplace_connections").insert(connections);
  if (connErr) throw new Error(connErr.message);

  // Settings
  await saveSettings({
    ...DEFAULT_SETTINGS,
    profile: { ...DEFAULT_SETTINGS.profile, displayName: "", email: "", shopName: "My Vintage Shop" },
  });
}

/** Set up an empty account (no demo rows beyond the reference data). */
export async function emptyOnboarding(): Promise<void> {
  await ensureMarketplaces();
  await saveSettings({
    ...DEFAULT_SETTINGS,
    profile: { ...DEFAULT_SETTINGS.profile, displayName: "", email: "" },
  });
}
