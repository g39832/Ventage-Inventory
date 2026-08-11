import type { Expense, ExpenseCategory } from "@/lib/types";
import { mulberry32, pick, round2 } from "@/lib/mock/rng";

const iso = (daysAgo: number): string => {
  const d = new Date(2026, 7, 6);
  d.setDate(d.getDate() - daysAgo);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

interface ExpenseSeed {
  category: ExpenseCategory;
  description: string;
  amount: number;
  daysAgo: number;
}

const FIXED: ExpenseSeed[] = [
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
  { category: "Shipping", description: "UPS label — wool overcoat", amount: 14.85, daysAgo: 19 },
  { category: "Cleaning & Repair", description: "Zipper repair — Levi's jacket", amount: 18, daysAgo: 21 },
  { category: "Sourcing", description: "Estate sale purchases", amount: 112, daysAgo: 24 },
  { category: "Fees", description: "Poshmark commission (bundle sale)", amount: 18.6, daysAgo: 26 },
  { category: "Packaging & Supplies", description: "Tissue paper + thank-you cards", amount: 13.2, daysAgo: 28 },
  { category: "Shipping", description: "USPS Priority — 5 packages", amount: 41.4, daysAgo: 32 },
  { category: "Photography", description: "LED photo light kit", amount: 59.99, daysAgo: 36 },
  { category: "Fees", description: "Vinted buyer-protection share", amount: 9.8, daysAgo: 41 },
  { category: "Sourcing", description: "Flea market run — gas + entry", amount: 48, daysAgo: 45 },
  { category: "Cleaning & Repair", description: "Vintage wash & press — 6 pcs", amount: 42, daysAgo: 50 },
  { category: "Storage", description: "Storage bins ×4", amount: 32, daysAgo: 58 },
  { category: "Packaging & Supplies", description: "Shipping tape + labels", amount: 9.25, daysAgo: 63 },
  { category: "Fees", description: "eBay store subscription", amount: 21.95, daysAgo: 70 },
  { category: "Shipping", description: "USPS Ground Advantage — 2 packages", amount: 12.3, daysAgo: 74 },
  { category: "Sourcing", description: "Weekend sourcing trip", amount: 96, daysAgo: 82 },
  { category: "Software & Tools", description: "Photo editing app (monthly)", amount: 12.99, daysAgo: 89 },
  { category: "Cleaning & Repair", description: "De-pilling service — sweaters", amount: 16, daysAgo: 96 },
  { category: "Fees", description: "Depop payment fees (batch)", amount: 26.7, daysAgo: 104 },
  { category: "Photography", description: "Backdrop + clips", amount: 27.5, daysAgo: 112 },
  { category: "Packaging & Supplies", description: "Bubble mailers ×40", amount: 15.8, daysAgo: 121 },
  { category: "Sourcing", description: "Estate sale purchases", amount: 128, daysAgo: 134 },
];

const rng = mulberry32(441117);

const EXTRA_POOL: Omit<ExpenseSeed, "daysAgo">[] = [
  { category: "Shipping", description: "USPS Priority — priority box", amount: 9.45 },
  { category: "Packaging & Supplies", description: "Poly mailers refill ×50", amount: 11.5 },
  { category: "Fees", description: "eBay final value fees (batch)", amount: 33.2 },
  { category: "Cleaning & Repair", description: "Spot cleaning supplies", amount: 12.4 },
  { category: "Sourcing", description: "Thrift store run", amount: 38 },
];

const extras: Expense[] = Array.from({ length: 6 }, (_, i) => {
  const seed = pick(rng, EXTRA_POOL);
  return {
    id: `exp-extra-${i}`,
    category: seed.category,
    description: seed.description,
    amount: round2(seed.amount * (0.85 + rng() * 0.5)),
    date: iso(intBetweenRng(1, 5)),
  };
});

function intBetweenRng(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export const expenses: Expense[] = [
  ...FIXED.map((e, i) => ({
    id: `exp-${String(i + 1).padStart(3, "0")}`,
    category: e.category,
    description: e.description,
    amount: e.amount,
    date: iso(e.daysAgo),
  })),
  ...extras,
].sort((a, b) => b.date.localeCompare(a.date));
