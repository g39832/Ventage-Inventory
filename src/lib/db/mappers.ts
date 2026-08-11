import type {
  Item,
  MarketplaceConnection,
  MarketplaceId,
  MarketplaceListing,
  Sale,
  Expense,
  Task,
  TimelineEvent,
} from "@/lib/types";
import { CATEGORY_HEROES, GALLERY_POOL, img } from "@/lib/mock/images";

/* ── Raw row shapes (as returned by PostgREST) ───────────────────── */

export interface ItemRow {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  era: string | null;
  condition: string | null;
  description: string | null;
  purchase_price: number;
  listing_price: number;
  status: Item["status"];
  acquired_date: string;
  listed_date: string | null;
  notes: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ListingRow {
  item_id: string;
  marketplace_id: MarketplaceId;
  status: "live" | "sold" | "none";
  price: number | null;
  listing_id: string | null;
}

export interface EventRow {
  id: string;
  item_id: string;
  kind: TimelineEvent["kind"];
  title: string;
  description: string | null;
  occurred_at: string;
}

export interface SaleRow {
  id: string;
  item_id: string | null;
  item_name: string;
  marketplace_id: MarketplaceId;
  sold_date: string;
  sold_price: number;
  fees: number;
  shipping_cost: number;
  payout: number;
  profit: number;
}

export interface ExpenseRow {
  id: string;
  item_id: string | null;
  category: string;
  description: string;
  amount: number;
  date: string;
  notes: string | null;
}

export interface TaskRow {
  id: string;
  title: string;
  due: string | null;
  kind: Task["kind"];
  done: boolean;
}

export interface ConnectionRow {
  marketplace_id: MarketplaceId;
  status: "connected" | "manual" | "not-connected";
  account: string | null;
  sync_type: "auto" | "manual";
  note: string | null;
  last_sync: string | null;
}

export interface MarketplaceRow {
  id: MarketplaceId;
  name: string;
  tagline: string;
  integration: "official" | "manual";
  sort_order: number;
}

/* ── Placeholder images (real photo uploads land in Phase 3) ─────── */

export function placeholderImages(category: string | null | undefined, idx: number): string[] {
  const heroes = CATEGORY_HEROES[category ?? "Tops & Tees"] ?? CATEGORY_HEROES["Tops & Tees"];
  const hero = heroes[idx % heroes.length];
  return [
    img(hero, 1100),
    img(GALLERY_POOL[idx % GALLERY_POOL.length], 900),
    img(GALLERY_POOL[(idx + 2) % GALLERY_POOL.length], 900),
    img(GALLERY_POOL[(idx + 4) % GALLERY_POOL.length], 900),
  ];
}

/* ── Row → app type ──────────────────────────────────────────────── */

export function mapItem(
  row: ItemRow,
  listings: ListingRow[],
  events: EventRow[],
  sale: SaleRow | undefined,
  idx: number
): Item {
  const marketplaces: Partial<Record<MarketplaceId, MarketplaceListing>> = {};
  for (const l of listings) {
    marketplaces[l.marketplace_id] = {
      status: l.status,
      price: l.price ?? undefined,
      listingId: l.listing_id ?? undefined,
    };
  }

  const timeline: TimelineEvent[] = events.map((e) => ({
    date: e.occurred_at.slice(0, 10),
    title: e.title,
    description: e.description ?? undefined,
    kind: e.kind,
  }));

  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? "",
    category: row.category ?? "",
    size: row.size ?? "",
    era: row.era ?? "",
    condition: row.condition ?? "",
    description: row.description ?? "",
    sku: row.sku ?? "",
    purchasePrice: Number(row.purchase_price),
    listingPrice: Number(row.listing_price),
    status: row.status,
    soldPrice: sale?.sold_price,
    soldDate: sale?.sold_date,
    soldOn: sale?.marketplace_id,
    marketplaces,
    images: placeholderImages(row.category, idx),
    acquiredDate: row.acquired_date,
    listedDate: row.listed_date ?? undefined,
    notes: row.notes,
    tags: row.tags,
    timeline,
  };
}

export function mapSale(row: SaleRow, idx: number, item?: Item): Sale {
  return {
    id: row.id,
    itemId: row.item_id ?? undefined,
    itemName: row.item_name,
    thumbnail: item?.images[0] ?? placeholderImages(undefined, idx)[0],
    marketplace: row.marketplace_id,
    soldDate: row.sold_date,
    soldPrice: Number(row.sold_price),
    fees: Number(row.fees),
    shippingCost: Number(row.shipping_cost),
    payout: Number(row.payout),
    profit: Number(row.profit),
  };
}

export function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    category: row.category as Expense["category"],
    description: row.description,
    amount: Number(row.amount),
    date: row.date,
    itemId: row.item_id ?? undefined,
  };
}

export function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    due: row.due ?? undefined,
    kind: row.kind,
    done: row.done,
  };
}

export function mapConnection(
  mp: MarketplaceRow,
  conn: ConnectionRow | undefined
): MarketplaceConnection {
  return {
    id: mp.id,
    name: mp.name,
    tagline: mp.tagline,
    status: conn?.status ?? "not-connected",
    account: conn?.account ?? undefined,
    // Filled in by the store from live listings once items are loaded.
    listings: 0,
    lastSync: conn?.last_sync ?? undefined,
    syncType: conn?.sync_type ?? "manual",
    note: conn?.note ?? "",
  };
}
