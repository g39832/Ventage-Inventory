/**
 * Controlled context builders for Ask Threadly.
 *
 * Each builder queries ONLY the data relevant to the question, scoped to the
 * authenticated user via RLS (the client carries the user's access token),
 * computes any numbers with Decimal.js, and returns a compact text summary.
 * The model never receives the whole database and can never run SQL itself.
 */

import { Decimal } from "decimal.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DateWindow } from "./dates.js";
import type { Route } from "./router.js";

export interface ContextResult {
  /** Compact, human-readable context handed to the model. */
  context: string;
  /** Item ids the answer references, so the UI can link to them. */
  relatedItemIds?: string[];
  /** Set when no data gathering is needed (the app can answer directly). */
  askWhichItem?: string;
}

/* ── Row shapes (as returned by PostgREST) ───────────────────── */

interface ItemRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  era: string | null;
  condition: string | null;
  status: string;
  listing_price: string | number;
  purchase_price: string | number;
  acquired_date: string | null;
  listed_date: string | null;
  description: string | null;
  notes: string[] | null;
  tags: string[] | null;
}

interface SaleRow {
  id: string;
  item_id: string | null;
  item_name: string;
  marketplace_id: string;
  sold_date: string;
  sold_price: string | number;
  fees: string | number;
  shipping_cost: string | number;
  payout: string | number;
  profit: string | number;
}

interface ExpenseRow {
  id: string;
  category: string;
  description: string;
  amount: string | number;
  date: string;
}

interface ListingRow {
  item_id: string;
  marketplace_id: string;
  status: string;
  price: string | number | null;
}

interface EventRow {
  title: string;
  description: string | null;
  occurred_at: string;
}

interface ConnectionRow {
  marketplace_id: string;
  status: string;
  account: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  due: string | null;
  kind: string;
  done: boolean;
}

/* ── Helpers ─────────────────────────────────────────────────── */

const usd = (v: Decimal.Value) => `$${new Decimal(v).toFixed(2)}`;

const daysHeld = (date: string | null): number => {
  if (!date) return 0;
  const start = new Date(`${date}T00:00:00Z`).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
};

const num = (v: string | number): Decimal => new Decimal(v ?? 0);

function itemLine(i: ItemRow): string {
  const meta = [i.brand, i.category, i.size, i.era].filter(Boolean).join(", ");
  return `- ${i.name} (${meta || "uncategorized"}) — ${i.status} — listed ${usd(i.listing_price)} — bought ${usd(i.purchase_price)}${i.acquired_date ? ` — held ${daysHeld(i.acquired_date)} days` : ""}`;
}

function totals(rows: { sold_price: string | number }[]): Decimal {
  return rows.reduce((acc, r) => acc.plus(num(r.sold_price)), new Decimal(0));
}

/* ── Queries (all run under the user's RLS scope) ────────────── */

const ITEM_COLUMNS =
  "id,name,brand,category,size,era,condition,status,listing_price,purchase_price,acquired_date,listed_date,description,notes,tags";

