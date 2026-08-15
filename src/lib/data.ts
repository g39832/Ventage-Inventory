/**
 * Pure computation helpers for Ventage.
 *
 * These take the data (items/sales/expenses) as arguments so they can run
 * against whatever the store currently holds — no module-level constants,
 * no hardcoded dates. All money math goes through lib/money.ts (decimal.js)
 * and every time window is derived from the real current date.
 */

import type {
  CategorySlice,
  ChartPoint,
  Item,
  MarketplaceSlice,
  Sale,
  Expense,
  MarketplaceId,
} from "@/lib/types";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";
import { format } from "date-fns";
import { daysAgoISO, monthLabel, toISODate } from "@/lib/format";
import { dec, div, subToNum, sumToNum, toNum } from "@/lib/money";

/* ── Lookups ─────────────────────────────────────────────────────── */

export function getItem(items: Item[], id: string): Item | undefined {
  return items.find((i) => i.id === id);
}

export function getSalesForItem(sales: Sale[], itemId: string): Sale[] {
  return sales.filter((s) => s.itemId === itemId);
}

/* ── Per-item money ──────────────────────────────────────────────── */

/** Expected profit: sale price (or listing price) minus cost of goods. */
export function itemProfit(item: Item): number {
  const base =
    item.status === "sold" ? (item.soldPrice ?? item.listingPrice) : item.listingPrice;
  return subToNum(base, item.purchasePrice);
}

/** Profit margin as a ratio (0..1) against the price the item sells for. */
export function itemMargin(item: Item): number {
  const base =
    item.status === "sold" ? (item.soldPrice ?? item.listingPrice) : item.listingPrice;
  if (dec(base).lte(0)) return 0;
  return toNum(div(itemProfit(item), base));
}

/* ── Inventory KPIs ──────────────────────────────────────────────── */

export interface InventoryKpis {
  inventoryCount: number;
  activeListings: number;
  draftCount: number;
  soldCount: number;
  inventoryValue: number;
  costOfGoods: number;
}

export function computeInventoryKpis(items: Item[]): InventoryKpis {
  return {
    inventoryCount: items.length,
    activeListings: items.filter((i) => i.status === "listed").length,
    draftCount: items.filter((i) => i.status === "draft").length,
    soldCount: items.filter((i) => i.status === "sold").length,
    inventoryValue: sumToNum(
      items.filter((i) => i.status !== "sold").map((i) => i.listingPrice)
    ),
    costOfGoods: sumToNum(items.map((i) => i.purchasePrice)),
  };
}

/* ── Sales KPIs ──────────────────────────────────────────────────── */

export interface SalesKpis {
  totalSales: number;
  grossRevenue: number;
  totalFees: number;
  totalShipping: number;
  totalPayout: number;
  totalProfit: number;
  avgSale: number;
}

export function computeSalesKpis(sales: Sale[]): SalesKpis {
  const grossRevenue = sumToNum(sales.map((s) => s.soldPrice));
  return {
    totalSales: sales.length,
    grossRevenue,
    totalFees: sumToNum(sales.map((s) => s.fees)),
    totalShipping: sumToNum(sales.map((s) => s.shippingCost)),
    totalPayout: sumToNum(sales.map((s) => s.payout)),
    totalProfit: sumToNum(sales.map((s) => s.profit)),
    avgSale: toNum(div(grossRevenue, Math.max(1, sales.length))),
  };
}

/* ── Money KPIs (periods derived from the real current date) ─────── */

export interface MoneyKpis {
  profitLast30: number;
  expensesLast30: number;
  monthRevenue: number;
  monthProfit: number;
  monthExpenses: number;
  totalExpenses: number;
}

export function computeMoneyKpis(
  sales: Sale[],
  expenses: Expense[],
  now: Date = new Date()
): MoneyKpis {
  const cutoff30 = daysAgoISO(30, now);
  const monthStart = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthSales = sales.filter((s) => s.soldDate >= monthStart);

  return {
    profitLast30: sumToNum(sales.filter((s) => s.soldDate >= cutoff30).map((s) => s.profit)),
    expensesLast30: sumToNum(expenses.filter((e) => e.date >= cutoff30).map((e) => e.amount)),
    monthRevenue: sumToNum(monthSales.map((s) => s.soldPrice)),
    monthProfit: sumToNum(monthSales.map((s) => s.profit)),
    monthExpenses: sumToNum(expenses.filter((e) => e.date >= monthStart).map((e) => e.amount)),
    totalExpenses: sumToNum(expenses.map((e) => e.amount)),
  };
}

/* ── Time series ─────────────────────────────────────────────────── */

