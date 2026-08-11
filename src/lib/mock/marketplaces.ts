import type { MarketplaceId } from "@/lib/types";

export const MARKETPLACE_META: Record<
  MarketplaceId,
  { name: string; color: string; bg: string; monogram: string }
> = {
  ebay: { name: "eBay", color: "#4f6fa8", bg: "#4f6fa81a", monogram: "eB" },
  depop: { name: "Depop", color: "#6b6b45", bg: "#6b6b451a", monogram: "Dp" },
  poshmark: { name: "Poshmark", color: "#b0554a", bg: "#b0554a1a", monogram: "Pm" },
  vinted: { name: "Vinted", color: "#3e8e80", bg: "#3e8e801a", monogram: "Vt" },
  mercari: { name: "Mercari", color: "#cf8033", bg: "#cf80331a", monogram: "Mc" },
  facebook: { name: "Facebook Marketplace", color: "#4f5f9e", bg: "#4f5f9e1a", monogram: "FM" },
};
