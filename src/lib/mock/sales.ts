import type { MarketplaceId, Sale } from "@/lib/types";
import { CATEGORY_HEROES, img } from "@/lib/mock/images";
import { items } from "@/lib/mock/items";
import { intBetween, mulberry32, round2 } from "@/lib/mock/rng";

const iso = (daysAgo: number): string => {
  const d = new Date(2026, 7, 6);
  d.setDate(d.getDate() - daysAgo);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const FEE_RATE: Record<MarketplaceId, number> = {
  ebay: 0.1325,
  depop: 0.1,
  poshmark: 0.2,
  vinted: 0.05,
  mercari: 0.1,
  facebook: 0.05,
};

const FEE_FIXED: Record<MarketplaceId, number> = {
  ebay: 0.3,
  depop: 0.3,
  poshmark: 0,
  vinted: 0,
  mercari: 0.3,
  facebook: 0,
};

interface PastSaleSeed {
  name: string;
  category: string;
  price: number;
  daysAgo: number;
  marketplace: MarketplaceId;
}

const PAST_SALES: PastSaleSeed[] = [
  { name: "'90s Starter Pullover", category: "Hoodies & Sweats", price: 84, daysAgo: 61, marketplace: "ebay" },
  { name: "Vintage Levi's Western Shirt", category: "Flannels & Shirts", price: 58, daysAgo: 68, marketplace: "depop" },
  { name: "Carhartt Beanies (Bundle of 3)", category: "Hats & Accessories", price: 74, daysAgo: 74, marketplace: "poshmark" },
  { name: "Nike ACG Fleece", category: "Hoodies & Sweats", price: 96, daysAgo: 81, marketplace: "ebay" },
  { name: "Wrangler Denim Shirt", category: "Flannels & Shirts", price: 44, daysAgo: 88, marketplace: "vinted" },
  { name: "Columbia Interchange Jacket", category: "Outerwear", price: 88, daysAgo: 95, marketplace: "ebay" },
  { name: "Fila Disruptor Hoodie", category: "Hoodies & Sweats", price: 52, daysAgo: 102, marketplace: "depop" },
  { name: "Vintage Wool Blazer", category: "Jackets & Coats", price: 118, daysAgo: 109, marketplace: "poshmark" },
  { name: "Champion Heavyweight Tee", category: "Tops & Tees", price: 38, daysAgo: 116, marketplace: "vinted" },
  { name: "Levi's 550 Jeans", category: "Denim & Pants", price: 66, daysAgo: 123, marketplace: "ebay" },
  { name: "Gap Fleece Crewneck", category: "Hoodies & Sweats", price: 42, daysAgo: 130, marketplace: "facebook" },
  { name: "Nike Cork Tee", category: "Tops & Tees", price: 36, daysAgo: 137, marketplace: "depop" },
  { name: "Pendleton Wool Vest", category: "Knitwear & Sweaters", price: 62, daysAgo: 144, marketplace: "ebay" },
  { name: "Adidas Track Jacket", category: "Jackets & Coats", price: 72, daysAgo: 151, marketplace: "vinted" },
  { name: "Tommy Hilfiger Sail Tee", category: "Tops & Tees", price: 46, daysAgo: 158, marketplace: "depop" },
  { name: "Carhartt Duck Bibs", category: "Denim & Pants", price: 92, daysAgo: 165, marketplace: "ebay" },
  { name: "The North Face Base Camp Tee", category: "Tops & Tees", price: 34, daysAgo: 172, marketplace: "facebook" },
  { name: "Vintage Harley Tee (Black)", category: "Tops & Tees", price: 54, daysAgo: 179, marketplace: "ebay" },
];

const rng = mulberry32(19880712);

function makeSale(
  seed: PastSaleSeed | { itemId: string; name: string; category: string; price: number; daysAgo: number; marketplace: MarketplaceId },
  idx: number,
  purchaseOverride?: number
): Sale {
  const rate = FEE_RATE[seed.marketplace];
  const fixed = FEE_FIXED[seed.marketplace];
  const fees = round2(seed.price * rate + fixed);
  const shippingCost = round2(4.5 + rng() * 8);
  const payout = round2(seed.price - fees - shippingCost);
  // Inventory-linked sales use the item's real cost so the profit matches
  // the Inventory table; standalone sales get a realistic estimate.
  const purchase =
    purchaseOverride ?? round2(seed.price * (0.3 + rng() * 0.18));
  const profit = round2(payout - purchase);

  const heroes = CATEGORY_HEROES[seed.category] ?? CATEGORY_HEROES["Tops & Tees"];
  const hero = heroes[(idx * 3) % heroes.length];
  const thumbnail = img(hero, 240);

  return {
    id: `sale-${String(idx + 1).padStart(3, "0")}`,
    itemId: "itemId" in seed ? seed.itemId : undefined,
    itemName: seed.name,
    thumbnail,
    marketplace: seed.marketplace,
    soldDate: iso(seed.daysAgo),
    soldPrice: seed.price,
    fees,
    shippingCost,
    payout,
    profit,
  };
}

/* Sales tied to items still in inventory (sold status). */  const inventorySales: Sale[] = items
  .filter((i) => i.status === "sold" && i.soldDate)
  .map((item, i) =>
    makeSale(
      {
        itemId: item.id,
        name: item.name,
        category: item.category,
        price: item.soldPrice ?? item.listingPrice,
        daysAgo: Math.round((new Date(2026, 7, 6).getTime() - new Date(item.soldDate!).getTime()) / 864e5),
        marketplace: item.soldOn ?? "ebay",
      },
      i,
      item.purchasePrice
    )
  );

const pastSales: Sale[] = PAST_SALES.map((s, i) => makeSale(s, inventorySales.length + i));

/** Extra scattered sales to fill out the last two weeks with a nice cadence. */
const RECENT_NAMES: {
  name: string;
  category: string;
  price: number;
  marketplace: MarketplaceId;
}[] = [
  { name: "Gap Relaxed Fit Tee", category: "Tops & Tees", price: 115, marketplace: "depop" },
  { name: "'80s Champion Sweatshirt", category: "Hoodies & Sweats", price: 51, marketplace: "vinted" },
  { name: "Wrangler Pearl Snap", category: "Flannels & Shirts", price: 68, marketplace: "ebay" },
  { name: "Y2K Fila Windbreaker", category: "Outerwear", price: 37, marketplace: "vinted" },
  { name: "Vintage Nike Training Tee", category: "Tops & Tees", price: 108, marketplace: "poshmark" },
  { name: "Levi's Sherpa Trucker", category: "Jackets & Coats", price: 96, marketplace: "ebay" },
  { name: "Patagonia Synchilla Fleece", category: "Outerwear", price: 74, marketplace: "depop" },
  { name: "Carhartt Logo Cap", category: "Hats & Accessories", price: 33, marketplace: "facebook" },
  { name: "Columbia Fleece Zip", category: "Hoodies & Sweats", price: 44, marketplace: "poshmark" },
];

const recentExtra: Sale[] = RECENT_NAMES.map((s, i) =>
  makeSale(
    { ...s, daysAgo: intBetween(rng, 1, 13) },
    inventorySales.length + pastSales.length + i
  )
);

export const sales: Sale[] = [...inventorySales, ...pastSales, ...recentExtra].sort(
  (a, b) => b.soldDate.localeCompare(a.soldDate)
);
