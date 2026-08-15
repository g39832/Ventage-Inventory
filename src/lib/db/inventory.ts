import { db } from "@/lib/db/client";
import {
  mapExpense,
  mapItem,
  mapSale,
  placeholderImages,
  type EventRow,
  type ExpenseRow,
  type ItemRow,
  type ListingRow,
  type SaleRow,
} from "@/lib/db/mappers";
import { toISODate } from "@/lib/format";
import { dec, toNum } from "@/lib/money";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";
import type {
  Expense,
  ExpenseCategory,
  Item,
  MarketplaceId,
  MarketplaceListing,
  Sale,
  TimelineEvent,
} from "@/lib/types";

export interface NewItemInput {
  name: string;
  brand: string;
  category: string;
  size?: string;
  era?: string;
  condition?: string;
  description?: string;
  purchasePrice: number;
  listingPrice: number;
  status: "listed" | "draft";
  notes?: string[];
  tags?: string[];
  marketplaces?: MarketplaceId[];
  sku?: string;
  acquiredDate?: string;
  listedDate?: string;
}

export interface ItemPatch {
  name?: string;
  brand?: string;
  category?: string;
  size?: string;
  era?: string;
  condition?: string;
  description?: string;
  purchasePrice?: number;
  listingPrice?: number;
  notes?: string[];
  tags?: string[];
  status?: Item["status"];
}

export interface MarkSoldInput {
  soldPrice: number;
  fees: number;
  shippingCost: number;
  marketplace: MarketplaceId;
  soldDate?: string;
}

export interface ItemExpenseInput {
  amount: number;
  category: ExpenseCategory;
  description: string;
}

const COLUMN_MAP: Record<string, string> = {
  name: "name",
  brand: "brand",
  category: "category",
  size: "size",
  era: "era",
  condition: "condition",
  description: "description",
  purchasePrice: "purchase_price",
  listingPrice: "listing_price",
  notes: "notes",
  tags: "tags",
  status: "status",
};

/** Fetch one item (plus its listings/events/sale) as an app Item. */
async function fetchAppItem(id: string): Promise<Item> {
  const client = db();
  const { data: row, error } = await client
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw new Error(error.message);
  const [{ data: listings }, { data: events }, { data: sales }] = await Promise.all([
    client.from("marketplace_listings").select("*").eq("item_id", id),
    client.from("inventory_events").select("*").eq("item_id", id).order("occurred_at", { ascending: true }),
    client.from("sales").select("*").eq("item_id", id),
  ]);
  const sale = sales?.find((s) => s.item_id === id);
  return mapItem(row as ItemRow, (listings ?? []) as ListingRow[], (events ?? []) as EventRow[], sale as SaleRow | undefined, 0);
}

export async function listItems(): Promise<Item[]> {
  const client = db();
  const [{ data: itemRows, error: itemErr }, { data: listingRows, error: listErr }, { data: eventRows, error: evErr }, { data: saleRows, error: saleErr }] =
    await Promise.all([
      client.from("inventory_items").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      client.from("marketplace_listings").select("*"),
      client.from("inventory_events").select("*").order("occurred_at", { ascending: true }),
      client.from("sales").select("*"),
    ]);
  if (itemErr) throw new Error(itemErr.message);
  if (listErr) throw new Error(listErr.message);
  if (evErr) throw new Error(evErr.message);
  if (saleErr) throw new Error(saleErr.message);

  const listingsByItem = new Map<string, ListingRow[]>();
  for (const l of (listingRows ?? []) as ListingRow[]) {
    const arr = listingsByItem.get(l.item_id) ?? [];
    arr.push(l);
    listingsByItem.set(l.item_id, arr);
  }
  const eventsByItem = new Map<string, EventRow[]>();
  for (const e of (eventRows ?? []) as EventRow[]) {
    const arr = eventsByItem.get(e.item_id) ?? [];
    arr.push(e);
    eventsByItem.set(e.item_id, arr);
  }
  const saleByItem = new Map<string, SaleRow>();
  for (const s of (saleRows ?? []) as SaleRow[]) {
    if (s.item_id && !saleByItem.has(s.item_id)) saleByItem.set(s.item_id, s);
  }

  return (itemRows ?? []).map((row, i) =>
    mapItem(
      row as ItemRow,
      listingsByItem.get((row as ItemRow).id) ?? [],
      eventsByItem.get((row as ItemRow).id) ?? [],
      saleByItem.get((row as ItemRow).id),
      i
    )
  );
}