async function fetchItems(client: SupabaseClient, limit = 25): Promise<ItemRow[]> {
  const { data, error } = await client
    .from("inventory_items")
    .select(ITEM_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRow[];
}

async function fetchOldestUnsold(client: SupabaseClient, limit = 5): Promise<ItemRow[]> {
  const { data, error } = await client
    .from("inventory_items")
    .select(ITEM_COLUMNS)
    .is("deleted_at", null)
    .neq("status", "sold")
    .order("acquired_date", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRow[];
}

async function fetchItem(client: SupabaseClient, itemId: string): Promise<ItemRow | null> {
  const { data, error } = await client
    .from("inventory_items")
    .select(ITEM_COLUMNS)
    .eq("id", itemId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ItemRow | null) ?? null;
}

async function fetchItemDetail(client: SupabaseClient, itemId: string) {
  const [item, listings, events, sales, expenses] = await Promise.all([
    fetchItem(client, itemId),
    client
      .from("marketplace_listings")
      .select("item_id,marketplace_id,status,price")
      .eq("item_id", itemId),
    client
      .from("inventory_events")
      .select("title,description,occurred_at")
      .eq("item_id", itemId)
      .order("occurred_at", { ascending: false })
      .limit(15),
    client
      .from("sales")
      .select("id,item_id,item_name,marketplace_id,sold_date,sold_price,fees,shipping_cost,payout,profit")
      .eq("item_id", itemId)
      .order("sold_date", { ascending: false })
      .limit(10),
    client
      .from("expenses")
      .select("id,category,description,amount,date")
      .eq("item_id", itemId)
      .order("date", { ascending: false })
      .limit(10),
  ]);
  return {
    item: (item as ItemRow | null) ?? null,
    listings: (listings.data ?? []) as ListingRow[],
    events: (events.data ?? []) as EventRow[],
    sales: (sales.data ?? []) as SaleRow[],
    expenses: (expenses.data ?? []) as ExpenseRow[],
  };
}

async function fetchRecentSales(
  client: SupabaseClient,
  limit = 30,
  range?: DateWindow
): Promise<SaleRow[]> {
  let q = client
    .from("sales")
    .select("id,item_id,item_name,marketplace_id,sold_date,sold_price,fees,shipping_cost,payout,profit");
  if (range) q = q.gte("sold_date", range.start).lte("sold_date", range.end);
  const { data, error } = await q.order("sold_date", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SaleRow[];
}

async function fetchRecentExpenses(
  client: SupabaseClient,
  limit = 30,
  range?: DateWindow
): Promise<ExpenseRow[]> {
  let q = client
    .from("expenses")
    .select("id,category,description,amount,date");
  if (range) q = q.gte("date", range.start).lte("date", range.end);
  const { data, error } = await q.order("date", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseRow[];
}

async function fetchConnections(client: SupabaseClient): Promise<ConnectionRow[]> {
  const { data, error } = await client
    .from("marketplace_connections")
    .select("marketplace_id,status,account");
  if (error) throw new Error(error.message);
  return (data ?? []) as ConnectionRow[];
}

async function fetchOpenTasks(client: SupabaseClient, limit = 5): Promise<TaskRow[]> {
  const { data, error } = await client
    .from("tasks")
    .select("id,title,due,kind,done")
    .eq("done", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRow[];
}

async function countItems(
  client: SupabaseClient,
  status?: string
): Promise<number> {
  let q = client
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (status) q = q.eq("status", status);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/* ── Builders ────────────────────────────────────────────────── */

const scopeLabel = (range?: DateWindow, fallback = "recent records in view") =>
  range ? range.label : fallback;

async function buildOverview(
  client: SupabaseClient,
  range?: DateWindow
): Promise<ContextResult> {
  const [total, listed, drafts, sold, items, sales, expenses, tasks] = await Promise.all([
    countItems(client),
    countItems(client, "listed"),
    countItems(client, "draft"),
    countItems(client, "sold"),
    fetchItems(client, 6),
    fetchRecentSales(client, 30, range),
    fetchRecentExpenses(client, 20, range),
    fetchOpenTasks(client),
  ]);

  const revenue = totals(sales);
  const fees = sales.reduce((acc, s) => acc.plus(num(s.fees).plus(num(s.shipping_cost))), new Decimal(0));
  const profit = sales.reduce((acc, s) => acc.plus(num(s.profit)), new Decimal(0));
  const spent = expenses.reduce((acc, e) => acc.plus(num(e.amount)), new Decimal(0));

  const sections = [
    "INVENTORY (computed by Threadly)",
    `- ${total} items total: ${listed} listed, ${drafts} draft, ${sold} sold`,
    "",
    `SALES (${scopeLabel(range, "last 30 recorded")} — computed by Threadly)`,
    `- ${sales.length} sales in view — revenue ${usd(revenue)}, fees+shipping ${usd(fees)}, profit ${usd(profit)}`,
    sales.length
      ? sales.slice(0, 5).map((s) => `- ${s.item_name} — ${usd(s.sold_price)} on ${s.marketplace_id} (${s.sold_date})`).join("\n")
      : "- No sales recorded yet.",
    "",
    `EXPENSES (${scopeLabel(range, "last 20 recorded")} — computed by Threadly)`,
    `- ${usd(spent)} total across ${expenses.length} expenses`,
    "",
    "RECENT ITEMS",
    items.length ? items.map(itemLine).join("\n") : "- No items yet.",
    "",
    "OPEN TASKS",
    tasks.length ? tasks.map((t) => `- ${t.title}${t.due ? ` (due ${t.due})` : ""}`).join("\n") : "- No open tasks.",
  ];

  return { context: sections.join("\n") };
}

async function buildInventory(
  client: SupabaseClient,
  includeUnsold: boolean
): Promise<ContextResult> {
  if (includeUnsold) {
    const oldest = await fetchOldestUnsold(client, 5);
    const sections = [
      "OLDEST UNSOLD ITEMS (computed by Threadly — days held from acquired_date)",
      oldest.length
        ? oldest
            .map(
              (i, n) =>
                `${n + 1}. ${i.name} — ${daysHeld(i.acquired_date)} days (listed ${usd(i.listing_price)}, bought ${usd(i.purchase_price)}, ${i.status})`
            )
            .join("\n")
        : "- No unsold items.",
      "",
      "ALL INVENTORY SNAPSHOT",
      `- ${await countItems(client)} items total`,
    ];
    return {
      context: sections.join("\n"),
      relatedItemIds: oldest.map((i) => i.id),
    };
  }

  const [items, total, listed] = await Promise.all([
    fetchItems(client, 25),
    countItems(client),
    countItems(client, "listed"),
  ]);
  return {
    context: [
      "INVENTORY (computed by Threadly)",
      `- ${total} items total, ${listed} currently listed`,
      "",
      items.length ? items.map(itemLine).join("\n") : "- No items yet.",
    ].join("\n"),
  };
}

async function buildOldestUnsold(client: SupabaseClient): Promise<ContextResult> {
  return buildInventory(client, true);
}

async function buildFinancials(
  client: SupabaseClient,
  range?: DateWindow
): Promise<ContextResult> {
  const [sales, expenses] = await Promise.all([
    fetchRecentSales(client, 60, range),
    fetchRecentExpenses(client, 60, range),
  ]);

  const revenue = totals(sales);
  const fees = sales.reduce((acc, s) => acc.plus(num(s.fees)), new Decimal(0));
  const shipping = sales.reduce((acc, s) => acc.plus(num(s.shipping_cost)), new Decimal(0));
  const profit = sales.reduce((acc, s) => acc.plus(num(s.profit)), new Decimal(0));
  const spent = expenses.reduce((acc, e) => acc.plus(num(e.amount)), new Decimal(0));
  const net = profit.minus(spent);

  const byItem = new Map<string, { name: string; profit: Decimal; id: string }>();
  for (const s of sales) {
    const entry = byItem.get(s.item_name) ?? { name: s.item_name, profit: new Decimal(0), id: s.item_id ?? "" };
    entry.profit = entry.profit.plus(num(s.profit));
    byItem.set(s.item_name, entry);
  }
  const top = [...byItem.values()]
    .sort((a, b) => b.profit.minus(a.profit).toNumber())
    .slice(0, 5);

  return {
    context: [
      `FINANCIALS (${scopeLabel(range, "recent records")} — computed by Threadly)`,
      `- ${sales.length} sales in view — revenue ${usd(revenue)}`,
      `- Marketplace fees ${usd(fees)} · shipping ${usd(shipping)}`,
      `- Profit after cost of goods ${usd(profit)}`,
      `- Expenses ${usd(spent)} across ${expenses.length} expenses`,
      `- Net after expenses ${usd(net)}`,
      "",
      "MOST PROFITABLE ITEMS IN VIEW",
      top.length
        ? top.map((t, n) => `${n + 1}. ${t.name} — ${usd(t.profit)}`).join("\n")
        : "- No profitable sales in view.",
    ].join("\n"),
    relatedItemIds: top.map((t) => t.id).filter(Boolean),
  };
}

async function buildExpenses(
  client: SupabaseClient,
  range?: DateWindow
): Promise<ContextResult> {
  const expenses = await fetchRecentExpenses(client, 40, range);
  const byCategory = new Map<string, Decimal>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? new Decimal(0)).plus(num(e.amount)));
  }
  const total = expenses.reduce((acc, e) => acc.plus(num(e.amount)), new Decimal(0));
  const rows = [...byCategory.entries()].sort((a, b) => b[1].minus(a[1]).toNumber());

  return {
    context: [
      `EXPENSES (${scopeLabel(range, "recent records")} — computed by Threadly)`,
      `- ${usd(total)} total across ${expenses.length} expenses in view`,
      "",
      "BY CATEGORY",
      rows.length ? rows.map(([c, v]) => `- ${c}: ${usd(v)}`).join("\n") : "- No expenses recorded yet.",
      "",
      "RECENT EXPENSES",
      expenses.length
        ? expenses.slice(0, 8).map((e) => `- ${e.description || e.category} — ${usd(e.amount)} (${e.date})`).join("\n")
        : "- No expenses recorded yet.",
    ].join("\n"),
  };
}

async function buildMarketplaces(
  client: SupabaseClient,
  range?: DateWindow
): Promise<ContextResult> {
  const [sales, connections] = await Promise.all([
    fetchRecentSales(client, 100, range),
    fetchConnections(client),
  ]);

  const perChannel = new Map<string, { revenue: Decimal; count: number }>();
  for (const s of sales) {
    const entry = perChannel.get(s.marketplace_id) ?? { revenue: new Decimal(0), count: 0 };
    entry.revenue = entry.revenue.plus(num(s.sold_price));
    entry.count += 1;
    perChannel.set(s.marketplace_id, entry);
  }

  const top = [...perChannel.entries()].sort((a, b) => b[1].revenue.minus(a[1].revenue).toNumber());
  const connStatus = new Map(connections.map((c) => [c.marketplace_id, c.status]));

  return {
    context: [
      `MARKETPLACE ACTIVITY (${scopeLabel(range, "recent sales")} — computed by Threadly)`,
      `- Filtering: ${range ? `${range.start} → ${range.end}` : "no date filter — latest records"}`,
      top.length
        ? top.map(([m, v], n) => `${n + 1}. ${m} — ${v.count} sale${v.count === 1 ? "" : "s"}, ${usd(v.revenue)}`).join("\n")
        : "- No marketplace sales recorded yet.",
      "",
      "CONNECTION STATUS (tracked in Threadly — not live API integrations)",
      [...connStatus.entries()]
        .map(([m, s]) => `- ${m}: ${s}`)
        .join("\n") || "- No marketplace connections set up.",
    ].join("\n"),
  };
}

async function buildItem(client: SupabaseClient, itemId: string): Promise<ContextResult> {
  const { item, listings, events, sales, expenses } = await fetchItemDetail(client, itemId);
  if (!item) {
    return {
      context: "That item could not be found in this account.",
      relatedItemIds: [],
    };
  }

  const sections = [
    "ITEM (from your inventory)",
    `- ${item.name} — ${item.brand ?? "no brand"} · ${item.category ?? "uncategorized"} · ${item.size ?? "no size"} · ${item.era ?? ""}`,
    `- Status: ${item.status} · Condition: ${item.condition ?? "not set"}`,
    item.description ? `- Description: ${item.description}` : "- Description: not set",
    `- Listed at ${usd(item.listing_price)} · Bought ${usd(item.purchase_price)} · Held ${daysHeld(item.acquired_date)} days`,
    "",
    "MARKETPLACE LISTINGS",
    listings.length
      ? listings.map((l) => `- ${l.marketplace_id}: ${l.status}${l.price ? ` at ${usd(l.price)}` : ""}`).join("\n")
      : "- Not listed anywhere yet.",
  ];

  if (sales.length) {
    sections.push(
      "",
      "SALES",
      sales.map((s) => `- ${usd(s.sold_price)} on ${s.marketplace_id} (${s.sold_date}) — payout ${usd(s.payout)}, profit ${usd(s.profit)}`).join("\n")
    );
  }
  if (expenses.length) {
    sections.push(
      "",
      "EXPENSES ON THIS ITEM",
      expenses.map((e) => `- ${e.description || e.category} — ${usd(e.amount)} (${e.date})`).join("\n")
    );
  }
  sections.push(
    "",
    "ITEM NOTES & TIMELINE",
    events.length
      ? events.slice(0, 6).map((e) => `- ${e.title}${e.description ? `: ${e.description}` : ""}`).join("\n")
      : "- No timeline events.",
    item.notes?.length ? `Notes: ${item.notes.join(" | ")}` : "Notes: none"
  );

  return { context: sections.join("\n"), relatedItemIds: [item.id] };
}

/* ── Entry point ─────────────────────────────────────────────── */

export async function buildContext(
  client: SupabaseClient,
  _userId: string,
  r: Route,
  range?: DateWindow
): Promise<ContextResult> {
  switch (r.kind) {
    case "listing-content":
      if (!r.itemId) {
        return {
          context: "",
          askWhichItem:
            "Which item would you like help with? Open an item and choose “Improve listing”, or tell me the item's name and I'll find it.",
        };
      }
      return buildItem(client, r.itemId);
    case "item":
      return buildItem(client, r.itemId);
    case "oldest-unsold":
      return buildOldestUnsold(client);
    case "financials":
      return buildFinancials(client, range);
    case "expenses":
      return buildExpenses(client, range);
    case "marketplaces":
      return buildMarketplaces(client, range);
    case "inventory":
      return buildInventory(client, false);
    case "overview":
      return buildOverview(client, range);
  }
}
