/**
 * Deterministic question routing. NO AI is spent on this step — keywords
 * decide which context builder runs, so normal questions ("how many items
 * do I have?") are answered with computed data and a minimal explanation
 * instead of a full-database dump to the model.
 */

export type Route =
  | { kind: "listing-content"; itemId?: string }
  | { kind: "item"; itemId: string }
  | { kind: "oldest-unsold" }
  | { kind: "financials" }
  | { kind: "expenses" }
  | { kind: "marketplaces" }
  | { kind: "inventory" }
  | { kind: "overview" };

const LISTING_WORDS = [
  "title",
  "description",
  "write",
  "rewrite",
  "improve",
  "summarize",
  "summarise",
  "listing copy",
  "product copy",
  "draft",
];
const OLDEST_WORDS = [
  "oldest",
  "sitting",
  "unsold",
  "stale",
  "discount",
  "90 day",
  "90-day",
  "longest",
];
const EXPENSE_WORDS = ["expense", "expenses", "spend", "spent", "spending", "cost me", "costs"];
const FINANCIAL_WORDS = [
  "profit",
  "revenue",
  "sold",
  "sale",
  "sales",
  "payout",
  "fee",
  "fees",
  "earn",
  "earned",
  "made",
  "make",
  "income",
  "margin",
  "roi",
];
const MARKETPLACE_WORDS = [
  "marketplace",
  "ebay",
  "depop",
  "poshmark",
  "vinted",
  "mercari",
  "facebook",
  "channel",
];
const INVENTORY_WORDS = [
  "inventory",
  "item",
  "items",
  "stock",
  "brand",
  "brands",
  "how many",
  "count",
  "category",
  "list",
  "listing",
];

export function route(message: string, itemId?: string): Route {
  const m = message.toLowerCase();

  // On an item page, "improve listing" style asks always target that item.
  if (itemId) {
    if (LISTING_WORDS.some((w) => m.includes(w))) {
      return { kind: "listing-content", itemId };
    }
    return { kind: "item", itemId };
  }

  if (LISTING_WORDS.some((w) => m.includes(w))) return { kind: "listing-content" };
  if (OLDEST_WORDS.some((w) => m.includes(w))) return { kind: "oldest-unsold" };
  if (EXPENSE_WORDS.some((w) => m.includes(w))) return { kind: "expenses" };
  if (FINANCIAL_WORDS.some((w) => m.includes(w))) return { kind: "financials" };
  if (MARKETPLACE_WORDS.some((w) => m.includes(w))) return { kind: "marketplaces" };
  if (INVENTORY_WORDS.some((w) => m.includes(w))) return { kind: "inventory" };
  return { kind: "overview" };
}