export async function createItem(input: NewItemInput): Promise<Item> {
  const client = db();
  const now = new Date().toISOString();
  const today = toISODate(new Date());
  const sku = input.sku?.trim() || `VN-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const listed = input.status === "listed";

  const { data, error } = await client
    .from("inventory_items")
    .insert({
      sku,
      name: input.name.trim(),
      brand: input.brand.trim(),
      category: input.category,
      size: input.size ?? "",
      era: input.era ?? "",
      condition: input.condition ?? "",
      description: input.description?.trim() ?? "",
      purchase_price: input.purchasePrice,
      listing_price: input.listingPrice,
      status: input.status,
      acquired_date: input.acquiredDate ?? today,
      listed_date: listed ? input.listedDate ?? today : null,
      notes: input.notes ?? [],
      tags: input.tags ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const row = data as ItemRow;

  const events: { item_id: string; kind: TimelineEvent["kind"]; title: string; description: string; occurred_at: string }[] = [
    {
      item_id: row.id,
      kind: "acquired",
      title: "Item acquired",
      description: `Purchased for ${input.purchasePrice.toFixed(2)} USD.`,
      occurred_at: now,
    },
  ];
  if (listed) {
    events.push({
      item_id: row.id,
      kind: "listed",
      title: "Listed for sale",
      description: `Listed at ${input.listingPrice.toFixed(2)} USD.`,
      occurred_at: now,
    });
  }
  const { error: evErr } = await client.from("inventory_events").insert(events);
  if (evErr) throw new Error(evErr.message);

  const listings: ListingRow[] = [];
  if (listed) {
    for (const [i, m] of (input.marketplaces ?? []).entries()) {
      listings.push({
        item_id: row.id,
        marketplace_id: m,
        status: "live",
        price: input.listingPrice,
        listing_id: `LST-${row.id.slice(0, 8).toUpperCase()}-${i + 1}`,
      });
    }
    if (listings.length > 0) {
      const { error: lstErr } = await client.from("marketplace_listings").insert(listings);
      if (lstErr) throw new Error(lstErr.message);
    }
  }

  const marketplaces: Partial<Record<MarketplaceId, MarketplaceListing>> = {};
  for (const l of listings) {
    marketplaces[l.marketplace_id] = {
      status: l.status,
      price: l.price ?? undefined,
      listingId: l.listing_id ?? undefined,
    };
  }

  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? "",
    category: row.category ?? "",
    size: row.size ?? "",
    era: row.era ?? "",
    condition: row.condition ?? "",
    description: (row as ItemRow).description ?? "",
    sku: row.sku ?? "",
    purchasePrice: Number(row.purchase_price),
    listingPrice: Number(row.listing_price),
    status: row.status,
    marketplaces,
    images: placeholderImages(row.category, 0),
    acquiredDate: row.acquired_date,
    listedDate: row.listed_date ?? undefined,
    notes: row.notes,
    tags: row.tags,
    timeline: events.map((e) => ({
      date: e.occurred_at.slice(0, 10),
      title: e.title,
      description: e.description,
      kind: e.kind,
    })),
  };
}

export async function updateItem(id: string, patch: ItemPatch): Promise<Item> {
  const client = db();
  const { data: current } = await client.from("inventory_items").select("*").eq("id", id).single();
  if (!current) throw new Error("Item not found.");

  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    update[COLUMN_MAP[key] ?? key] = value;
  }
  const { error } = await client.from("inventory_items").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  // Keep live listings' price in sync when the listing price changes.
  const priceChanged =
    patch.listingPrice !== undefined && patch.listingPrice !== Number(current.listing_price);
  if (priceChanged) {
    const { data: live } = await client
      .from("marketplace_listings")
      .select("*")
      .eq("item_id", id)
      .eq("status", "live");
    if ((live ?? []).length > 0) {
      const updates = (live as ListingRow[]).map((l) => ({
        item_id: l.item_id,
        marketplace_id: l.marketplace_id,
        status: l.status,
        price: patch.listingPrice!,
        listing_id: l.listing_id,
      }));
      const { error: lstErr } = await client
        .from("marketplace_listings")
        .upsert(updates, { onConflict: "item_id,marketplace_id" });
      if (lstErr) throw new Error(lstErr.message);
    }
  }

  // Record the change on the timeline.
  const now = new Date().toISOString();
  if (priceChanged) {
    await client.from("inventory_events").insert({
      item_id: id,
      kind: "price",
      title: "Price changed",
      description: `Pricing updated from ${Number(current.listing_price).toFixed(2)} to ${patch.listingPrice!.toFixed(2)} USD.`,
      occurred_at: now,
    });
  } else {
    await client.from("inventory_events").insert({
      item_id: id,
      kind: "note",
      title: "Item updated",
      description: "Details were edited.",
      occurred_at: now,
    });
  }

  return fetchAppItem(id);
}

/** Soft-delete: sets deleted_at so the item disappears from the app. */
export async function archiveItem(id: string): Promise<void> {
  const client = db();
  const { error } = await client
    .from("inventory_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await client.from("inventory_events").insert({
    item_id: id,
    kind: "note",
    title: "Item archived",
    description: "Moved out of active inventory.",
    occurred_at: new Date().toISOString(),
  });
}

export async function markSold(item: Item, input: MarkSoldInput): Promise<{ item: Item; sale: Sale }> {
  const client = db();
  const soldDate = input.soldDate ?? toISODate(new Date());
  const payout = toNum(dec(input.soldPrice).minus(input.fees).minus(input.shippingCost));
  const profit = toNum(dec(payout).minus(item.purchasePrice));

  const { error: statusErr } = await client
    .from("inventory_items")
    .update({ status: "sold" })
    .eq("id", item.id);
  if (statusErr) throw new Error(statusErr.message);

  await client
    .from("marketplace_listings")
    .upsert(
      {
        item_id: item.id,
        marketplace_id: input.marketplace,
        status: "sold",
        price: input.soldPrice,
      },
      { onConflict: "item_id,marketplace_id" }
    );

  const { data: saleRow, error: saleErr } = await client
    .from("sales")
    .insert({
      item_id: item.id,
      item_name: item.name,
      marketplace_id: input.marketplace,
      sold_date: soldDate,
      sold_price: input.soldPrice,
      fees: input.fees,
      shipping_cost: input.shippingCost,
      payout,
      profit,
    })
    .select()
    .single();
  if (saleErr) throw new Error(saleErr.message);

  await client.from("inventory_events").insert({
    item_id: item.id,
    kind: "sold",
    title: "Sold",
    description: `Sold for ${input.soldPrice.toFixed(2)} USD on ${MARKETPLACE_META[input.marketplace].name}.`,
    occurred_at: new Date().toISOString(),
  });

  const updated = await fetchAppItem(item.id);
  return { item: updated, sale: mapSale(saleRow as SaleRow, 0, updated) };
}

export async function addNote(itemId: string, note: string): Promise<void> {
  const client = db();
  const { data: current } = await client
    .from("inventory_items")
    .select("notes")
    .eq("id", itemId)
    .single();
  if (!current) throw new Error("Item not found.");
  const notes = [...(current.notes ?? []), note.trim()];
  const { error } = await client.from("inventory_items").update({ notes }).eq("id", itemId);
  if (error) throw new Error(error.message);
  await client.from("inventory_events").insert({
    item_id: itemId,
    kind: "note",
    title: "Note added",
    description: note.trim(),
    occurred_at: new Date().toISOString(),
  });
}

export async function addTimelineNote(itemId: string, note: string): Promise<void> {
  const client = db();
  const { error } = await client.from("inventory_events").insert({
    item_id: itemId,
    kind: "note",
    title: "Timeline note",
    description: note.trim(),
    occurred_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** List an item on a marketplace, or remove it from one. */
export async function setListingStatus(
  item: Item,
  marketplaceId: MarketplaceId,
  status: "live" | "none"
): Promise<Item> {
  const client = db();
  const existing = item.marketplaces[marketplaceId];
  const now = new Date().toISOString();

  await client
    .from("marketplace_listings")
    .upsert(
      {
        item_id: item.id,
        marketplace_id: marketplaceId,
        status,
        price: status === "live" ? item.listingPrice : existing?.price ?? item.listingPrice,
        listing_id:
          status === "live"
            ? existing?.listingId ?? `LST-${item.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`
            : existing?.listingId,
      },
      { onConflict: "item_id,marketplace_id" }
    );

  await client.from("inventory_events").insert({
    item_id: item.id,
    kind: status === "live" ? "listed" : "note",
    title: status === "live" ? `Listed on ${MARKETPLACE_META[marketplaceId].name}` : `Removed from ${MARKETPLACE_META[marketplaceId].name}`,
    description:
      status === "live"
        ? `Listed at ${item.listingPrice.toFixed(2)} USD.`
        : "Listing taken down.",
    occurred_at: now,
  });

  return fetchAppItem(item.id);
}

/**
 * Record a REAL eBay listing (id from the eBay API) or clear it, and add a
 * timeline event. Used after publishToEbay / unlistFromEbay succeed.
 */
export async function updateEbayListing(
  item: Item,
  patch: { status: "live" | "none"; listingId?: string; price?: number }
): Promise<Item> {
  const client = db();
  const now = new Date().toISOString();

  await client
    .from("marketplace_listings")
    .upsert(
      {
        item_id: item.id,
        marketplace_id: "ebay" as const,
        status: patch.status,
        price: patch.price ?? (patch.status === "live" ? item.listingPrice : null),
        listing_id: patch.listingId ?? null,
      },
      { onConflict: "item_id,marketplace_id" }
    );

  await client.from("inventory_events").insert({
    item_id: item.id,
    kind: patch.status === "live" ? "listed" : "note",
    title: patch.status === "live" ? "Listed on eBay" : "Removed from eBay",
    description:
      patch.status === "live"
        ? `Published to eBay (listing ${patch.listingId ?? ""}).`
        : "Listing ended on eBay.",
    occurred_at: now,
  });

  return fetchAppItem(item.id);
}

/** Log an expense that attaches to a specific item. */
export async function addItemExpense(
  item: Item,
  input: ItemExpenseInput
): Promise<Expense> {
  const client = db();
  const { data, error } = await client
    .from("expenses")
    .insert({
      item_id: item.id,
      category: input.category,
      description: input.description.trim() || `Expense for ${item.name}`,
      amount: input.amount,
      date: toISODate(new Date()),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await client.from("inventory_events").insert({
    item_id: item.id,
    kind: "expense",
    title: "Expense added",
    description: `${input.category} — ${input.amount.toFixed(2)} USD.`,
    occurred_at: new Date().toISOString(),
  });

  return mapExpense(data as ExpenseRow);
}
