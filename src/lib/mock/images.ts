/**
 * Curated Unsplash images (all URLs verified live). Each category has a pool of
 * hero images; general shots pad out gallery views. Images are chosen
 * deterministically per item so the demo looks stable and intentional.
 */

const URL = (id: string, w: number, q = 80) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;

export const img = (id: string, w = 900): string => URL(id, w);

export const CATEGORY_HEROES: Record<string, string[]> = {
  "Jackets & Coats": [
    "1591047139829-d91aecb6caea",
    "1552374196-c4e7ffc6e126",
    "1556821840-3a63f95609a7",
  ],
  "Tops & Tees": [
    "1521572163474-6864f9cf17ab",
    "1576566588028-4147f3842f27",
    "1554568218-0f1715e72254",
  ],
  "Hoodies & Sweats": [
    "1523381210434-271e8be1f52b",
    "1556821840-3a63f95609a7",
    "1554568218-0f1715e72254",
  ],
  "Flannels & Shirts": [
    "1596755094514-f87e34085b2c",
    "1521572163474-6864f9cf17ab",
    "1489987707025-afc232f7ea0f",
  ],
  "Knitwear & Sweaters": [
    "1556821840-3a63f95609a7",
    "1445205170230-053b83016050",
    "1560243563-062bfc001d68",
  ],
  "Denim & Pants": [
    "1489987707025-afc232f7ea0f",
    "1523398002811-999ca8dec234",
    "1445205170230-053b83016050",
  ],
  Outerwear: [
    "1591047139829-d91aecb6caea",
    "1552374196-c4e7ffc6e126",
    "1603252109303-2751441dd157",
  ],
  "Hats & Accessories": [
    "1556821840-3a63f95609a7",
    "1611312449408-fcece27cdbb7",
    "1560243563-062bfc001d68",
  ],
  Shoes: ["1542291026-7eec264c27ff", "1544441893-675973e31985"],
};

/** General "shop floor" shots used as secondary gallery images. */
export const GALLERY_POOL = [
  "1445205170230-053b83016050",
  "1479064555552-3ef4979f8908",
  "1441984904996-e0b6ba687e04",
  "1485462537746-965f33f7f6a7",
  "1560243563-062bfc001d68",
];

/** Warm-gradient placeholder when an image fails to load. */
export const FALLBACK_ID = "1556821840-3a63f95609a7";