/** Monthly buckets ending at the current month. */
export function monthlySeries(
  sales: Sale[],
  expenses: Expense[],
  months = 6,
  now: Date = new Date()
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const start = toISODate(d);
    const end = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    const revenue = sumToNum(sales.filter((s) => s.soldDate >= start && s.soldDate < end).map((s) => s.soldPrice));
    const expensesTotal = sumToNum(expenses.filter((e) => e.date >= start && e.date < end).map((e) => e.amount));
    points.push({
      date: monthLabel(start),
      revenue,
      expenses: expensesTotal,
      profit: toNum(dec(revenue).minus(expensesTotal)),
    });
  }
  return points;
}

/** Daily profit series for dashboard sparklines. */
export function dailySeries(
  sales: Sale[],
  days = 30,
  now: Date = new Date()
): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  for (let k = days - 1; k >= 0; k--) {
    const key = daysAgoISO(k, now);
    out.push({
      date: key,
      value: sumToNum(sales.filter((s) => s.soldDate === key).map((s) => s.profit)),
    });
  }
  return out;
}

/** Weekly buckets (label = week start) for 30/90-day analytics ranges. */
export function weeklySeries(
  sales: Sale[],
  expenses: Expense[],
  weeks = 4,
  now: Date = new Date()
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k * 7 - 6);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k * 7 + 1);
    const s = toISODate(start);
    const e = toISODate(end);
    const revenue = sumToNum(sales.filter((x) => x.soldDate >= s && x.soldDate < e).map((x) => x.soldPrice));
    const expensesTotal = sumToNum(expenses.filter((x) => x.date >= s && x.date < e).map((x) => x.amount));
    points.push({
      date: `Wk of ${format(start, "MMM d")}`,
      revenue,
      expenses: expensesTotal,
      profit: toNum(dec(revenue).minus(expensesTotal)),
    });
  }
  return points;
}

/** Sales within the last N days (for period-scoped KPIs). */
export function salesInDays(sales: Sale[], days: number, now: Date = new Date()): Sale[] {
  const cutoff = daysAgoISO(days, now);
  return sales.filter((s) => s.soldDate >= cutoff);
}

/* ── Breakdowns ──────────────────────────────────────────────────── */

export function salesByCategory(sales: Sale[], items: Item[]): CategorySlice[] {
  const map = new Map<string, number>();
  for (const s of sales) {
    const item = s.itemId ? items.find((i) => i.id === s.itemId) : undefined;
    const cat = item?.category ?? "Tops & Tees";
    map.set(cat, toNum(dec(map.get(cat) ?? 0).plus(s.soldPrice)));
  }
  return Array.from(map.entries())
    .map(([category, value]) => ({ category, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

export function marketplaceMix(sales: Sale[]): MarketplaceSlice[] {
  const map = new Map<string, number>();
  for (const s of sales) {
    map.set(s.marketplace, (map.get(s.marketplace) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([id, value]) => ({
      id: id as MarketplaceSlice["id"],
      name: MARKETPLACE_META[id as keyof typeof MARKETPLACE_META]?.name ?? id,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

export function expensesByCategory(
  expenses: Expense[]
): { category: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const cur = map.get(e.category) ?? { total: 0, count: 0 };
    map.set(e.category, {
      total: toNum(dec(cur.total).plus(e.amount)),
      count: cur.count + 1,
    });
  }
  return Array.from(map.entries())
    .map(([category, v]) => ({ category, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);
}

export function topPerformers(items: Item[], limit = 5): Item[] {
  return [...items]
    .filter((i) => i.status === "sold" && i.soldPrice !== undefined)
    .sort(
      (a, b) =>
        toNum(dec(b.soldPrice!).minus(b.purchasePrice)) -
        toNum(dec(a.soldPrice!).minus(a.purchasePrice))
    )
    .slice(0, limit);
}

/* ── Lists for pages ─────────────────────────────────────────────── */

export function recentSales(sales: Sale[], limit = 6): Sale[] {
  return [...sales].sort((a, b) => b.soldDate.localeCompare(a.soldDate)).slice(0, limit);
}

export function recentItems(items: Item[], limit = 6): Item[] {
  return [...items].sort((a, b) => b.acquiredDate.localeCompare(a.acquiredDate)).slice(0, limit);
}

/* ── Marketplace summary ─────────────────────────────────────────── */

export function marketplaceCounts(items: Item[]): { id: MarketplaceId; live: number }[] {
  return (Object.keys(MARKETPLACE_META) as MarketplaceId[]).map((id) => ({
    id,
    live: items.filter((i) => i.marketplaces[id]?.status === "live").length,
  }));
}

/** Number of items currently listed live on a given marketplace. */
export function liveListingsOn(items: Item[], marketplaceId: MarketplaceId): number {
  return items.filter((i) => i.marketplaces[marketplaceId]?.status === "live").length;
}
