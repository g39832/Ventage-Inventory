import type {
  Item,
  ItemStatus,
  MarketplaceId,
  MarketplaceListing,
  TimelineEvent,
} from "@/lib/types";
import { CATEGORY_HEROES, GALLERY_POOL, img } from "@/lib/mock/images";
import { intBetween, mulberry32, pick, round2 } from "@/lib/mock/rng";

/** Fixed "today" anchor so the demo dataset is stable between refreshes. */
export const TODAY = "2026-08-06";

const iso = (daysAgo: number): string => {
  const d = new Date(2026, 7, 6);
  d.setDate(d.getDate() - daysAgo);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const rng = mulberry32(20260806);

const NOTE_POOL = [
  "Washed and steamed before listing.",
  "Small mark on the lower right hem — disclosed in listing.",
  "Buttons all original and intact.",
  "Faint vintage scent — aired out before photos.",
  "Measurements taken: pit-to-pit and length noted in listing.",
  "Zipper replaced with matching NOS part.",
  "Dry-cleaned; stored in garment bag.",
  "Fabric pill-free, crisp hand.",
  "Tag shows original care instructions.",
  "One tiny hole near the cuff — priced accordingly.",
];

const TAG_POOL = ["vintage", "y2k", "grail", "deadstock", "skater", "streetwear", "workwear"];

// Mercari is intentionally absent: its connection is "not connected",
// so no items are listed there yet.
const LISTED_MARKETS: MarketplaceId[] = [
  "ebay",
  "depop",
  "poshmark",
  "vinted",
  "facebook",
];

interface ItemSeed {
  name: string;
  brand: string;
  category: string;
  era: string;
  size: string;
  condition: string;
  purchasePrice: number;
  listingPrice: number;
  status: ItemStatus;
  acquiredDaysAgo: number;
  listedDaysAgo?: number;
  soldPrice?: number;
  soldDaysAgo?: number;
  soldOn?: MarketplaceId;
  marketplaces?: Partial<Record<MarketplaceId, MarketplaceListing>>;
  notes?: string[];
}

function buildItem(seed: ItemSeed, idx: number): Item {
  const id = `it-${String(idx + 1).padStart(3, "0")}`;
  const sku = `VN-${1000 + idx}`;
  const category = seed.category;

  const heroes = CATEGORY_HEROES[category] ?? CATEGORY_HEROES["Tops & Tees"];
  const hero = heroes[idx % heroes.length];
  const gallery = [
    hero,
    GALLERY_POOL[idx % GALLERY_POOL.length],
    GALLERY_POOL[(idx + 2) % GALLERY_POOL.length],
    GALLERY_POOL[(idx + 4) % GALLERY_POOL.length],
  ].map((ph, gi) => img(ph, gi === 0 ? 1100 : 900));

  let marketplaces: Partial<Record<MarketplaceId, MarketplaceListing>> = {};

  if (seed.status === "sold" && seed.soldOn) {
    marketplaces = {
      [seed.soldOn]: {
        status: "sold",
        price: seed.soldPrice ?? seed.listingPrice,
        listingId: `LST-${String(idx + 1).padStart(3, "0")}-${LISTED_MARKETS.indexOf(seed.soldOn) + 1}`,
      },
    };
  } else if (seed.status === "listed") {
    marketplaces = seed.marketplaces ?? (() => {
      const start = idx % LISTED_MARKETS.length;
      const count = 1 + (idx % 3);
      const m: Partial<Record<MarketplaceId, MarketplaceListing>> = {};
      for (let k = 0; k < count; k++) {
        const mid = LISTED_MARKETS[(start + k) % LISTED_MARKETS.length];
        m[mid] = {
          status: "live",
          price: seed.listingPrice,
          listingId: `LST-${String(idx + 1).padStart(3, "0")}-${k + 1}`,
        };
      }
      return m;
    })();
  }

  const timeline: TimelineEvent[] = [
    {
      date: iso(seed.acquiredDaysAgo),
      title: "Item acquired",
      description: `Purchased for ${seed.purchasePrice.toFixed(2)} USD.`,
      kind: "acquired",
    },
  ];

  if (seed.status === "listed" && seed.listedDaysAgo !== undefined) {
    timeline.push({
      date: iso(seed.listedDaysAgo),
      title: "Listed for sale",
      description: `Listed at ${seed.listingPrice.toFixed(2)} USD.`,
      kind: "listed",
    });
    if (rng() < 0.35) {
      const mid = Math.round((seed.acquiredDaysAgo + seed.listedDaysAgo) / 2);
      if (mid < seed.acquiredDaysAgo && mid > seed.listedDaysAgo) {
        const lower = Math.round(seed.listingPrice * (0.85 + rng() * 0.1) * 100) / 100;
        timeline.push({
          date: iso(mid),
          title: "Price adjusted",
          description: `Pricing refined from ${lower.toFixed(2)} to ${seed.listingPrice.toFixed(2)}.`,
          kind: "price",
        });
      }
    }
  }

  if (seed.status === "sold" && seed.soldDaysAgo !== undefined) {
    timeline.push({
      date: iso(seed.soldDaysAgo),
      title: "Sold",
      description: `Sold for ${(seed.soldPrice ?? seed.listingPrice).toFixed(2)} USD${seed.soldOn ? ` on ${seed.soldOn}` : ""}.`,
      kind: "sold",
    });
  }

  timeline.sort((a, b) => a.date.localeCompare(b.date));

  const tags = [
    seed.era,
    "vintage",
    ...Array.from({ length: intBetween(rng, 0, 2) }, () => pick(rng, TAG_POOL)),
  ];
  const uniqueTags = Array.from(new Set(tags)).slice(0, 4);

  return {
    id,
    name: seed.name,
    brand: seed.brand,
    category,
    size: seed.size,
    era: seed.era,
    condition: seed.condition,
    description: "",
    sku,
    purchasePrice: seed.purchasePrice,
    listingPrice: seed.listingPrice,
    status: seed.status,
    soldPrice: seed.soldPrice,
    soldDate: seed.soldDaysAgo !== undefined ? iso(seed.soldDaysAgo) : undefined,
    soldOn: seed.soldOn,
    marketplaces,
    images: gallery,
    acquiredDate: iso(seed.acquiredDaysAgo),
    listedDate: seed.listedDaysAgo !== undefined ? iso(seed.listedDaysAgo) : undefined,
    notes: seed.notes ?? Array.from({ length: intBetween(rng, 1, 3) }, () => pick(rng, NOTE_POOL)),
    tags: uniqueTags,
    timeline,
  };
}

/* ── Hand-curated hero items ─────────────────────────────────────── */

const HEROES: ItemSeed[] = [
  {
    name: "Vintage Levi's Trucker Jacket",
    brand: "Levi's",
    category: "Jackets & Coats",
    era: "90s",
    size: "M",
    condition: "Very good — one small mark",
    purchasePrice: 28,
    listingPrice: 95,
    status: "listed",
    acquiredDaysAgo: 46,
    listedDaysAgo: 31,
    marketplaces: {
      ebay: { status: "live", price: 95, listingId: "LST-001-1" },
      depop: { status: "live", price: 95, listingId: "LST-001-2" },
    },
    notes: [
      "Classic '90s trucker in the washed-black fade. Tags intact.",
      "Small mark on left cuff — disclosed in listing.",
    ],
  },
  {
    name: "Carhartt Detroit Work Jacket",
    brand: "Carhartt",
    category: "Jackets & Coats",
    era: "90s",
    size: "L",
    condition: "Excellent",
    purchasePrice: 45,
    listingPrice: 160,
    status: "listed",
    acquiredDaysAgo: 21,
    listedDaysAgo: 9,
    marketplaces: {
      ebay: { status: "live", price: 160, listingId: "LST-002-1" },
    },
    notes: ["Duck shell with blanket lining — the grail cut.", "Stored in garment bag; hardware all original."],
  },
  {
    name: "'90s Nike Club Fleece Hoodie",
    brand: "Nike",
    category: "Hoodies & Sweats",
    era: "90s",
    size: "M",
    condition: "Good — faded wash",
    purchasePrice: 18,
    listingPrice: 75,
    status: "listed",
    acquiredDaysAgo: 38,
    listedDaysAgo: 25,
    marketplaces: {
      depop: { status: "live", price: 75, listingId: "LST-003-1" },
      vinted: { status: "live", price: 75, listingId: "LST-003-2" },
    },
    notes: ["Heavyweight fleece, perfect faded '90s wash."],
  },
  {
    name: "Harley-Davidson Motor Tee",
    brand: "Harley-Davidson",
    category: "Tops & Tees",
    era: "80s",
    size: "L",
    condition: "Excellent — crisp print",
    purchasePrice: 12,
    listingPrice: 48,
    status: "listed",
    acquiredDaysAgo: 52,
    listedDaysAgo: 40,
    marketplaces: {
      ebay: { status: "live", price: 48, listingId: "LST-004-1" },
      facebook: { status: "live", price: 48, listingId: "LST-004-2" },
    },
    notes: ["Single-stitch 80s tee, bold chest print, no cracking."],
  },
  {
    name: "Pendleton Wool Flannel",
    brand: "Pendleton",
    category: "Flannels & Shirts",
    era: "70s",
    size: "M",
    condition: "Very good",
    purchasePrice: 22,
    listingPrice: 85,
    status: "listed",
    acquiredDaysAgo: 60,
    listedDaysAgo: 48,
    marketplaces: {
      ebay: { status: "live", price: 85, listingId: "LST-005-1" },
      depop: { status: "live", price: 85, listingId: "LST-005-2" },
    },
    notes: ["Authentic vintage Pendleton in the board shirt plaid.", "Dry-cleaned and pressed."],
  },
  {
    name: "Y2K Columbia Titanium Windbreaker",
    brand: "Columbia",
    category: "Outerwear",
    era: "2000s",
    size: "M",
    condition: "Excellent",
    purchasePrice: 15,
    listingPrice: 65,
    status: "listed",
    acquiredDaysAgo: 18,
    listedDaysAgo: 6,
    marketplaces: {
      depop: { status: "live", price: 65, listingId: "LST-006-1" },
      vinted: { status: "live", price: 65, listingId: "LST-006-2" },
      facebook: { status: "live", price: 65, listingId: "LST-006-3" },
    },
    notes: ["Y2K titanium shell — iridescent olive finish.", "Drawstrings and zips all working."],
  },
  {
    name: "Champion Reverse Weave Crewneck",
    brand: "Champion",
    category: "Hoodies & Sweats",
    era: "90s",
    size: "XL",
    condition: "Very good",
    purchasePrice: 25,
    listingPrice: 90,
    status: "sold",
    acquiredDaysAgo: 95,
    listedDaysAgo: 78,
    soldPrice: 110,
    soldDaysAgo: 12,
    soldOn: "depop",
    notes: ["Oversized 90s Reverse Weave, lettering intact."],
  },
  {
    name: "Levi's 501 Button-Fly Jeans",
    brand: "Levi's",
    category: "Denim & Pants",
    era: "80s",
    size: "34×32",
    condition: "Good — natural fade",
    purchasePrice: 30,
    listingPrice: 120,
    status: "listed",
    acquiredDaysAgo: 34,
    listedDaysAgo: 20,
    marketplaces: {
      ebay: { status: "live", price: 120, listingId: "LST-008-1" },
      poshmark: { status: "live", price: 120, listingId: "LST-008-2" },
    },
    notes: ["Great honeycomb fade, all buttons original.", "Wash: original (no soak)."],
  },
  {
    name: "Ralph Lauren Rugby Stripe Polo",
    brand: "Ralph Lauren",
    category: "Tops & Tees",
    era: "90s",
    size: "M",
    condition: "Excellent",
    purchasePrice: 14,
    listingPrice: 60,
    status: "listed",
    acquiredDaysAgo: 27,
    listedDaysAgo: 15,
    marketplaces: {
      ebay: { status: "live", price: 60, listingId: "LST-009-1" },
      poshmark: { status: "live", price: 60, listingId: "LST-009-2" },
      facebook: { status: "live", price: 60, listingId: "LST-009-3" },
    },
    notes: ["Rugby stripes in great condition, embroidered pony."],
  },
  {
    name: "Patagonia Retro-X Fleece",
    brand: "Patagonia",
    category: "Outerwear",
    era: "90s",
    size: "M",
    condition: "Excellent",
    purchasePrice: 40,
    listingPrice: 140,
    status: "draft",
    acquiredDaysAgo: 8,
    notes: ["Next lot to photograph — heavyweight fleece, full zip.", "Expect strong demand; limited size run."],
  },
  {
    name: "Wrangler Corduroy Jacket",
    brand: "Wrangler",
    category: "Jackets & Coats",
    era: "70s",
    size: "L",
    condition: "Very good",
    purchasePrice: 26,
    listingPrice: 88,
    status: "draft",
    acquiredDaysAgo: 11,
    notes: ["Earth-tone wale corduroy, western cut.", "Needs a soak and press before photos."],
  },
  {
    name: "Tommy Hilfiger Flag Sweater",
    brand: "Tommy Hilfiger",
    category: "Knitwear & Sweaters",
    era: "90s",
    size: "M",
    condition: "Good — slight pilling",
    purchasePrice: 20,
    listingPrice: 78,
    status: "listed",
    acquiredDaysAgo: 29,
    listedDaysAgo: 17,
    marketplaces: {
      depop: { status: "live", price: 78, listingId: "LST-012-1" },
      vinted: { status: "live", price: 78, listingId: "LST-012-2" },
    },
    notes: ["De-pilled and steamed. Flag knit is clean."],
  },
];

/* ── Generated stock ─────────────────────────────────────────────── */

const COMBOS: Omit<ItemSeed, "acquiredDaysAgo" | "listedDaysAgo">[] = [
  { name: "Dickies Eisenhower Jacket", brand: "Dickies", category: "Jackets & Coats", era: "90s", size: "M", condition: "Very good", purchasePrice: 24, listingPrice: 82, status: "listed" },
  { name: "Gap '90s Washed Tee", brand: "Gap", category: "Tops & Tees", era: "90s", size: "M", condition: "Good", purchasePrice: 8, listingPrice: 34, status: "listed" },
  { name: "Nike Dri-FIT Crew", brand: "Nike", category: "Hoodies & Sweats", era: "2000s", size: "L", condition: "Excellent", purchasePrice: 11, listingPrice: 42, status: "draft" },
  { name: "Pendleton Board Shirt", brand: "Pendleton", category: "Flannels & Shirts", era: "80s", size: "L", condition: "Excellent", purchasePrice: 27, listingPrice: 92, status: "listed" },
  { name: "Ben Davis Bib Overalls", brand: "Ben Davis", category: "Denim & Pants", era: "90s", size: "32×30", condition: "Very good", purchasePrice: 32, listingPrice: 105, status: "listed" },
  { name: "The North Face Denali Fleece", brand: "The North Face", category: "Outerwear", era: "90s", size: "L", condition: "Very good", purchasePrice: 35, listingPrice: 130, status: "sold" },
  { name: "New Era Starter Snapback", brand: "New Era", category: "Hats & Accessories", era: "90s", size: "OS", condition: "Good", purchasePrice: 9, listingPrice: 38, status: "listed" },
  { name: "Adidas Gazelle (Vintage)", brand: "Adidas", category: "Shoes", era: "80s", size: "US 9", condition: "Fair — worn", purchasePrice: 21, listingPrice: 70, status: "unlisted" },
  { name: "Fila Disruptor Tee", brand: "Fila", category: "Tops & Tees", era: "90s", size: "XL", condition: "Very good", purchasePrice: 10, listingPrice: 40, status: "listed" },
  { name: "JCPenney Wool Cardigan", brand: "JCPenney", category: "Knitwear & Sweaters", era: "70s", size: "M", condition: "Good", purchasePrice: 13, listingPrice: 48, status: "listed" },
  { name: "Wrangler 13MWZ Jeans", brand: "Wrangler", category: "Denim & Pants", era: "90s", size: "33×31", condition: "Excellent", purchasePrice: 19, listingPrice: 68, status: "listed" },
  { name: "Columbia Bugaboo Shell", brand: "Columbia", category: "Outerwear", era: "90s", size: "M", condition: "Very good", purchasePrice: 17, listingPrice: 58, status: "draft" },
  { name: "Ralph Lauren Chino Field Jacket", brand: "Ralph Lauren", category: "Jackets & Coats", era: "90s", size: "L", condition: "Very good", purchasePrice: 33, listingPrice: 110, status: "listed" },
  { name: "Hanes Beefy-T (Bulk Lot)", brand: "Hanes", category: "Tops & Tees", era: "90s", size: "L", condition: "Excellent", purchasePrice: 7, listingPrice: 30, status: "listed" },
  { name: "Champion Script Hoodie", brand: "Champion", category: "Hoodies & Sweats", era: "2000s", size: "M", condition: "Very good", purchasePrice: 16, listingPrice: 55, status: "sold" },
  { name: "Ben Sherman Button-Up", brand: "Ben Sherman", category: "Flannels & Shirts", era: "90s", size: "S", condition: "Good", purchasePrice: 14, listingPrice: 52, status: "listed" },
  { name: "Levi's SilverTab Cargo", brand: "Levi's", category: "Denim & Pants", era: "90s", size: "32×32", condition: "Excellent", purchasePrice: 23, listingPrice: 79, status: "listed" },
  { name: "Carhartt Chore Coat", brand: "Carhartt", category: "Jackets & Coats", era: "2000s", size: "M", condition: "Very good", purchasePrice: 29, listingPrice: 98, status: "draft" },
  { name: "Nike Windrunner (Vintage)", brand: "Nike", category: "Outerwear", era: "90s", size: "L", condition: "Very good", purchasePrice: 26, listingPrice: 89, status: "listed" },
  { name: "Mossimo Y2K Zip Hoodie", brand: "Mossimo", category: "Hoodies & Sweats", era: "2000s", size: "L", condition: "Good", purchasePrice: 12, listingPrice: 45, status: "listed" },
  { name: "Reebok Club C Track Jacket", brand: "Reebok", category: "Jackets & Coats", era: "90s", size: "M", condition: "Excellent", purchasePrice: 20, listingPrice: 66, status: "listed" },
  { name: "Gap Corduroy Hat", brand: "Gap", category: "Hats & Accessories", era: "90s", size: "OS", condition: "Very good", purchasePrice: 6, listingPrice: 26, status: "unlisted" },
  { name: "Vintage Champion Track Top", brand: "Champion", category: "Hoodies & Sweats", era: "80s", size: "XL", condition: "Good", purchasePrice: 18, listingPrice: 62, status: "listed" },
  { name: "Tommy Hilfiger Denim Shirt", brand: "Tommy Hilfiger", category: "Flannels & Shirts", era: "90s", size: "L", condition: "Very good", purchasePrice: 16, listingPrice: 54, status: "sold" },
  { name: "Carhartt Beanie (Vintage)", brand: "Carhartt", category: "Hats & Accessories", era: "90s", size: "OS", condition: "Excellent", purchasePrice: 5, listingPrice: 32, status: "listed" },
  { name: "Adidas Firebird Tracksuit Top", brand: "Adidas", category: "Hoodies & Sweats", era: "90s", size: "M", condition: "Very good", purchasePrice: 24, listingPrice: 84, status: "listed" },
  { name: "Polo Ralph Lauren Half-Zip", brand: "Polo Ralph Lauren", category: "Knitwear & Sweaters", era: "90s", size: "L", condition: "Excellent", purchasePrice: 22, listingPrice: 76, status: "draft" },
  { name: "Vans Slip-On (Vintage)", brand: "Vans", category: "Shoes", era: "90s", size: "US 10", condition: "Fair", purchasePrice: 15, listingPrice: 49, status: "listed" },
  { name: "Dickies 874 Work Pant", brand: "Dickies", category: "Denim & Pants", era: "2000s", size: "34×30", condition: "Excellent", purchasePrice: 17, listingPrice: 56, status: "listed" },
  { name: "LL Bean Chamois Shirt", brand: "L.L. Bean", category: "Flannels & Shirts", era: "80s", size: "M", condition: "Good", purchasePrice: 11, listingPrice: 44, status: "unlisted" },
  { name: "Nike Swoosh Tee (Vintage)", brand: "Nike", category: "Tops & Tees", era: "90s", size: "L", condition: "Very good", purchasePrice: 13, listingPrice: 46, status: "listed" },
  { name: "The North Face Nuptse (Down)", brand: "The North Face", category: "Outerwear", era: "90s", size: "M", condition: "Very good", purchasePrice: 55, listingPrice: 190, status: "sold" },
  { name: "Columbia Hiking Cap", brand: "Columbia", category: "Hats & Accessories", era: "90s", size: "OS", condition: "Good", purchasePrice: 7, listingPrice: 28, status: "listed" },
  { name: "Levi's Type III (1960s)", brand: "Levi's", category: "Jackets & Coats", era: "60s", size: "S", condition: "Fair — patina", purchasePrice: 38, listingPrice: 125, status: "listed" },
  { name: "Carhartt Logo Hoodie", brand: "Carhartt", category: "Hoodies & Sweats", era: "2000s", size: "L", condition: "Good", purchasePrice: 15, listingPrice: 52, status: "draft" },
  { name: "Gap Vintage Cardigan", brand: "Gap", category: "Knitwear & Sweaters", era: "90s", size: "S", condition: "Excellent", purchasePrice: 12, listingPrice: 42, status: "listed" },
];

const STATUS_CYCLE: ItemStatus[] = [
  "listed",
  "listed",
  "draft",
  "listed",
  "listed",
  "sold",
  "listed",
  "unlisted",
  "draft",
  "listed",
];

const SOLD_MARKETS: MarketplaceId[] = ["ebay", "depop", "poshmark", "vinted"];

const generatedSeeds: ItemSeed[] = COMBOS.map((c, i) => {
  const status = c.status ?? STATUS_CYCLE[i % STATUS_CYCLE.length];
  const acquiredDaysAgo = intBetween(rng, 5, 110);

  if (status === "sold") {
    const soldOn = pick(rng, SOLD_MARKETS);
    const soldDaysAgo = intBetween(rng, 4, 60);
    const soldPrice = round2(c.listingPrice * (0.95 + rng() * 0.22));
    return {
      ...c,
      status,
      acquiredDaysAgo: soldDaysAgo + intBetween(rng, 6, 45),
      soldDaysAgo,
      soldPrice,
      soldOn,
    };
  }

  const listedDaysAgo =
    status === "listed" ? intBetween(rng, 1, Math.max(2, acquiredDaysAgo - 2)) : undefined;

  return {
    ...c,
    status,
    acquiredDaysAgo,
    listedDaysAgo,
  };
});

export const items: Item[] = [
  ...HEROES.map((h, i) => buildItem(h, i)),
  ...generatedSeeds.map((g, i) => buildItem(g, HEROES.length + i)),
];
