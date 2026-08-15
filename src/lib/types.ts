/**
 * Domain models for Regroove.
 *
 * The pages and components only ever consume these shapes through `lib/data.ts`,
 * so a real API client can replace the mock layer later without touching the UI.
 */

export type MarketplaceId =
  | "ebay"
  | "depop"
  | "poshmark"
  | "vinted"
  | "mercari"
  | "facebook";

export const MARKETPLACE_IDS: MarketplaceId[] = [
  "ebay",
  "depop",
  "poshmark",
  "vinted",
  "mercari",
  "facebook",
];

export type ItemStatus = "listed" | "draft" | "sold" | "unlisted";

export type MarketplaceListingStatus = "live" | "sold" | "none";

export interface MarketplaceListing {
  status: MarketplaceListingStatus;
  price?: number;
  listingId?: string;
}

export type TimelineKind =
  | "acquired"
  | "listed"
  | "price"
  | "sold"
  | "note"
  | "expense";

export interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  kind: TimelineKind;
}

export interface Item {
  id: string;
  name: string;
  brand: string;
  category: string;
  size: string;
  era: string;
  condition: string;
  /** Long-form listing copy (AI-assisted via Ask Regroove). */
  description: string;
  sku: string;
  purchasePrice: number;
  listingPrice: number;
  status: ItemStatus;
  soldPrice?: number;
  soldDate?: string;
  soldOn?: MarketplaceId;
  marketplaces: Partial<Record<MarketplaceId, MarketplaceListing>>;
  images: string[];
  acquiredDate: string;
  listedDate?: string;
  notes: string[];
  tags: string[];
  timeline: TimelineEvent[];
}

export interface ItemPhoto {
  id: string;
  itemId: string;
  url: string;
  position: number;
}

export interface Sale {
  id: string;
  itemId?: string;
  itemName: string;
  thumbnail: string;
  marketplace: MarketplaceId;
  soldDate: string;
  soldPrice: number;
  fees: number;
  shippingCost: number;
  payout: number;
  profit: number;
}

export type ExpenseCategory =
  | "Shipping"
  | "Packaging & Supplies"
  | "Fees"
  | "Cleaning & Repair"
  | "Photography"
  | "Storage"
  | "Sourcing"
  | "Software & Tools";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Shipping",
  "Packaging & Supplies",
  "Fees",
  "Cleaning & Repair",
  "Photography",
  "Storage",
  "Sourcing",
  "Software & Tools",
];

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  /** Set when the expense was logged against a specific inventory item. */
  itemId?: string;
}

export type ConnectionStatus = "connected" | "manual" | "not-connected";

export interface MarketplaceConnection {
  id: MarketplaceId;
  name: string;
  tagline: string;
  status: ConnectionStatus;
  account?: string;
  listings: number;
  lastSync?: string;
  syncType: "auto" | "manual";
  note: string;
}

export type TaskKind = "listing" | "shipping" | "photo" | "sourcing" | "general";

export interface Task {
  id: string;
  title: string;
  due?: string;
  kind: TaskKind;
  done: boolean;
}

export interface Kpi {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  hint?: string;
}

export interface ChartPoint {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface CategorySlice {
  category: string;
  value: number;
}

export interface MarketplaceSlice {
  id: MarketplaceId;
  name: string;
  value: number;
}
